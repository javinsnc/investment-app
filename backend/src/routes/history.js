const express = require("express");
const router = express.Router();
const { historyPortfolio, historyAsset } = require("../services/historyService");

// /api/history/portfolio?group=day|week|month|year&start=YYYY-MM-DD&end=YYYY-MM-DD&tickers=A,B&maxPoints=100
router.get("/portfolio", async (req, res) => {
  try {
    const group = (req.query.group || "day").toLowerCase();
    const start = req.query.start || null;
    const end = req.query.end || null;
    const tickers = (req.query.tickers || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const maxPoints = Number(req.query.maxPoints || 100);

    const data = await historyPortfolio({ start, end, tickers, group, maxPoints });
    res.json(data);
  } catch (err) {
    console.error("history/portfolio error", err);
    res.status(500).json({ error: "Failed to compute portfolio history" });
  }
});

// /api/history/asset/:ticker?group=...&start=...&end=...&maxPoints=100
router.get("/asset/:ticker", async (req, res) => {
  try {
    const ticker = String(req.params.ticker || "").trim();
    const group = (req.query.group || "day").toLowerCase();
    const start = req.query.start || null;
    const end = req.query.end || null;
    const maxPoints = Number(req.query.maxPoints || 100);

    const data = await historyAsset({ ticker, start, end, group, maxPoints });
    res.json(data);
  } catch (err) {
    console.error("history/asset error", err);
    res.status(500).json({ error: "Failed to compute asset history" });
  }
});

module.exports = router;
