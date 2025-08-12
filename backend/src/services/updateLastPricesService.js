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

// Europe/Madrid: ayer hábil (si sábado/domingo, retrocede)
function getPrevBusinessDayEuropeMadrid() {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    return startOfDay(d);
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
const TOLERANCE_DAYS = 5;

/**
 * Ejecuta la actualización de últimos precios.
 * @param {Object} opts
 * @param {string=} opts.ticker ISIN opcional para actualizar solo ese fondo
 * @param {Function=} opts.log función de log (por defecto console.log)
 * @returns {Promise<{checked:number,updated:number,skipped:number,errors:Array}>}
 */
async function runUpdateLastPrices({ ticker = "", log = console.log } = {}) {
    const report = { checked: 0, updated: 0, skipped: 0, errors: [] };

    const target = getPrevBusinessDayEuropeMadrid();
    const targetISO = toISODate(target);
    const minAccepted = new Date(target);
    minAccepted.setDate(minAccepted.getDate() - (TOLERANCE_DAYS - 1));
    const minISO = toISODate(minAccepted);

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
                [targetISO]
            );
            rows = many;
        }

        for (const f of rows) {
            report.checked += 1;
            const isin = String(f.ticker).trim();
            const lastDate = f.last_date ? toISODate(new Date(f.last_date)) : null;

            const tryInsert = async (parsed) => {
                if (!parsed || parsed.price == null || !parsed.date) return false;
                const parsedISO = toISODate(parsed.date);

                // Log por requerimiento
                log(`[${parsed.source.toUpperCase()}] ${isin} -> price:${parsed.price} | date:${parsed.date} | rawPrice:${parsed.rawPrice} | rawDate:${parsed.rawDate}`);

                // Reglas de aceptación
                if (parsedISO > targetISO || parsedISO < minISO) return false;
                if (lastDate && parsedISO <= lastDate) return false;

                const exists = await db.query(
                    `SELECT 1 FROM prices WHERE ticker=$1 AND date=$2 LIMIT 1`,
                    [isin, parsedISO]
                );
                if (exists.rowCount > 0) return true;

                await db.query(
                    `INSERT INTO prices (ticker, date, closing_price) VALUES ($1,$2,$3)`,
                    [isin, parsedISO, parsed.price]
                );
                report.updated += 1;
                return true;
            };

            try {
                // 1) QueFondos
                try {
                    const qfURL = `https://www.quefondos.com/es/fondos/ficha/index.html?isin=${encodeURIComponent(isin)}`;
                    const html  = await fetchHTML(qfURL);
                    const parsed= parseQuefondos(html);
                    const ok = await tryInsert(parsed);
                    if (ok) continue;
                } catch (e) { /* sigue FT */ }

                // 2) FT
                try {
                    const ftURL = `https://markets.ft.com/data/funds/tearsheet/summary?s=${encodeURIComponent(isin)}`;
                    const html  = await fetchHTML(ftURL);
                    const parsed= parseFT(html);
                    const ok = await tryInsert(parsed);
                    if (ok) continue;
                } catch (e) { /* nada */ }

                report.skipped += 1;
            } catch (err) {
                report.errors.push({ isin, error: String(err.message || err) });
            }
        }
    } catch (e) {
        report.errors.push({ error: String(e.message || e) });
    }

    return report;
}

module.exports = { runUpdateLastPrices };
