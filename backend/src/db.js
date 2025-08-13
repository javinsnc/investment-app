// backend/src/db.js
const { Pool } = require("pg");
const fs = require("fs");

const caPath = process.env.PGSSL_CA || "/etc/secrets/aiven-ca.pem";
let ssl = false;

try {
    const ca = fs.readFileSync(caPath, "utf8").toString();
    if (ca.includes("-----BEGIN CERTIFICATE-----")) {
        console.log(`[db] Using CA file: ${caPath}`);
        console.log("=== CA FILE CONTENT START ===");
        console.log(ca);
        console.log("=== CA FILE CONTENT END ===");
        ssl = { rejectUnauthorized: true, ca };
    }
} catch {
    console.log("[db] No CA file found — running without custom CA (ssl disabled for local).");
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl, // si hay CA => verify-full; si no => false (local)
});

pool.on("error", (err) => console.error("Postgres pool error:", err));

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
