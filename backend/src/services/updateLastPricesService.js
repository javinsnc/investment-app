const axios = require("axios").default;
const db = require("../db");

// ---------- Helpers ----------
function startOfDay(d) { const dt = new Date(d); dt.setHours(0,0,0,0); return dt; }
function toISODate(d) { return d.toISOString().slice(0,10); }

// dd/mm/yyyy  |  "August 8 2025"/"August 8, 2025"
function parseDateFlex(s){
    if(!s) return null;
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(m1){ const [,dd,mm,yyyy]=m1; const dt=new Date(+yyyy, +mm-1, +dd); return isNaN(dt)?null:startOfDay(dt); }
    const cleaned = s.replace(/(\d+)(st|nd|rd|th)/gi,"$1").replace(/,\s*/g," ");
    const dt2 = new Date(cleaned);
    return isNaN(dt2) ? null : startOfDay(dt2);
}

// "1.234,56" / "1,234.56" / "1234,56" -> Number
function parseLocaleNumber(text){
    if(text==null) return null;
    let s = String(text).trim().replace(/\u00A0/g," ").replace(/\s+/g,"");
    const lastComma=s.lastIndexOf(","), lastDot=s.lastIndexOf(".");
    if(lastComma!==-1 && lastDot!==-1){
        const dec = lastComma>lastDot ? "," : ".";
        const thou = dec === "," ? "." : ",";
        s = s.replace(new RegExp("\\"+thou,"g"),"").replace(dec,".");
    }else if(lastComma!==-1){
        s = s.replace(/\./g,"").replace(",",".");
    }else{
        const parts=s.split(".");
        if(parts.length>2){ const dec=parts.pop(); s = parts.join("")+"."+dec; }
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

async function fetchHTML(url){
    const res = await axios.get(url, {
        timeout: 15000,
        headers: {
            "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome",
            "Accept-Language":"es-ES,es;q=0.9,en;q=0.8"
        }
    });
    return res.data;
}

// ---------- Parsers ----------
function parseQuefondos(html){
    const rePrice = /<span.*?>Valor liquidativo.*?<\/span><span.*?>(.*?) EUR/gm;
    const reDate  = /<span.*?>Fecha.*?<\/span><span.*?>(.*?)</gm;
    const pm = rePrice.exec(html);
    const dm = reDate.exec(html);
    const rawPrice = pm && pm[1] ? String(pm[1]).trim() : null;
    const rawDate  = dm && dm[1] ? String(dm[1]).trim() : null;
    const price = parseLocaleNumber(rawPrice);
    const date  = parseDateFlex(rawDate);
    return { price, date, source:"quefondos", rawPrice, rawDate };
}

function parseFT(html){
    const rePrice = /<span class="mod-ui-data-list__value">(.*?)<\/span>/gm;
    const reDate  = /<div class="mod-disclaimer">.*?as of (.*?)\.<\/div>/gm;
    const pm = rePrice.exec(html);
    const dm = reDate.exec(html);
    let rawPrice = pm && pm[1] ? String(pm[1]).trim() : null;
    const rawDate  = dm && dm[1] ? String(dm[1]).trim() : null;
    // requisito: reemplazar '.' por ',' antes de normalizar
    if(rawPrice!=null){ rawPrice = rawPrice.replace(/\./g, ","); }
    const price = parseLocaleNumber(rawPrice);
    const date  = parseDateFlex(rawDate);
    return { price, date, source:"ft", rawPrice, rawDate };
}

// ---------- Servicio principal ----------
const TOLERANCE_DAYS_BACK = 14; // aceptamos datos hasta 2 semanas hacia atrás
// A partir de ahora aceptamos fechas **hasta hoy** (no solo “ayer hábil”)
function todayISO(){ return toISODate(startOfDay(new Date())); }

/**
 * Ejecuta la actualización de últimos precios.
 * - Consulta ambos orígenes (QF y FT)
 * - Elige el candidato con **fecha más reciente** (hasta hoy)
 * - Inserta si es estrictamente **más nuevo** que lo último en DB
 * @param {Object} opts
 * @param {string=} opts.ticker ISIN opcional para actualizar solo ese fondo
 * @param {Function=} opts.log función de log (por defecto console.log)
 * @returns {Promise<{checked:number,updated:number,skipped:number,errors:Array}>}
 */
async function runUpdateLastPrices({ ticker = "", log = console.log } = {}) {
    const report = { checked: 0, updated: 0, skipped: 0, errors: [] };

    const maxISO = todayISO(); // límite superior = hoy
    const minDate = new Date(startOfDay(new Date()));
    minDate.setDate(minDate.getDate() - (TOLERANCE_DAYS_BACK - 1));
    const minISO = toISODate(minDate);

    try {
        // Selección de fondos a revisar
        let rows = [];
        if (ticker) {
            const { rows: one } = await db.query(
                `WITH lp AS (SELECT ticker, MAX(date) md FROM prices GROUP BY ticker)
         SELECT ca.ticker, ca.name, lp.md AS last_date
         FROM current_assets ca
         LEFT JOIN lp ON lp.ticker = ca.ticker
         WHERE ca.asset_type='fund' AND ca.ticker=$1`,
                [ticker]
            );
            rows = one;
        } else {
            const { rows: many } = await db.query(
                `WITH lp AS (SELECT ticker, MAX(date) md FROM prices GROUP BY ticker)
         SELECT ca.ticker, ca.name, lp.md AS last_date
         FROM current_assets ca
         LEFT JOIN lp ON lp.ticker = ca.ticker
         WHERE ca.asset_type='fund' AND (lp.md IS NULL OR lp.md < $1::date)
         ORDER BY ca.ticker`,
                [maxISO] // revisa si falta hoy; si ya tienes hoy, se omitirá (y si no, se intentará mejorar)
            );
            rows = many;
        }

        for (const f of rows) {
            report.checked += 1;
            const isin = String(f.ticker).trim();
            const lastDate = f.last_date ? toISODate(new Date(f.last_date)) : null;

            let qf = null, ft = null;
            try {
                const qfURL = `https://www.quefondos.com/es/fondos/ficha/index.html?isin=${encodeURIComponent(isin)}`;
                const html  = await fetchHTML(qfURL);
                qf = parseQuefondos(html);
            } catch (_e) { qf = null; }
            try {
                const ftURL = `https://markets.ft.com/data/funds/tearsheet/summary?s=${encodeURIComponent(isin)}`;
                const html  = await fetchHTML(ftURL);
                ft = parseFT(html);
            } catch (_e) { ft = null; }

            // Logs de fuentes
            if (qf) log(`[QF] ${isin} date:${qf.date?toISODate(qf.date):'-'} price:${qf.price} rawP:${qf.rawPrice} rawD:${qf.rawDate}`);
            if (ft) log(`[FT] ${isin} date:${ft.date?toISODate(ft.date):'-'} price:${ft.price} rawP:${ft.rawPrice} rawD:${ft.rawDate}`);

            // Normalizar candidatos válidos
            const rawCandidates = [qf, ft].filter(Boolean).filter(c => c.price != null && c.date);
            const candidates = [];
            for (const c of rawCandidates) {
                const iso = toISODate(c.date);
                if (iso < minISO) { log(`[SKIP] ${isin} ${c.source} too old: ${iso} < ${minISO}`); continue; }
                if (iso > maxISO) { log(`[SKIP] ${isin} ${c.source} in future: ${iso} > ${maxISO}`); continue; }
                candidates.push({ ...c, iso });
            }

            if (candidates.length === 0) {
                report.skipped += 1;
                continue;
            }

            // Elegir el MÁS RECIENTE (FT 2025-08-12 ganará a QF 2025-08-08)
            candidates.sort((a,b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : 0));
            const chosen = candidates[0];

            // No insertes si no mejora la fecha existente
            if (lastDate && chosen.iso <= lastDate) {
                log(`[SKIP] ${isin} chosen ${chosen.iso} <= last ${lastDate}`);
                report.skipped += 1;
                continue;
            }

            // Evitar duplicado exacto
            const exists = await db.query(
                `SELECT 1 FROM prices WHERE ticker=$1 AND date=$2 LIMIT 1`,
                [isin, chosen.iso]
            );
            if (exists.rowCount > 0) {
                log(`[SKIP] ${isin} price for ${chosen.iso} already exists`);
                report.skipped += 1;
                continue;
            }

            await db.query(
                `INSERT INTO prices (ticker, date, closing_price) VALUES ($1,$2,$3)`,
                [isin, chosen.iso, chosen.price]
            );
            report.updated += 1;
            log(`[OK] ${isin} -> chosen ${chosen.source.toUpperCase()} | date:${chosen.iso} price:${chosen.price}` +
                (lastDate ? ` (prev:${lastDate})` : ""));
        }
    } catch (e) {
        report.errors.push({ error: String(e.message || e) });
    }

    return report;
}

module.exports = { runUpdateLastPrices };
