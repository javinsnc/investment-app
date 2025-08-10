const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", async (_req, res) => {
  try {
    const totalInvestmentQ = await db.query(`
      SELECT COALESCE(SUM(purchase_price * quantity), 0) AS total_investment
      FROM assets
    `);

    const currentValueQ = await db.query(`
      SELECT COALESCE(SUM(p.closing_price * a.quantity), 0) AS total_value
      FROM assets a
      JOIN prices p ON a.id = p.asset_id
      WHERE p.date = (SELECT MAX(date) FROM prices)
    `);

    const total_investment = Number(totalInvestmentQ.rows[0].total_investment) || 0;
    const total_value = Number(currentValueQ.rows[0].total_value) || 0;
    const gain_loss = total_value - total_investment;
    const gain_loss_pct = total_investment > 0 ? (gain_loss / total_investment) * 100 : 0;

    res.json({ total_investment, total_value, gain_loss, gain_loss_pct });
  } catch (err) {
    console.error("Metrics error", err);
    res.status(500).json({ error: "Failed to compute metrics" });
  }
});

module.exports = router;
