const express = require("express");
const router = express.Router();
const db = require("../db");

function isISODate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function buildDateFilter(start, end, params) {
  const where = [];
  if (start && isISODate(start)) {
    params.push(start);
    where.push(`p.date >= $${params.length}`);
  }
  if (end && isISODate(end)) {
    params.push(end);
    where.push(`p.date <= $${params.length}`);
  }
  return where.length ? `AND ${where.join(" AND ")}` : "";
}

// Portfolio history
router.get("/portfolio", async (req, res) => {
  try {
    const group = (req.query.group || "day").toLowerCase();
    const allowed = new Set(["day", "week", "month", "year"]);
    const unit = allowed.has(group) ? group : "day";

    const start = req.query.start;
    const end = req.query.end;

    const params = [unit];
    const dateFilter = buildDateFilter(start, end, params);

    const q = `
      SELECT date_trunc($1, p.date)::date AS date,
             COALESCE(SUM(p.closing_price * a.quantity), 0) AS value
      FROM prices p
      JOIN assets a ON a.id = p.asset_id
      WHERE 1=1
      ${dateFilter}
      GROUP BY 1
      ORDER BY 1;
    `;
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get portfolio history" });
  }
});

// Single asset history
router.get("/asset/:id", async (req, res) => {
  try {
    const group = (req.query.group || "day").toLowerCase();
    const allowed = new Set(["day", "week", "month", "year"]);
    const unit = allowed.has(group) ? group : "day";

    const assetId = Number(req.params.id);
    if (!assetId || Number.isNaN(assetId)) {
      return res.status(400).json({ error: "Invalid :id" });
    }

    const start = req.query.start;
    const end = req.query.end;

    const params = [unit, assetId];
    const dateFilter = buildDateFilter(start, end, params);

    const q = `
      SELECT date_trunc($1, p.date)::date AS date,
             COALESCE(SUM(p.closing_price * a.quantity), 0) AS value
      FROM prices p
      JOIN assets a ON a.id = p.asset_id
      WHERE a.id = $2
      ${dateFilter}
      GROUP BY 1
      ORDER BY 1;
    `;
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get asset history" });
  }
});

module.exports = router;
