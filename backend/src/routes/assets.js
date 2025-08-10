const express = require("express");
const router = express.Router();
const db = require("../db");

// Create asset
router.post("/", async (req, res) => {
  const { name, ticker, type, purchase_date, purchase_price, quantity } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO assets (name, ticker, type, purchase_date, purchase_price, quantity)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [name, ticker, type, purchase_date, purchase_price, quantity]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Create asset error", err);
    res.status(500).json({ error: "Failed to create asset" });
  }
});

// List assets with per-asset metrics (latest price)
router.get("/", async (_req, res) => {
  try {
    const q = `
      SELECT
        a.*,
        (a.purchase_price * a.quantity) AS invested,
        lp.closing_price AS current_price,
        CASE WHEN lp.closing_price IS NOT NULL
             THEN lp.closing_price * a.quantity
             ELSE NULL END AS current_value,
        CASE WHEN lp.closing_price IS NOT NULL
             THEN (lp.closing_price - a.purchase_price) * a.quantity
             ELSE NULL END AS pnl_abs,
        CASE WHEN lp.closing_price IS NOT NULL AND a.purchase_price > 0
             THEN ((lp.closing_price - a.purchase_price) / a.purchase_price) * 100
             ELSE NULL END AS pnl_pct
      FROM assets a
      LEFT JOIN LATERAL (
        SELECT p.closing_price
        FROM prices p
        WHERE p.asset_id = a.id
        ORDER BY p.date DESC
        LIMIT 1
      ) lp ON TRUE
      ORDER BY a.id;
    `;
    const { rows } = await db.query(q);
    res.json(rows);
  } catch (err) {
    console.error("List assets error", err);
    res.status(500).json({ error: "Failed to fetch assets" });
  }
});

module.exports = router;
