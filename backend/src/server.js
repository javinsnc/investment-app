const express = require("express");
const morgan = require("morgan");
const cors = require("cors");

const assetsRoutes = require("./routes/assets");
const metricsRoutes = require("./routes/metrics");
const historyRoutes = require("./routes/history");

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/assets", assetsRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/history", historyRoutes);

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
