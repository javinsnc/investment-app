const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const { bootstrap } = require("./bootstrap");
const { runUpdateLastPrices } = require("./services/updateLastPricesService");
const db = require("./db"); // para health/db y apagado

const assetsRoutes = require("./routes/assets");
const metricsRoutes = require("./routes/metrics");
const historyRoutes = require("./routes/history");
const operationsRoutes = require("./routes/operations");
const updateLastPricesRoutes = require("./routes/updateLastPrices");

const app = express();

// ====== Log de entorno al inicio (con máscara) ======
(function logEnvAtStartup() {
  const maskDbUrl = (u) => (u ? u.replace(/:(?:[^:@]+)@/, ":****@") : "(none)");
  console.log("=== Environment at startup ===");
  console.log("NODE_ENV:", process.env.NODE_ENV || "(none)");
  console.log("PORT:", process.env.PORT || "(default 5050)");
  console.log("DATABASE_URL:", maskDbUrl(process.env.DATABASE_URL));
  console.log("PGHOST:", process.env.PGHOST || "(none)");
  console.log("PGPORT:", process.env.PGPORT || "(none)");
  console.log("PGUSER:", process.env.PGUSER || "(none)");
  console.log("PGDATABASE:", process.env.PGDATABASE || "(none)");
  console.log("PGSSLMODE:", process.env.PGSSLMODE || "(none)");
  console.log("PGSSL_CA set?:", !!process.env.PGSSL_CA);
  console.log("PGSSL_CA_PEM present?:", !!process.env.PGSSL_CA_PEM);
  console.log("CORS_ORIGIN:", process.env.CORS_ORIGIN || "(*)");
  console.log("UPDATE_ON_STARTUP:", process.env.UPDATE_ON_STARTUP ?? "(not set → default true)");
  console.log("==============================");
})();

// ====== Middlewares ======
const corsOrigin = process.env.CORS_ORIGIN;
app.use(
    cors(
        corsOrigin
            ? { origin: corsOrigin, credentials: true }
            : { origin: true, credentials: true }
    )
);
app.use(express.json());
app.use(morgan("dev"));

// ====== Health ======
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/health/dbtls", async (_req, res) => {
  let client;
  try {
    client = await db.pool.connect();
    const sock = client?.connection?.stream;
    const info = {
      ssl: !!sock,
      authorized: sock?.authorized ?? null,
      authorizationError: sock?.authorizationError ?? null,
    };
    if (sock && typeof sock.getPeerCertificate === "function") {
      const cert = sock.getPeerCertificate(true);
      info.peer = {
        subject: cert?.subject || null,
        issuer: cert?.issuer || null,
        valid_from: cert?.valid_from || null,
        valid_to: cert?.valid_to || null,
        subjectaltname: cert?.subjectaltname || null,
      };
    }
    res.json({ ok: true, info });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e.message || e) });
  } finally {
    if (client) client.release();
  }
});
app.get("/api/health/db", async (_req, res) => {
  try {
    const r = await db.query("SELECT NOW() AS now");
    res.json({ ok: true, now: r.rows?.[0]?.now });
  } catch (e) {
    console.error("DB health error:", e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// ====== Rutas ======
app.use("/api/assets", assetsRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/operations", operationsRoutes);
app.use("/api/updateLastPrices", updateLastPricesRoutes);

const PORT = process.env.PORT || 5050;
let server;

// ====== Bootstrap + arranque ======
(async () => {
  try {
    console.log("Starting backend...");
    await bootstrap(); // crea tablas / recomputa posiciones
  } catch (e) {
    console.error("Bootstrap error:", e);
  }

  // 1) Arranca el servidor ya
  server = app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });

  // 2) Lanza la actualización en background (no bloquea healthcheck)
  (async () => {
    try {
      if (process.env.UPDATE_ON_STARTUP !== "false") {
        console.log("Running updateLastPrices in background…");
        const report = await runUpdateLastPrices({ log: console.log });
        console.log("Initial updateLastPrices result:", report);
      } else {
        console.log("UPDATE_ON_STARTUP=false → skipping initial update.");
      }
    } catch (e) {
      console.error("Background updateLastPrices error:", e);
    }
  })();
})();

// ====== Apagado elegante ======
function shutdown(sig) {
  console.log(`Received ${sig}. Shutting down...`);
  if (server) {
    server.close(() => {
      console.log("HTTP server closed.");
      try {
        if (db?.pool?.end) {
          db.pool.end(() => {
            console.log("Postgres pool closed.");
            process.exit(0);
          });
        } else {
          process.exit(0);
        }
      } catch (e) {
        console.error("Error closing DB pool:", e);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = app;
