const db = require("../db");

/**
 * Inserta un registro en prices con (ticker, date, closing_price) si no existe ya.
 * - Usa la fecha de la operación y el precio unitario de la operación.
 * - Es idempotente (no duplica).
 *
 * @param {object} client - cliente de pg (transaccional si ya estás en BEGIN)
 * @param {string} ticker - identificador (ISIN/ticker)
 * @param {string|Date} date - fecha de la operación (YYYY-MM-DD o Date)
 * @param {number} unitPrice - precio unitario de la operación
 */
async function insertPriceIfMissing(client, ticker, date, unitPrice) {
    if (!ticker || !date || unitPrice == null) return;

    // normaliza a YYYY-MM-DD
    const iso = typeof date === "string"
        ? date.slice(0, 10)
        : new Date(date).toISOString().slice(0, 10);

    // Inserta solo si no existe ya ese (ticker, date)
    await client.query(
        `
    INSERT INTO prices (ticker, date, closing_price)
    SELECT $1, $2::date, $3
    WHERE NOT EXISTS (
      SELECT 1 FROM prices WHERE ticker = $1 AND date = $2::date
    )
    `,
        [ticker, iso, unitPrice]
    );
}

module.exports = { insertPriceIfMissing };
