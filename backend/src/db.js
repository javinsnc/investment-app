const { Pool } = require("pg");
const fs = require("fs");

function normalizePem(pem) {
    if (!pem) return null;
    let s = String(pem).trim();
    if (s.includes("\\n") && !s.includes("\n")) s = s.replace(/\\n/g, "\n"); // por si la plataforma aplanó
    s = s.replace(/\r\n/g, "\n");
    const blocks = s
        .split(/(?=-----BEGIN CERTIFICATE-----)/g)
        .map(b => b.trim())
        .filter(b => b.startsWith("-----BEGIN CERTIFICATE-----") && b.endsWith("-----END CERTIFICATE-----"));
    return blocks.length ? blocks.join("\n") : null;
}

function loadCA() {
    // 1) Ruta de fichero (Secret File de Render recomendado)
    const path = process.env.PGSSL_CA || process.env.PGSSLROOTCERT || "/etc/secrets/aiven-ca.pem";
    try {
        const filePem = normalizePem(fs.readFileSync(path, "utf8"));
        if (filePem) return { source: `file:${path}`, caArray: filePem.split(/(?=-----BEGIN CERTIFICATE-----)/g) };
    } catch (_) {}

    // 2) Base64 (no necesita saltos de línea, ideal si no quieres Secret Files)
    const b64 = process.env.PGSSL_CA_BASE64 || process.env.PGSSL_CA_PEM_BASE64;
    if (b64) {
        try {
            const decoded = normalizePem(Buffer.from(b64, "base64").toString("utf8"));
            if (decoded) return { source: "env:base64", caArray: decoded.split(/(?=-----BEGIN CERTIFICATE-----)/g) };
        } catch (_) {}
    }

    // 3) PEM multilínea en env (no recomendado en Render; puede aplanar)
    const pemEnv = normalizePem(process.env.PGSSL_CA_PEM);
    if (pemEnv) return { source: "env:pem", caArray: pemEnv.split(/(?=-----BEGIN CERTIFICATE-----)/g) };

    return null;
}

function parseDbUrl(u) {
    try {
        const x = new URL(u);
        return {
            user: decodeURIComponent(x.username || ""),
            password: decodeURIComponent(x.password || ""),
            host: x.hostname,
            port: x.port ? Number(x.port) : undefined,
            database: x.pathname ? x.pathname.replace(/^\//, "") : undefined,
            search: x.search || "",
        };
    } catch { return {}; }
}

function buildConfig() {
    const url = process.env.DATABASE_URL;
    const parsed = url ? parseDbUrl(url) : {};
    const config = url
        ? { connectionString: url }
        : {
            host: process.env.PGHOST,
            port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD,
            database: process.env.PGDATABASE,
        };

    // SSL verify-full con CA (preferido)
    const caInfo = loadCA();
    if (caInfo) {
        config.ssl = {
            rejectUnauthorized: true,
            ca: caInfo.caArray, // puede contener cadena (intermedios + raíz)
            // SNI: usar el host de la URL o PGHOST
            servername: parsed.host || process.env.PGHOST,
        };
        console.log(`[db] SSL verify-full using ${caInfo.source} — blocks: ${caInfo.caArray.length}`);
        return config;
    }

    // Fallback explícito: si la URL pide "require", usar SSL sin verificación (temporal)
    if (parsed.search && /sslmode=require/i.test(parsed.search)) {
        config.ssl = { rejectUnauthorized: false, servername: parsed.host || process.env.PGHOST };
        console.log("[db] SSL require (no-verify) — CA not provided");
        return config;
    }

    // Sin SSL (no recomendado para Aiven)
    console.log("[db] SSL disabled — CA not provided and no sslmode=require in URL");
    return config;
}

const pool = new Pool(buildConfig());

pool.on("error", (err) => {
    console.error("Postgres pool error:", err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
