const { Pool } = require("pg");
const fs = require("fs");

function getConfigFromEnv() {
    const url = process.env.DATABASE_URL;

    // Base config: URL o variables sueltas
    const cfg = url
        ? { connectionString: url }
        : {
            host: process.env.PGHOST || "db",
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || "app",
            password: process.env.PGPASSWORD || "app",
            database: process.env.PGDATABASE || "appdb",
        };

    // ---- SSL según Aiven/Render ----
    // Prioridad 1: PGSSL_CA_PEM (CA pegada en env) => verificación estricta
    const caPem = process.env.PGSSL_CA_PEM;

    if (caPem && caPem.includes("-----BEGIN CERTIFICATE-----")) {
        cfg.ssl = {
            rejectUnauthorized: true,
            ca: caPem,
        };
        return cfg;
    }

    // Prioridad 2: PGSSL_CA (ruta de fichero) por si algún día lo usas
    const caPath = process.env.PGSSL_CA || process.env.PGSSLROOTCERT;
    if (caPath) {
        try {
            const ca = fs.readFileSync(caPath, "utf8");
            cfg.ssl = { rejectUnauthorized: true, ca };
            return cfg;
        } catch (e) {
            console.warn("No pude leer CA en", caPath, e.message);
        }
    }

    // Prioridad 3: si la URL trae sslmode=require, habilita SSL sin verificación (salida de emergencia)
    if (url && /sslmode=require/i.test(url)) {
        cfg.ssl = { rejectUnauthorized: false };
        return cfg;
    }

    // Sin SSL por defecto (solo si nada lo pide)
    return cfg;
}

const pool = new Pool(getConfigFromEnv());

pool.on("error", (err) => {
    console.error("Postgres pool error:", err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
