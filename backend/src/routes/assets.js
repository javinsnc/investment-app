const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", async (_req, res) => {
  try {
    const q = `
      WITH last_price AS (
        SELECT p.ticker, p.closing_price, p.date AS last_date
        FROM prices p
               JOIN (
          SELECT ticker, MAX(date) AS md
          FROM prices
          GROUP BY ticker
        ) m ON m.ticker = p.ticker AND m.md = p.date
      )
      SELECT
        ca.id,
        ca.name,
        ca.ticker,
        ca.asset_type AS type,
        ca.quantity,
        ca.average_price AS purchase_price,
        (ca.average_price * ca.quantity) AS invested,
        lp.closing_price AS current_price,
        lp.last_date AS last_price_date,
        CASE WHEN lp.closing_price IS NOT NULL THEN lp.closing_price * ca.quantity END AS current_value,
        CASE WHEN lp.closing_price IS NOT NULL THEN (lp.closing_price - ca.average_price) * ca.quantity END AS pnl_abs,
        CASE WHEN lp.closing_price IS NOT NULL AND ca.average_price > 0
               THEN ((lp.closing_price - ca.average_price) / ca.average_price) * 100
          END AS pnl_pct
      FROM current_assets ca
             LEFT JOIN last_price lp ON lp.ticker = ca.ticker
      ORDER BY ca.ticker;
    `;
    const { rows } = await db.query(q);
    res.json(rows);
  } catch (err) {
    console.error("List assets error", err);
    res.status(500).json({ error: "Failed to fetch assets" });
  }
});

module.exports = router;
