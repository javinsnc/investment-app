const express = require("express");
const db = require("../db");
const { runUpdateLastPrices } = require("../services/updateLastPricesService");

const router = express.Router();

/** Fecha YYYY-MM-DD en zona Europe/Madrid */
function todayMadridISO() {
    const fmt = new Intl.DateTimeFormat("en-CA", { // en-CA => YYYY-MM-DD
        timeZone: "Europe/Madrid",
        year: "numeric", month: "2-digit", day: "2-digit",
    });
    // Intl en-CA devuelve "YYYY-MM-DD"
    return fmt.format(new Date());
}

/** Inserta registro 'pending' para el día; devuelve id o null si ya existe */
async function tryCreatePending(runDate) {
    const { rows } = await db.query(
        `INSERT INTO price_update_runs (run_date, status)
     VALUES ($1::date, 'pending')
     ON CONFLICT (run_date) DO NOTHING
     RETURNING id`,
        [runDate]
    );
    return rows[0]?.id || null;
}

/** Marca OK/ERROR */
async function finalizeRun(id, status, reportOrError) {
    if (!id) return;
    if (status === "ok") {
        const updated_count = Number(reportOrError?.updated || reportOrError?.updatedCount || 0);
        await db.query(
            `UPDATE price_update_runs
       SET finished_at = now(), status = 'ok', updated_count = $2, details = $3
       WHERE id = $1`,
            [id, updated_count, JSON.stringify(reportOrError || {})]
        );
    } else {
        await db.query(
            `UPDATE price_update_runs
       SET finished_at = now(), status = 'error', details = $2
       WHERE id = $1`,
            [id, JSON.stringify({ message: String(reportOrError?.message || reportOrError), stack: reportOrError?.stack || null })]
        );
    }
}

/**
 * Middleware: requiere secreto para el endpoint seguro
 * - Cabecera:  X-CRON-KEY: <secreto>
 * - o query:   ?key=<secreto>
 */
function requireCronSecret(req, res, next) {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        return res.status(500).json({ error: "CRON_SECRET is not set on server" });
    }
    const provided = req.get("x-cron-key") || req.query.key;
    if (!provided || provided !== expected) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
}

/**
 * Lógica común: respeta "una vez al día (Madrid)"; permitir ?force=1
 */
async function handleRun(req, res) {
    try {
        const { ticker, force } = req.query || {};
        const runDate = todayMadridISO();

        let runId = null;

        if (String(force) === "1" || String(force).toLowerCase() === "true") {
            // Forzamos: insertamos pending si no existe (si existe, lo reutilizamos para anotar fin)
            const { rows } = await db.query(
                `INSERT INTO price_update_runs (run_date, status)
         VALUES ($1::date, 'pending')
         ON CONFLICT (run_date) DO UPDATE SET status = EXCLUDED.status
         RETURNING id`,
                [runDate]
            );
            runId = rows[0]?.id || null;
        } else {
            // Modo normal: si ya hay registro del día, no repetimos
            runId = await tryCreatePending(runDate);
            if (!runId) {
                return res.status(200).json({ ok: false, skipped: true, reason: "already-ran-today", run_date: runDate });
            }
        }

        // Ejecuta la actualización
        const report = await runUpdateLastPrices(ticker ? String(ticker) : undefined);

        // Marca OK y devuelve reporte
        await finalizeRun(runId, "ok", report);
        return res.json({ ok: true, run_date: runDate, ...report });
    } catch (e) {
        console.error("updateLastPrices error:", e);
        // Si habíamos creado 'pending' pero no tenemos id, no podemos marcar. Para simplificar, solo marcamos si hubo id.
        // (En este flujo sí solemos tener id salvo error muy temprano.)
        // Intento: localizar el 'pending' del día y marcar error:
        try {
            const runDate = todayMadridISO();
            const { rows } = await db.query(`SELECT id FROM price_update_runs WHERE run_date = $1::date`, [runDate]);
            if (rows[0]?.id) {
                await finalizeRun(rows[0].id, "error", e);
            }
        } catch (_) {}
        return res.status(500).json({ error: "Failed to update last prices" });
    }
}

/**
 * POST /api/updateLastPrices  (UI) — sin secreto.
 * Param: ?ticker=ISIN (opcional), ?force=1 (opcional)
 */
router.post("/", handleRun);

/**
 * POST /api/updateLastPrices/secure  (CRON) — con secreto.
 * Param: ?ticker=ISIN (opcional), ?force=1 (opcional)
 */
router.post("/secure", requireCronSecret, handleRun);

module.exports = router;
