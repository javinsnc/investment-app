const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const { bootstrap } = require("./bootstrap");
const assetsRoutes = require("./routes/assets");
const metricsRoutes = require("./routes/metrics");
const historyRoutes = require("./routes/history");
const operationsRoutes = require("./routes/operations");

const app = express();
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin:corsOrigin, credentials:true } : { origin:true, credentials:true }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req,res)=>res.json({ok:true}));
app.use("/api/assets", assetsRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/operations", operationsRoutes);

const PORT = process.env.PORT || 5050;
app.listen(PORT, async () => {
  console.log(`Backend listening on port ${PORT}`);
  try { await bootstrap(); console.log("Bootstrap OK"); } catch(e){ console.error("Bootstrap error:", e); }
});
