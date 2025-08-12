const express = require("express");
const router = express.Router();
const db = require("../db");

// Usa SIEMPRE pd.date (per_day alias) en el GROUP BY final
function bucketExpr(group) {
  switch ((group || "day").toLowerCase()) {
    case "week":  return "date_trunc('week', pd.date)::date";
    case "month": return "date_trunc('month', pd.date)::date";
    case "year":  return "date_trunc('year', pd.date)::date";
    case "day":
    default:      return "pd.date::date";
  }
}

function downsample(rows, maxPoints = 100) {
  const n = Number(maxPoints) || 100;
  if (rows.length <= n) return rows;
  const step = Math.ceil(rows.length / n);
  const out = [];
  for (let i = 0; i < rows.length; i += step) out.push(rows[i]);
  if (out[out.length - 1]?.date !== rows[rows.length - 1]?.date) out.push(rows[rows.length - 1]);
  return out;
}

router.get("/portfolio", async (req, res) => {
  try {
    const group = (req.query.group || "day").toLowerCase();
    const start = req.query.start || null;
    const end = req.query.end || null;
    const tickers = (req.query.tickers || "").split(",").map(s => s.trim()).filter(Boolean);
    const maxPoints = Number(req.query.maxPoints || 100);
    const bucket = bucketExpr(group);

    const params = [start, end];
    let tickersFilterSQL = "";
    if (tickers.length) {
      params.push(tickers);
      tickersFilterSQL = "WHERE t.ticker = ANY($3)";
    }

    const sql = `
      WITH bounds AS (
        SELECT 
          COALESCE($1::date, (SELECT MIN(op_date)::date FROM operations)) AS start_date,
          COALESCE($2::date, CURRENT_DATE) AS end_date
      ),
      dates AS (
        SELECT gs::date AS d
        FROM bounds, generate_series((SELECT start_date FROM bounds), (SELECT end_date FROM bounds), '1 day') AS gs
      ),
      tickers AS ( SELECT DISTINCT ca.ticker FROM current_assets ca ),
      t AS ( SELECT * FROM tickers ),
      t_sel AS ( SELECT t.ticker FROM t ${tickersFilterSQL} ),
      grid AS (
        SELECT t_sel.ticker, d.d AS date
        FROM t_sel CROSS JOIN dates d
      ),
      ops_by_day AS (
        SELECT 
          o.ticker,
          o.op_date::date AS date,
          SUM(CASE WHEN o.side='BUY' THEN o.quantity ELSE -o.quantity END)::numeric AS delta
        FROM operations o
        JOIN t_sel ON t_sel.ticker = o.ticker
        GROUP BY 1,2
      ),
      ops_cum AS (
        SELECT
          ob.ticker,
          ob.date,
          SUM(ob.delta) OVER (PARTITION BY ob.ticker ORDER BY ob.date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_qty
        FROM ops_by_day ob
      ),
      holdings AS (
        SELECT
          g.ticker,
          g.date,
          COALESCE(oc.cum_qty, 0) AS qty
        FROM grid g
        LEFT JOIN LATERAL (
          SELECT cum_qty
          FROM ops_cum oc
          WHERE oc.ticker = g.ticker AND oc.date <= g.date
          ORDER BY oc.date DESC
          LIMIT 1
        ) oc ON true
      ),
      prices_ff AS (
        SELECT
          g.ticker,
          g.date,
          lp.closing_price AS price
        FROM grid g
        LEFT JOIN LATERAL (
          SELECT closing_price
          FROM prices p
          WHERE p.ticker = g.ticker AND p.date <= g.date
          ORDER BY p.date DESC
          LIMIT 1
        ) lp ON true
      ),
      per_day AS (
        SELECT
          h.date,
          SUM(h.qty * COALESCE(pf.price,0)) AS total_value
        FROM holdings h
        JOIN prices_ff pf ON pf.ticker = h.ticker AND pf.date = h.date
        GROUP BY 1
      )
      SELECT ${bucket} AS bucket, SUM(pd.total_value) AS total_value
      FROM per_day pd
      GROUP BY 1
      ORDER BY 1 ASC;
    `;

    const { rows } = await db.query(sql, params);
    const series = rows.map(r => ({
      date: (r.bucket instanceof Date ? r.bucket.toISOString().slice(0,10) : String(r.bucket)),
      value: Number(r.total_value || 0),
    }));
    res.json(downsample(series, maxPoints));
  } catch (err) {
    console.error("history/portfolio error", err);
    res.status(500).json({ error: "Failed to compute portfolio history" });
  }
});

router.get("/asset/:ticker", async (req, res) => {
  try {
    const ticker = String(req.params.ticker || "").trim();
    const group = (req.query.group || "day").toLowerCase();
    const start = req.query.start || null;
    const end = req.query.end || null;
    const maxPoints = Number(req.query.maxPoints || 100);

    const bucket = (function(){
      switch (group) {
        case "week":  return "date_trunc('week', pd.date)::date";
        case "month": return "date_trunc('month', pd.date)::date";
        case "year":  return "date_trunc('year', pd.date)::date";
        case "day":
        default:      return "pd.date::date";
      }
    })();

    const sql = `
      WITH bounds AS (
        SELECT 
          COALESCE($2::date, (SELECT MIN(op_date)::date FROM operations WHERE ticker=$1)) AS start_date,
          COALESCE($3::date, CURRENT_DATE) AS end_date
      ),
      dates AS (
        SELECT gs::date AS d
        FROM bounds, generate_series((SELECT start_date FROM bounds), (SELECT end_date FROM bounds), '1 day') AS gs
      ),
      grid AS ( SELECT $1::text AS ticker, d.d AS date FROM dates d ),
      ops_by_day AS (
        SELECT o.ticker, o.op_date::date AS date,
               SUM(CASE WHEN o.side='BUY' THEN o.quantity ELSE -o.quantity END)::numeric AS delta
        FROM operations o
        WHERE o.ticker = $1
        GROUP BY 1,2
      ),
      ops_cum AS (
        SELECT ob.ticker, ob.date,
               SUM(ob.delta) OVER (PARTITION BY ob.ticker ORDER BY ob.date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_qty
        FROM ops_by_day ob
      ),
      holdings AS (
        SELECT
          g.ticker,
            g.date,
          COALESCE(oc.cum_qty, 0) AS qty
        FROM grid g
        LEFT JOIN LATERAL (
          SELECT cum_qty
          FROM ops_cum oc
          WHERE oc.ticker = g.ticker AND oc.date <= g.date
          ORDER BY oc.date DESC
          LIMIT 1
        ) oc ON true
      ),
      prices_ff AS (
        SELECT
          g.ticker,
          g.date,
          lp.closing_price AS price
        FROM grid g
        LEFT JOIN LATERAL (
          SELECT closing_price
          FROM prices p
          WHERE p.ticker = g.ticker AND p.date <= g.date
          ORDER BY p.date DESC
          LIMIT 1
        ) lp ON true
      ),
      per_day AS (
        SELECT h.date, (h.qty * COALESCE(pf.price,0)) AS total_value
        FROM holdings h
        JOIN prices_ff pf ON pf.ticker = h.ticker AND pf.date = h.date
      )
      SELECT ${bucket} AS bucket, SUM(per_day.total_value) AS total_value
      FROM per_day pd
      GROUP BY 1
      ORDER BY 1 ASC;
    `;

    const { rows } = await db.query(sql, [ticker, start, end]);
    const series = rows.map(r => ({
      date: (r.bucket instanceof Date ? r.bucket.toISOString().slice(0,10) : String(r.bucket)),
      value: Number(r.total_value || 0),
    }));
    res.json(downsample(series, maxPoints));
  } catch (err) {
    console.error("history/asset error", err);
    res.status(500).json({ error: "Failed to compute asset history" });
  }
});

module.exports = router;
