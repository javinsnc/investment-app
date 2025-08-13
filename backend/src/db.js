// backend/src/db.js
const { Pool } = require("pg");
const fs = require("fs");

const caPath = process.env.PGSSL_CA || "/etc/secrets/aiven-ca.pem";
let ssl = false;

try {
    const ca = fs.readFileSync(caPath, "utf8");
    if (ca.includes("-----BEGIN CERTIFICATE-----")) {
        console.log(`[db] Using CA file: ${caPath}`);
        console.log("=== CA FILE CONTENT START ===");
        console.log(ca);
        console.log("=== CA FILE CONTENT END ===");
        ssl = { rejectUnauthorized: true, ca: ca.toString() };
    }
} catch {
    console.log("[db] No CA file found — running without custom CA (ssl disabled for local).");
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
        };
    } catch {
        return {};
    }
}

const parsed = process.env.DATABASE_URL ? parseDbUrl(process.env.DATABASE_URL) : {};

const user = parsed.user
const password = parsed.password
const host = parsed.host
const port = parsed.port
const database = parsed.database

const config = {
    user,
    password,
    host,
    port,
    database,
    ssl: ssl,
};

console.log(`Config is ${JSON.stringify(config, null, 2)}`);

// ===== 4) Pool y export =====
const pool = new Pool(config);

pool.on("error", (err) => console.error("Postgres pool error:", err));

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
