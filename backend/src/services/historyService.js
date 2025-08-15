const db = require("../db");

// ---------- utilidades de fecha ----------
function toISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
function fromISO(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
}
function startOfDay(d) {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt;
}
function addDays(d, n) {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + n);
    return dt;
}
function buildDateRange(startISO, endISO) {
    const start = startISO ? startOfDay(fromISO(startISO)) : null;
    const end = endISO ? startOfDay(fromISO(endISO)) : startOfDay(new Date());
    const trueStart = start || end; // si no hay start, como mínimo un día (end)

    const dates = [];
    for (let d = trueStart; d <= end; d = addDays(d, 1)) {
        dates.push(toISO(d));
    }
    return dates;
}
// bucket para day/week/month/year
function bucketKey(iso, group) {
    const d = fromISO(iso);
    const g = (group || "day").toLowerCase();
    if (g === "week") {
        // Lunes como inicio de semana
        const day = d.getDay(); // 0=Domingo..6=Sábado
        const diff = (day + 6) % 7; // 0=Lunes
        const monday = addDays(d, -diff);
        return toISO(monday);
    }
    if (g === "month") {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    }
    if (g === "year") {
        return `${d.getFullYear()}-01-01`;
    }
    return iso; // day
}

function downsample(series, maxPoints = 100) {
    const n = Number(maxPoints) || 100;
    if (series.length <= n) return series;
    const step = Math.ceil(series.length / n);
    const out = [];
    for (let i = 0; i < series.length; i += step) out.push(series[i]);
    if (out[out.length - 1]?.date !== series[series.length - 1]?.date) out.push(series[series.length - 1]);
    return out;
}

// ---------- helpers de datos ----------
function groupBy(arr, keyFn) {
    const map = new Map();
    for (const item of arr) {
        const k = keyFn(item);
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(item);
    }
    return map;
}

/**
 * Construye cantidades acumuladas por fecha para cada ticker
 * ops: [{ticker, op_date, operation_type, quantity}]
 * dates: array de YYYY-MM-DD ordenadas
 * return: Map<ticker, Map<isoDate, qty>>
 */
function buildCumQuantities(ops, dates) {
    // Ordenar operaciones por fecha
    ops.sort((a, b) => new Date(a.op_date) - new Date(b.op_date));
    const byT = groupBy(ops, (o) => o.ticker);

    const result = new Map();
    for (const [ticker, list] of byT.entries()) {
        // precomputar pares {date, cum}
        let cum = 0;
        const cumByDate = new Map(); // solo días con evento
        for (const o of list) {
            const delta = o.operation_type === "sell" ? -Number(o.quantity) : Number(o.quantity);
            cum += delta;
            const iso = toISO(startOfDay(new Date(o.op_date)));
            cumByDate.set(iso, cum);
        }
        // ahora forward-fill a todas las fechas pedidas
        const mapForDates = new Map();
        let last = 0;
        for (const iso of dates) {
            if (cumByDate.has(iso)) last = cumByDate.get(iso);
            mapForDates.set(iso, last);
        }
        result.set(ticker, mapForDates);
    }
    return result;
}

/**
 * Construye precios por fecha con forward-fill (último precio <= día)
 * prices: [{ticker, date, closing_price}]
 * dates: array de YYYY-MM-DD
 * return: Map<ticker, Map<isoDate, price>>
 */
function buildForwardPrices(prices, dates) {
    prices.sort((a, b) => new Date(a.date) - new Date(b.date));
    const byT = groupBy(prices, (p) => p.ticker);

    const result = new Map();
    for (const [ticker, list] of byT.entries()) {
        const priceByDate = new Map();
        for (const p of list) {
            const iso = toISO(startOfDay(new Date(p.date)));
            priceByDate.set(iso, Number(p.closing_price));
        }
        const mapForDates = new Map();
        let last = 0;
        for (const iso of dates) {
            if (priceByDate.has(iso)) last = priceByDate.get(iso);
            mapForDates.set(iso, last);
        }
        result.set(ticker, mapForDates);
    }
    return result;
}

/**
 * Reagrupar una serie diaria [{date, value}] en week/month/year
 * tomando **el último valor del bucket** (no suma).
 */
function regroupByBucketLast(series, group) {
    const buckets = new Map(); // key -> { date, value }
    for (const point of series) {
        const key = bucketKey(point.date, group);
        const prev = buckets.get(key);
        // nos quedamos con el de fecha más reciente dentro del bucket
        if (!prev || point.date > prev.date) {
            buckets.set(key, { date: point.date, value: point.value });
        }
    }
    // ordenamos por clave (inicio de bucket) para fechas ascendentes
    return Array.from(buckets.entries())
        .sort((a, b) => new Date(a[0]) - new Date(b[0]))
        .map(([bucketStart, { value }]) => ({ date: bucketStart, value }));
}

// ---------- consultas mínimas ----------
async function getUniverseTickers(explicitTickers) {
    if (explicitTickers && explicitTickers.length) return explicitTickers;
    const { rows } = await db.query(`SELECT DISTINCT ticker FROM current_assets ORDER BY ticker`);
    return rows.map((r) => r.ticker);
}
async function getOps(tickers, endISO) {
    // Traemos TODO hasta endISO para calcular acumulado
    const { rows } = await db.query(
        `SELECT ticker, op_date::date AS op_date, operation_type, quantity
         FROM operations
         WHERE ticker = ANY($1) AND op_date::date <= $2::date
         ORDER BY op_date ASC`,
        [tickers, endISO]
    );
    return rows;
}
async function getPrices(tickers, endISO) {
    const { rows } = await db.query(
        `SELECT ticker, date::date AS date, closing_price
         FROM prices
         WHERE ticker = ANY($1) AND date::date <= $2::date
         ORDER BY date ASC`,
        [tickers, endISO]
    );
    return rows;
}

// ---------- API de servicio ----------
async function historyPortfolio({ start, end, tickers = [], group = "day", maxPoints = 100 }) {
    // 1) fechas
    const dates = buildDateRange(start, end);
    if (dates.length === 0) return [];
    // 2) universo de tickers
    const universe = await getUniverseTickers(tickers);
    if (universe.length === 0) return [];
    // 3) datos crudos
    const [ops, prices] = await Promise.all([
        getOps(universe, dates[dates.length - 1]),
        getPrices(universe, dates[dates.length - 1]),
    ]);
    // 4) mapas por fecha
    const qtyMap = buildCumQuantities(ops, dates);     // Map<ticker, Map<date, qty>>
    const priceMap = buildForwardPrices(prices, dates); // Map<ticker, Map<date, price>>

    // 5) sumar por fecha (valor de cartera diario)
    const daily = [];
    for (const iso of dates) {
        let total = 0;
        for (const t of universe) {
            const q = qtyMap.get(t)?.get(iso) || 0;
            const p = priceMap.get(t)?.get(iso) || 0;
            total += q * p;
        }
        daily.push({ date: iso, value: total });
    }

    // 6) agrupar por bucket (week/month/year) tomando el ÚLTIMO valor del periodo
    const g = (group || "day").toLowerCase();
    if (g !== "day") {
        const regrouped = regroupByBucketLast(daily, g);
        return downsample(regrouped, maxPoints);
    }

    return downsample(daily, maxPoints);
}

async function historyAsset({ ticker, start, end, group = "day", maxPoints = 100 }) {
    const dates = buildDateRange(start, end);
    if (dates.length === 0) return [];
    const [ops, prices] = await Promise.all([
        getOps([ticker], dates[dates.length - 1]),
        getPrices([ticker], dates[dates.length - 1]),
    ]);
    const qtyMap = buildCumQuantities(ops, dates).get(ticker) || new Map();
    const priceMap = buildForwardPrices(prices, dates).get(ticker) || new Map();

    const daily = dates.map((iso) => ({
        date: iso,
        value: (qtyMap.get(iso) || 0) * (priceMap.get(iso) || 0),
    }));

    const g = (group || "day").toLowerCase();
    if (g !== "day") {
        const regrouped = regroupByBucketLast(daily, g);
        return downsample(regrouped, maxPoints);
    }

    return downsample(daily, maxPoints);
}

module.exports = { historyPortfolio, historyAsset };
