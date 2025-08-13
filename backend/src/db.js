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
    // 1) Ruta de fichero (Secret File recomendado en Render)
    const candidPaths = [
        process.env.PGSSL_CA,
        process.env.PGSSLROOTCERT,
        "/etc/secrets/aiven-ca.pem", // fallback típico
    ].filter(Boolean);
    for (const p of candidPaths) {
        try {
            const pem = normalizePem(fs.readFileSync(p, "utf8"));
            if (pem) return { source: `file:${p}`, caArray: pem.split(/(?=-----BEGIN CERTIFICATE-----)/g) };
        } catch {}
    }

    // 2) Base64 (sin problema de saltos de línea)
    const b64 = process.env.PGSSL_CA_BASE64 || process.env.PGSSL_CA_PEM_BASE64;
    if (b64) {
        try {
            const decoded = normalizePem(Buffer.from(b64, "base64").toString("utf8"));
            if (decoded) return { source: "env:base64", caArray: decoded.split(/(?=-----BEGIN CERTIFICATE-----)/g) };
        } catch {}
    }

    // 3) PEM multilínea en env (ojo en Render puede aplanar)
    const pemEnv = normalizePem(process.env.PGSSL_CA_PEM);
    if (pemEnv) return { source: "env:pem", caArray: pemEnv.split(/(?=-----BEGIN CERTIFICATE-----)/g) };

    return null;
}

function parseDbUrl(u) {
    try {
        const url = new URL(u);
        // Nota: url.search incluye el "?" (p.ej. "?sslmode=verify-full")
        return {
            user: decodeURIComponent(url.username || ""),
            password: decodeURIComponent(url.password || ""),
            host: url.hostname,
            port: url.port ? Number(url.port) : undefined,
            database: url.pathname ? url.pathname.replace(/^\//, "") : undefined,
            search: url.search || "",
            sslmode: (url.searchParams.get("sslmode") || "").toLowerCase(), // <-- limpio
            raw: url,
        };
    } catch {
        return {};
    }
}

function looksLikeAivenHost(h) {
    return typeof h === "string" && /\.aivencloud\.com$/i.test(h);
}

function buildConfig() {
    const hasUrl = !!process.env.DATABASE_URL;
    const parsed = hasUrl ? parseDbUrl(process.env.DATABASE_URL) : {};
    const cfg = hasUrl
        ? { connectionString: process.env.DATABASE_URL }
        : {
            host: process.env.PGHOST,
            port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD,
            database: process.env.PGDATABASE,
        };

    const host = parsed.host || process.env.PGHOST;
    const caInfo = loadCA();

    // Caso preferido: tenemos CA válida -> verify-full real
    if (caInfo) {
        cfg.ssl = {
            rejectUnauthorized: true,
            ca: caInfo.caArray,        // admite cadena (intermedios + raíz)
            servername: host,          // SNI para CN/SAN
        };
        console.log(`[db] SSL verify-full using ${caInfo.source} — blocks: ${caInfo.caArray.length}`);
        return cfg;
    }

    // Sin CA cargado:
    // 1) Si sslmode=verify-full pero NO hay CA → degradar a require (no-verify) con aviso
    if (parsed.sslmode === "verify-full") {
        cfg.ssl = { rejectUnauthorized: false, servername: host };
        console.warn("[db] WARNING: sslmode=verify-full sin CA → degradando a 'require' (no-verify). Carga el CA para verificación estricta.");
        return cfg;
    }

    // 2) Si sslmode=require → no-verify
    if (parsed.sslmode === "require") {
        cfg.ssl = { rejectUnauthorized: false, servername: host };
        console.log("[db] SSL require (no-verify) — no CA provided");
        return cfg;
    }

    // 3) Si no hay sslmode pero el host parece de Aiven → fuerza require (para no romper)
    if (!parsed.sslmode && looksLikeAivenHost(host)) {
        cfg.ssl = { rejectUnauthorized: false, servername: host };
        console.log("[db] SSL require (no-verify) — inferred by aiven host and no CA provided");
        return cfg;
    }

    // 4) Sin SSL (solo si el servicio lo permite)
    console.log("[db] SSL disabled — no CA and no sslmode");
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
