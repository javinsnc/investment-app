const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const { bootstrap } = require("./bootstrap");
const { runUpdateLastPrices } = require("./services/updateLastPricesService");

const assetsRoutes = require("./routes/assets");
const metricsRoutes = require("./routes/metrics");
const historyRoutes = require("./routes/history");
const operationsRoutes = require("./routes/operations");
const updateLastPricesRoutes = require("./routes/updateLastPrices");

const app = express();
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin, credentials: true } : { origin: true, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/assets", assetsRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/operations", operationsRoutes);
app.use("/api/updateLastPrices", updateLastPricesRoutes);

const PORT = process.env.PORT || 5050;

(async () => {
  try {
    console.log("Starting backend...");
    await bootstrap();                     // crea tablas / recomputa posiciones
  } catch (e) {
    console.error("Bootstrap error:", e);
  }

  // 1) Arranca el servidor ya
  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });

  // 2) Lanza la actualización en background (no bloquea healthcheck)
  (async () => {
    try {
      if (process.env.UPDATE_ON_STARTUP !== "false") {
        console.log("Running updateLastPrices in background…");
        const report = await runUpdateLastPrices();
        console.log("Initial updateLastPrices result:", report);
      } else {
        console.log("UPDATE_ON_STARTUP=false → skipping initial update.");
      }
    } catch (e) {
      console.error("Background updateLastPrices error:", e);
    }
  })();
})();
