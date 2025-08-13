const { Pool } = require("pg");
const fs = require("fs");
const { URL } = require("url");

function readCaFromEnv() {
    // Preferimos PEM directo (multilínea)
    const pem = process.env.PGSSL_CA_PEM;
    if (pem && pem.includes("-----BEGIN CERTIFICATE-----")) {
        return pem;
    }
    // Alternativa: base64 si la plataforma rompiera saltos de línea
    const b64 = process.env.PGSSL_CA_BASE64 || process.env.PGSSL_CA_PEM_BASE64;
    if (b64) {
        try {
            const decoded = Buffer.from(b64, "base64").toString("utf8");
            if (decoded.includes("-----BEGIN CERTIFICATE-----")) return decoded;
        } catch (_) {}
    }
    // Alternativa por ruta de fichero
    const caPath = process.env.PGSSL_CA || process.env.PGSSLROOTCERT;
    if (caPath) {
        try { return fs.readFileSync(caPath, "utf8"); } catch (_) {}
    }
    return null;
}

function getHostFromUrl(u) {
    try { return new URL(u).hostname; } catch { return null; }
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

    // Determinar host para SNI (CN/SAN debe coincidir)
    const hostForSNI =
        (url && getHostFromUrl(url)) ||
        process.env.PGHOST ||
        undefined;

    // 1) Si tenemos CA (PEM o base64), hacemos verify-full real
    const caPem = readCaFromEnv();
    if (caPem) {
        // Si Aiven te da cadena (raíz + intermedios), pégala TODA en PGSSL_CA_PEM.
        // Pasamos como array para que 'pg' la trate como cadena de CA.
        const caArray = caPem
            .split(/(?=-----BEGIN CERTIFICATE-----)/g)
            .map(s => s.trim())
            .filter(Boolean);

        cfg.ssl = {
            rejectUnauthorized: true,
            ca: caArray,
            ...(hostForSNI ? { servername: hostForSNI } : {}),
        };
        return cfg;
    }

    // 2) Sin CA pero con sslmode=require en la URL -> SSL sin verificación (escape)
    if (url && /sslmode=require/i.test(url)) {
        cfg.ssl = { rejectUnauthorized: false, ...(hostForSNI ? { servername: hostForSNI } : {}) };
        return cfg;
    }

    // 3) Por defecto, sin SSL
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
