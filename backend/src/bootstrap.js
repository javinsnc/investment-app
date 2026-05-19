const db = require("./db");

async function recomputeCurrentAssets() {
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

    // Ensure a master `funds` row exists for every ticker seen in operations.
    // asset_class_id is curated separately (Morningstar lookup), so it is never
    // overwritten here — that is why current_assets can be safely truncated.
    for (const [_, v] of map) {
        await db.query(
            `INSERT INTO funds (ticker, name, asset_type)
             VALUES ($1, $2, $3)
             ON CONFLICT (ticker) DO UPDATE SET name=EXCLUDED.name,
                                                asset_type=EXCLUDED.asset_type;`,
            [v.ticker, v.name, v.asset_type]
        );
    }

    // current_assets is now fully derived from operations: rebuild it from scratch.
    await db.query(`TRUNCATE current_assets;`);
    for (const [_, v] of map) {
        if (v.qty > 0) {
            await db.query(
                `INSERT INTO current_assets (ticker, average_price, quantity)
                 VALUES ($1, $2, $3);`,
                [v.ticker, v.avg, v.qty]
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
    // Asset class catalogue (RV / RF / RM).
    await db.query(`
        CREATE TABLE IF NOT EXISTS asset_classes
        (
            id    SMALLINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            code  TEXT NOT NULL UNIQUE,
            label TEXT NOT NULL
        );
    `);
    await db.query(`
        INSERT INTO asset_classes (code, label)
        VALUES ('equities', 'equities (RV)'),
               ('fixed_income', 'fixed income (RF)'),
               ('mixed', 'mixed (RM)')
        ON CONFLICT (code) DO NOTHING;
    `);
    // Master table: one row per fund/ticker. Holds the attributes that are NOT
    // derived from operations (notably the curated asset_class_id).
    await db.query(`
        CREATE TABLE IF NOT EXISTS funds
        (
            ticker         TEXT PRIMARY KEY,
            name           TEXT     NOT NULL,
            asset_type     TEXT     NOT NULL,
            asset_class_id SMALLINT REFERENCES asset_classes (id)
        );
    `);
    // current_assets holds ONLY the derived holding state (quantity / avg price).
    // Name, type and asset class live in `funds`.
    await db.query(`
        CREATE TABLE IF NOT EXISTS current_assets
        (
            id            SERIAL PRIMARY KEY,
            ticker        TEXT           NOT NULL UNIQUE REFERENCES funds (ticker),
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
    await db.query(`
        CREATE TABLE IF NOT EXISTS price_update_runs
        (
            id              bigserial PRIMARY KEY,
            run_date        date NOT NULL UNIQUE,
            started_at      timestamptz NOT NULL DEFAULT now(),
            finished_at     timestamptz,
            status          text NOT NULL CHECK (status IN ('pending','ok','error')),
            updated_count   integer DEFAULT 0,
            details         jsonb
        );
    `);
    // Indexes. PK/UNIQUE constraints already index funds.ticker, current_assets
    // .ticker, etc.; these cover the FK referencing column and the hot lookups
    // on operations/prices.
    await db.query(`CREATE INDEX IF NOT EXISTS idx_funds_asset_class_id ON funds (asset_class_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_operations_ticker ON operations (ticker);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_operations_op_date ON operations (op_date);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_prices_ticker_date ON prices (ticker, date);`);

    await recomputeCurrentAssets();
}

module.exports = {bootstrap, recomputeCurrentAssets};
