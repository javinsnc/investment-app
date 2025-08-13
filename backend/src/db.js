// backend/src/db.js
const { Pool } = require("pg");
const fs = require("fs");

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

const caPath = process.env.PGSSL_CA;
let ssl = caPath == null? false : { rejectUnauthorized: true, ca: fs.readFileSync(caPath, "utf8").toString() };

const parsed = parseDbUrl(process.env.DATABASE_URL);

const config = {
    user: parsed.user,
    password: parsed.password,
    host: parsed.host,
    port: parsed.port,
    database: parsed.database,
    ssl: ssl,
};

const pool = new Pool(config);

pool.on("error", (err) => console.error("Postgres pool error:", err));

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
