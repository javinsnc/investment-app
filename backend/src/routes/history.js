const express = require("express");
const router = express.Router();
const db = require("../db");

function isISODate(s){ return typeof s==="string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function buildDateFilter(start,end,params){
  const where=[];
  if(start && isISODate(start)){ params.push(start); where.push(`p.date >= $${params.length}`); }
  if(end && isISODate(end)){ params.push(end); where.push(`p.date <= $${params.length}`); }
  return where.length ? `AND ${where.join(" AND ")}` : "";
}

router.get("/portfolio", async (req,res)=>{
  try{
    const group=(req.query.group||"day").toLowerCase();
    const allowed=new Set(["day","week","month","year"]);
    const unit=allowed.has(group)?group:"day";
    const start=req.query.start, end=req.query.end;
    const params=[unit]; const df=buildDateFilter(start,end,params);
    const q = `
      WITH positions AS ( SELECT ticker, quantity FROM current_assets ),
      prices_g AS (
        SELECT date_trunc($1, p.date)::date AS d, p.ticker, AVG(p.closing_price) AS price
        FROM prices p WHERE 1=1 ${df} GROUP BY 1, p.ticker
      )
      SELECT g.d AS date, COALESCE(SUM(g.price * pos.quantity),0) AS value
      FROM prices_g g LEFT JOIN positions pos ON pos.ticker = g.ticker
      GROUP BY 1 ORDER BY 1;
    `;
    const { rows } = await db.query(q, params);
    res.json(rows);
  }catch(e){ console.error(e); res.status(500).json({error:"Error getting portfolio history"}); }
});

router.get("/asset/:ticker", async (req,res)=>{
  try{
    const group=(req.query.group||"day").toLowerCase();
    const allowed=new Set(["day","week","month","year"]);
    const unit=allowed.has(group)?group:"day";
    const ticker=String(req.params.ticker); if(!ticker) return res.status(400).json({error:"ticker required"});
    const start=req.query.start, end=req.query.end;
    const params=[unit, ticker]; const df=buildDateFilter(start,end,params);
    const q = `
      WITH pos AS ( SELECT ticker, quantity FROM current_assets WHERE ticker=$2 ),
      prices_g AS (
        SELECT date_trunc($1, p.date)::date AS d, p.ticker, AVG(p.closing_price) AS price
        FROM prices p WHERE p.ticker=$2 ${df} GROUP BY 1, p.ticker
      )
      SELECT g.d AS date, COALESCE(MAX(g.price) * MAX(p.quantity),0) AS value
      FROM prices_g g LEFT JOIN pos p ON p.ticker=g.ticker
      GROUP BY 1 ORDER BY 1;
    `;
    const { rows } = await db.query(q, params);
    res.json(rows);
  }catch(e){ console.error(e); res.status(500).json({error:"Error getting asset history"}); }
});

module.exports = router;
