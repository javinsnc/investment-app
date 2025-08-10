const express = require("express");
const router = express.Router();
const db = require("../db");
const { recomputeCurrentAssets } = require("../bootstrap");

router.post("/", async (req, res) => {
  try {
    const { name, ticker, asset_type, side, op_date, price, quantity } = req.body || {};
    if (!name || !ticker || !asset_type || !op_date || price == null || quantity == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const sideNorm = String(side).toUpperCase() === "SELL" ? "SELL" : "BUY";
    await db.query(
      `INSERT INTO operations (name, ticker, asset_type, side, op_date, price, quantity)
       VALUES ($1,$2,$3,$4,$5,$6,$7);`,
      [name.trim(), ticker.trim(), asset_type.trim(), sideNorm, op_date, Number(price), Number(quantity)]
    );
    await recomputeCurrentAssets();
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error("Create operation error", e);
    res.status(500).json({ error: "Failed to create operation" });
  }
});

module.exports = router;
