const express = require("express");
const router = express.Router();
const db = require("../db");
const { recomputeCurrentAssets } = require("../bootstrap");

/**
 * POST /api/operations
 * body: { name, ticker, asset_type, side: 'BUY'|'SELL', op_date: 'YYYY-MM-DD', price, quantity }
 * - Valida que en SELL no se venda más que la cantidad disponible en current_assets.
 * - Inserta operación y recalcula current_assets (JS, sin triggers).
 */
router.post("/", async (req, res) => {
  try {
    const { name, ticker, asset_type, side, op_date, price, quantity } = req.body || {};

    if (!name || !ticker || !asset_type || !op_date || price == null || quantity == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const sideNorm = String(side).toUpperCase() === "SELL" ? "SELL" : "BUY";
    const qty = Number(quantity);
    const p = Number(price);

    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(p) || p <= 0) {
      return res.status(400).json({ error: "Invalid price or quantity" });
    }

    // Validación de venta: no se puede vender más de lo que hay
    if (sideNorm === "SELL") {
      const { rows } = await db.query(
          `SELECT quantity FROM current_assets WHERE ticker = $1 LIMIT 1`,
          [ticker.trim()]
      );
      const currentQty = rows?.[0]?.quantity ? Number(rows[0].quantity) : 0;
      if (qty > currentQty) {
        return res.status(409).json({ error: "Cannot sell more than current quantity" });
      }
    }

    await db.query(
        `INSERT INTO operations (name, ticker, asset_type, side, op_date, price, quantity)
       VALUES ($1,$2,$3,$4,$5,$6,$7);`,
        [name.trim(), ticker.trim(), asset_type.trim(), sideNorm, op_date, p, qty]
    );

    await recomputeCurrentAssets();

    res.status(201).json({ ok: true });
  } catch (e) {
    console.error("Create operation error", e);
    res.status(500).json({ error: "Failed to create operation" });
  }
});

module.exports = router;
