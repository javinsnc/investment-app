const { Pool } = require("pg");
const fs = require("fs");

function bool(v) {
    if (v == null) return false;
    const s = String(v).toLowerCase();
    return s === "1" || s === "true" || s === "yes" || s === "on";
}

function buildConfig() {
    const url = process.env.DATABASE_URL;
    const cfg = url
        ? { connectionString: url }
        : {
            host: process.env.PGHOST || "db",
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || "app",
            password: process.env.PGPASSWORD || "app",
            database: process.env.PGDATABASE || "appdb",
        };

    // SSL config
    const sslMode = (process.env.PGSSLMODE || "").toLowerCase();
    const forceSSL = bool(process.env.DATABASE_SSL);

    let ssl = false;

    // Si la URL ya lleva sslmode, respetamos; si no, usamos PGSSLMODE / DATABASE_SSL
    const urlHasSSL = !!(url && /sslmode=/i.test(url));
    const wantsVerifyFull =
        (sslMode === "verify-full") || (url && /sslmode=verify-full/i.test(url));
    const wantsRequire =
        (sslMode === "require") || (url && /sslmode=require/i.test(url)) || forceSSL;
    const wantsDisable =
        (sslMode === "disable") || (url && /sslmode=disable/i.test(url));

    if (wantsDisable) {
        ssl = false;
    } else if (wantsVerifyFull) {
        // CA por fichero o por env directa
        const caPath = process.env.PGSSL_CA || process.env.PGSSLROOTCERT;
        const caPemEnv = process.env.PGSSL_CA_PEM;
        let ca;
        if (caPemEnv && caPemEnv.trim().startsWith("-----BEGIN CERTIFICATE-----")) {
            ca = caPemEnv;
        } else if (caPath) {
            try {
                ca = fs.readFileSync(caPath, "utf8");
            } catch (e) {
                console.warn("PG verify-full: no pude leer CA en", caPath, e.message);
            }
        }
        ssl = ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true };
    } else if (wantsRequire) {
        // SSL sin verificación (self-signed)
        ssl = { rejectUnauthorized: false };
    } else if (!urlHasSSL && sslMode === "") {
        // Por defecto: sin SSL (solo si nada lo pide)
        ssl = false;
    }

    if (ssl) cfg.ssl = ssl;
    return cfg;
}

const pool = new Pool(buildConfig());

pool.on("error", (err) => {
    console.error("Postgres pool error:", err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
