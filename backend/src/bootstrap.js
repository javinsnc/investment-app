const db = require("./db");

async function recomputeCurrentAssets() {
    await db.query(`TRUNCATE current_assets;`);
    const {rows: ops} = await db.query(`
        SELECT name, ticker, asset_type, operation_type, op_date, price::numeric AS price, quantity::numeric AS quantity
        FROM operations
        ORDER BY op_date ASC, id ASC;
    `);
    const map = new Map();
    for (const o of ops) {
        const key = o.ticker;
        const cur = map.get(key) || {name: o.name, ticker: o.ticker, asset_type: o.asset_type, avg: 0, qty: 0};
        if (o.operation_type === "buy") {
            const newQty = cur.qty + Number(o.quantity);
            const newAvg = newQty > 0 ? (cur.avg * cur.qty + Number(o.price) * Number(o.quantity)) / newQty : 0;
            cur.avg = newAvg;
            cur.qty = newQty;
        } else if (o.operation_type === "sell") {
            cur.qty = cur.qty - Number(o.quantity);
            if (cur.qty < 0) cur.qty = 0;
        }
        cur.name = cur.name || o.name;
        cur.asset_type = cur.asset_type || o.asset_type;
        map.set(key, cur);
    }
    for (const [_, v] of map) {
        if (v.qty > 0) {
            await db.query(
                `INSERT INTO current_assets (name, ticker, asset_type, average_price, quantity)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (ticker) DO UPDATE SET name=EXCLUDED.name,
                                                    asset_type=EXCLUDED.asset_type,
                                                    average_price=EXCLUDED.average_price,
                                                    quantity=EXCLUDED.quantity;`,
                [v.name, v.ticker, v.asset_type, v.avg, v.qty]
            );
        }
    }
}

async function bootstrap() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS operations
        (
            id             SERIAL PRIMARY KEY,
            name           TEXT           NOT NULL,
            ticker         TEXT           NOT NULL,
            asset_type     TEXT           NOT NULL,
            operation_type TEXT           NOT NULL CHECK (operation_type IN ('buy', 'sell')),
            op_date        DATE           NOT NULL,
            price          NUMERIC(18, 8) NOT NULL,
            quantity       NUMERIC(18, 8) NOT NULL
        );
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS current_assets
        (
            id            SERIAL PRIMARY KEY,
            name          TEXT           NOT NULL,
            ticker        TEXT           NOT NULL UNIQUE,
            asset_type    TEXT           NOT NULL,
            average_price NUMERIC(18, 8) NOT NULL,
            quantity      NUMERIC(18, 8) NOT NULL
        );
    `);
    await db.query(`
        CREATE TABLE IF NOT EXISTS prices
        (
            id            SERIAL PRIMARY KEY,
            ticker        TEXT           NOT NULL,
            date          DATE           NOT NULL,
            closing_price NUMERIC(18, 8) NOT NULL
        );
    `);
    await recomputeCurrentAssets();
}

module.exports = {bootstrap, recomputeCurrentAssets};
