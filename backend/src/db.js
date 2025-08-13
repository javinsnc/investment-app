// backend/src/db.js
const {Pool} = require("pg");
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

function calculateSslConfig(url) {
    // ---- SSL ----
    //  - require      => SSL, sin verificar CA (útil para self-signed) -> rejectUnauthorized: false
    //  - verify-full  => SSL verificando CA (usa PGSSL_CA o PGSSLROOTCERT)

    let ssl;
    if (url && /sslmode=(require|verify-full)/i.test(url)) {
        // Si viene en la URL
        if (/sslmode=verify-full/i.test(url)) {
            const caPath = process.env.PGSSL_CA;
            if (!caPath) {
                throw new Error("No CA provided. Set PGSSL_CA or PGSSLROOTCERT environment variable.");
            } else if (!fs.existsSync(caPath)) {
                throw new Error(`CA file not found at ${caPath}`);
            }

            ssl = {
                rejectUnauthorized: true,
                ca: fs.readFileSync(caPath, "utf8").toString(),
            }
        } else {
            ssl = {
                rejectUnauthorized: false
            };
        }
    } else {
        ssl = false;
    }
    return ssl;
}

const url = process.env.DATABASE_URL;
const parsed = parseDbUrl(url);

const config = {
    user: parsed.user,
    password: parsed.password,
    host: parsed.host,
    port: parsed.port,
    database: parsed.database,
    ssl: calculateSslConfig(url),
};

const pool = new Pool(config);

pool.on("error", (err) => console.error("Postgres pool error:", err));

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
