const { Pool } = require("pg");

// Permite usar DATABASE_URL o variables separadas
function buildConfig() {
  const url = process.env.DATABASE_URL;
  const sslFlag = String(process.env.DB_SSL || process.env.DATABASE_SSL || "false").toLowerCase() === "true";
  const rejectUnauthorized =
      String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "false").toLowerCase() === "true";

  if (url) {
    return {
      connectionString: url,
      ssl: sslFlag ? { rejectUnauthorized } : false,
    };
  }

  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "app",
    password: process.env.DB_PASSWORD || "app",
    database: process.env.DB_NAME || "investment",
    ssl: sslFlag ? { rejectUnauthorized } : false,
  };
}

const pool = new Pool(buildConfig());

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
