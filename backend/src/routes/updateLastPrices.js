const express = require("express");
const router = express.Router();
const { runUpdateLastPrices } = require("../services/updateLastPricesService");

/**
 * POST /api/updateLastPrices
 * - sin query -> actualiza todos los fondos desfasados
 * - ?ticker=ISIN -> intenta solo ese fondo
 */
router.post("/", async (req, res) => {
    try {
        const ticker = (req.query.ticker || "").trim();
        const report = await runUpdateLastPrices({ ticker });
        res.json(report);
    } catch (e) {
        console.error("updateLastPrices error", e);
        res.status(500).json({ error: "Failed to update last prices", details: String(e.message || e) });
    }
});

module.exports = router;
