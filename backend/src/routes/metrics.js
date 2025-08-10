const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", async (_req, res) => {
  try {
    const q = `
      WITH last_price AS (
        SELECT p.ticker, p.closing_price
        FROM prices p
        JOIN (SELECT ticker, MAX(date) md FROM prices GROUP BY ticker) m
          ON m.ticker = p.ticker AND m.md = p.date
      )
      SELECT
        COALESCE(SUM(ca.average_price * ca.quantity), 0) AS total_investment,
        COALESCE(SUM(CASE WHEN lp.closing_price IS NOT NULL THEN lp.closing_price * ca.quantity END), 0) AS total_value
      FROM current_assets ca
      LEFT JOIN last_price lp ON lp.ticker = ca.ticker;
    `;
    const { rows } = await db.query(q);
    const total_investment = Number(rows[0].total_investment) || 0;
    const total_value = Number(rows[0].total_value) || 0;
    const gain_loss = total_value - total_investment;
    const gain_loss_pct = total_investment > 0 ? (gain_loss / total_investment) * 100 : 0;
    res.json({ total_investment, total_value, gain_loss, gain_loss_pct });
  } catch (err) {
    console.error("Metrics error", err);
    res.status(500).json({ error: "Failed to compute metrics" });
  }
});

module.exports = router;
