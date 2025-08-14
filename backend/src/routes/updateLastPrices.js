const express = require("express");
const router = express.Router();
const { runUpdateLastPrices } = require("../services/updateLastPricesService");

function requireCronSecret(req, res, next) {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        return res.status(500).json({ error: "CRON_SECRET is not set on server" });
    }
    const provided = req.get("x-cron-key") || req.query.key;
    if (!provided || provided !== expected) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
}

function updateLastPrices() {
    return async (req, res) => {
        try {
            const ticker = (req.query.ticker || "").trim();
            const report = await runUpdateLastPrices({ticker});
            res.json(report);
        } catch (e) {
            console.error("updateLastPrices error", e);
            res.status(500).json({error: "Failed to update last prices", details: String(e.message || e)});
        }
    };
}

/**
 * POST /api/updateLastPrices
 * - sin query -> actualiza todos los fondos desfasados
 * - ?ticker=ISIN -> intenta solo ese fondo
 */
router.post("/", updateLastPrices());
router.post("/secure", requireCronSecret, updateLastPrices());

module.exports = router;
