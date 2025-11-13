const express = require("express");
const router = express.Router();
const db = require("../db");
const {recomputeCurrentAssets} = require("../bootstrap");
const { insertPriceIfMissing } = require("../services/pricesOnOperation");

/**
 * POST /api/operations
 * body: { name, ticker, asset_type, operation_type: 'buy'|'sell', op_date: 'YYYY-MM-DD', price, quantity }
 * - Valida que en sell no se venda más que la cantidad disponible en current_assets.
 * - Inserta operación y recalcula current_assets (JS, sin triggers).
 */
router.post("/", async (req, res) => {
    try {
        const {name, ticker, asset_type, operation_type, op_date, price, quantity} = req.body || {};

        if (!name || !ticker || !asset_type || !op_date || price == null || quantity == null) {
            return res.status(400).json({error: "Missing required fields"});
        }

        const operation_typeNorm = String(operation_type).toLowerCase() === "sell" ? "sell" : "buy";
        const qty = Number(quantity);
        const p = Number(price);

        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(p) || p <= 0) {
            return res.status(400).json({error: "Invalid price or quantity"});
        }

        // Validación de venta: no se puede vender más de lo que hay
        if (operation_typeNorm === "sell") {
            const {rows} = await db.query(
                `SELECT quantity
                 FROM current_assets
                 WHERE ticker = $1
                 LIMIT 1`,
                [ticker.trim()]
            );
            const currentQty = rows?.[0]?.quantity ? Number(rows[0].quantity) : 0;
            if (qty > currentQty) {
                return res.status(409).json({error: "Cannot sell more than current quantity"});
            }
        }

        const client = await db.pool.connect();
        await client.query("BEGIN");
        await db.query(
            `INSERT INTO operations (name, ticker, asset_type, operation_type, op_date, price, quantity)
             VALUES ($1, $2, $3, $4, $5, $6, $7);`,
            [name.trim(), ticker.trim(), asset_type.trim(), operation_typeNorm, op_date, p, qty]
        );
        await insertPriceIfMissing(client, ticker, op_date, price);
        await client.query("COMMIT");
        await recomputeCurrentAssets();

        res.status(201).json({ok: true});
    } catch (e) {
        console.error("Create operation error", e);
        res.status(500).json({error: "Failed to create operation"});
    }
});
/**
 * POST /api/operations/import
 * Body: CSV (Content-Type: text/csv)
 * CSV headers requeridos (en cualquier orden): ticker,name,asset_type,operation_type,op_date,quantity,price
 */
router.post("/import", async (req, res) => {
    try {
        const csv = String(req.body || "");
        if (!csv.trim()) return res.status(400).json({error: "Empty CSV"});

        // Parseo CSV simple con soporte de comillas
        const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) return res.status(400).json({error: "CSV has no data"});

        const parseLine = (line) => {
            const out = [];
            let cur = "", inQ = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQ && line[i + 1] === '"') {
                        cur += '"';
                        i++;
                    } else inQ = !inQ;
                } else if (ch === ',' && !inQ) {
                    out.push(cur);
                    cur = "";
                } else {
                    cur += ch;
                }
            }
            out.push(cur);
            return out.map(s => s.trim());
        };

        const header = parseLine(lines[0]).map(h => h.toLowerCase());
        const idx = (name) => header.indexOf(name);
        const required = ["ticker", "name", "asset_type", "operation_type", "op_date", "quantity", "price"];
        for (const r of required) {
            if (idx(r) === -1) return res.status(400).json({error: `Missing column '${r}' in CSV header`});
        }

        const client = await db.pool.connect();
        let inserted = 0, skipped = 0;
        try {
            await client.query("BEGIN");
            for (let li = 1; li < lines.length; li++) {
                const cols = parseLine(lines[li]);
                if (cols.length < header.length) {
                    skipped++;
                    continue;
                }
                const ticker = cols[idx("ticker")];
                const name = cols[idx("name")] || null;
                const asset_type = cols[idx("asset_type")] || null;
                const operation_type = (cols[idx("operation_type")] || "").toLowerCase();
                const op_date = cols[idx("op_date")];
                const quantity = Number((cols[idx("quantity")] || "").replace(/\./g, "").replace(",", "."));
                const price = Number((cols[idx("price")] || "").replace(/\./g, "").replace(",", "."));

                if (!ticker || !op_date || !["buy", "sell"].includes(operation_type) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
                    skipped++;
                    continue;
                }

                await client.query(
                    `INSERT INTO operations (ticker, name, asset_type, operation_type, op_date, quantity, price)
                     VALUES ($1, $2, $3, $4, $5::date, $6, $7)`,
                    [ticker, name, asset_type, operation_type, op_date, quantity, price]
                );
                await insertPriceIfMissing(client, ticker, op_date, price);
                inserted++;
            }

            await client.query("COMMIT");
            await recomputeCurrentAssets();
        } catch (e) {
            await client.query("ROLLBACK");
            throw e;
        } finally {
            client.release();
        }
        res.json({ok: true, inserted, skipped});
    } catch (e) {
        console.error("operations:import error", e);
        res.status(500).json({error: "Failed to import CSV"});
    }
});

module.exports = router;
