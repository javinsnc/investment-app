import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api";
import { t } from "../utils/i18n";
import { fmtCurrency, PIE_COLORS } from "../utils/format";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    LineChart,
    Line,
    ComposedChart,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend,
} from "recharts";

function isoTodayMinus(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

const TOTAL_KEY = "__TOTAL__";
const TOTAL_COLOR = "#1E3A8A";

function colorFor(index) {
    return PIE_COLORS[index % PIE_COLORS.length];
}

// Construye filas planas para recharts a partir de { total, byTicker }
function buildRows(total, byTicker, tickers) {
    const rows = total.map((p) => ({ date: p.date, [TOTAL_KEY]: p.value }));
    const idx = new Map(rows.map((r, i) => [r.date, i]));
    for (const tk of tickers) {
        const series = byTicker[tk] || [];
        for (const p of series) {
            const i = idx.get(p.date);
            if (i != null) rows[i][tk] = p.value;
        }
    }
    return rows;
}

// Rebase a 100 desde el primer valor > 0 de cada clave
function rebaseRows(rows, keys) {
    const bases = {};
    for (const r of rows) {
        for (const k of keys) {
            if (bases[k] == null && r[k] != null && r[k] > 0) bases[k] = r[k];
        }
    }
    return rows.map((r) => {
        const out = { date: r.date };
        for (const k of keys) {
            if (bases[k] != null && r[k] != null && r[k] > 0) {
                out[k] = (r[k] / bases[k]) * 100;
            }
        }
        return out;
    });
}

export default function Performance() {
    const [assets, setAssets] = useState([]);
    const [data, setData] = useState({ total: [], byTicker: {} });
    const [singleSeries, setSingleSeries] = useState([]);
    const [err, setErr] = useState("");
    const [group, setGroup] = useState("day");
    const [assetSel, setAssetSel] = useState("ALL");
    const [view, setView] = useState("A"); // A=Cartera €, B=Fondos %
    const [from, setFrom] = useState(isoTodayMinus(30));
    const [to, setTo] = useState(isoTodayMinus(0));
    const [hidden, setHidden] = useState(() => new Set());

    useEffect(() => {
        api.get("/api/assets").then(r => setAssets(r.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        const run = async () => {
            try {
                setErr("");
                const params = { group, start: from, end: to, maxPoints: 200 };
                if (assetSel === "ALL") {
                    const { data: d } = await api.get("/api/history/portfolio", {
                        params: { ...params, breakdown: true },
                    });
                    setData(d || { total: [], byTicker: {} });
                } else {
                    const { data: d } = await api.get(`/api/history/asset/${assetSel}`, { params });
                    setSingleSeries(d || []);
                }
            } catch (e) {
                console.error(e);
                setErr("Failed to load performance");
            }
        };
        run();
    }, [assetSel, group, from, to]);

    const tickers = useMemo(() => Object.keys(data.byTicker || {}).sort(), [data]);
    const tickerNameMap = useMemo(() => {
        const m = {};
        for (const a of assets) m[a.ticker] = a.name || a.ticker;
        return m;
    }, [assets]);
    const colorMap = useMemo(() => {
        const m = {};
        tickers.forEach((tk, i) => { m[tk] = colorFor(i); });
        return m;
    }, [tickers]);

    const rowsAbs = useMemo(() => buildRows(data.total || [], data.byTicker || {}, tickers), [data, tickers]);
    const rowsRel = useMemo(() => rebaseRows(rowsAbs, [TOTAL_KEY, ...tickers]), [rowsAbs, tickers]);

    const isHidden = (k) => hidden.has(k);
    const toggle = (k) => setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(k)) next.delete(k); else next.add(k);
        return next;
    });

    const yTickEUR = (v) => fmtCurrency.format(Number(v) || 0);
    const yTickPct = (v) => `${Number(v).toFixed(0)}`;
    const fmtEUR = (v) => fmtCurrency.format(Number(v) || 0);
    const fmtPct = (v) => `${Number(v).toFixed(2)} (base 100)`;
    const labelFor = (k) => k === TOTAL_KEY ? t("allAssets") : (tickerNameMap[k] || k);

    const controlClass = "h-10 border rounded px-3";
    const tabBtn = (active) =>
        `h-10 px-4 rounded ${active ? "bg-blue-700 text-white" : "bg-gray-100 text-gray-700"}`;

    const allView = assetSel === "ALL";

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">{t("performancePage")}</h1>

            <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">{t("assetLabel")}</label>
                    <select className={controlClass} value={assetSel} onChange={(e) => setAssetSel(e.target.value)}>
                        <option value="ALL">{t("allAssets")}</option>
                        {assets.map(a => (
                            <option key={a.ticker} value={a.ticker}>{a.ticker}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">{t("timeRange")}</label>
                    <select className={controlClass} value={group} onChange={(e) => setGroup(e.target.value)}>
                        <option value="day">{t("days")}</option>
                        <option value="week">{t("weeks")}</option>
                        <option value="month">{t("months")}</option>
                        <option value="year">{t("years")}</option>
                    </select>
                </div>

                <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">{t("from")}</label>
                    <input type="date" className={controlClass} value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>

                <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">{t("to")}</label>
                    <input type="date" className={controlClass} value={to} onChange={(e) => setTo(e.target.value)} />
                </div>

                {allView && (
                    <div className="flex gap-2 ml-auto">
                        <button className={tabBtn(view === "A")} onClick={() => setView("A")}>{t("viewPortfolio")}</button>
                        <button className={tabBtn(view === "B")} onClick={() => setView("B")}>{t("viewFundsPct")}</button>
                    </div>
                )}
            </div>

            {err && <p className="text-red-600 text-sm">{err}</p>}

            <div className="w-full h-[28rem] bg-white border border-gray-100 rounded-2xl p-3">
                {!allView ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={singleSeries}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis tickFormatter={yTickEUR} width={130} tickMargin={12} />
                            <Tooltip formatter={(v) => fmtEUR(v)} />
                            <Area type="monotone" dataKey="value" stroke={TOTAL_COLOR} fill="#3B82F6" fillOpacity={0.3} strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : view === "A" ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={rowsAbs}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis tickFormatter={yTickEUR} width={130} tickMargin={12} />
                            <Tooltip formatter={(v, name) => [fmtEUR(v), labelFor(name)]} />
                            <Legend onClick={(o) => toggle(o.dataKey)} formatter={(value, entry) => labelFor(entry.dataKey)} />
                            {tickers.map((tk) => (
                                <Area
                                    key={tk}
                                    type="monotone"
                                    dataKey={tk}
                                    stackId="stack"
                                    stroke={colorMap[tk]}
                                    fill={colorMap[tk]}
                                    fillOpacity={0.55}
                                    hide={isHidden(tk)}
                                />
                            ))}
                            <Line
                                type="monotone"
                                dataKey={TOTAL_KEY}
                                stroke={TOTAL_COLOR}
                                strokeWidth={3}
                                dot={false}
                                hide={isHidden(TOTAL_KEY)}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={rowsRel}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis tickFormatter={yTickPct} width={70} tickMargin={6} domain={[(min) => Math.floor(min) - 1, (max) => Math.ceil(max) + 1]} />
                            <Tooltip formatter={(v, name) => [fmtPct(v), labelFor(name)]} />
                            <Legend onClick={(o) => toggle(o.dataKey)} formatter={(value, entry) => labelFor(entry.dataKey)} />
                            {tickers.map((tk) => (
                                <Line
                                    key={tk}
                                    type="monotone"
                                    dataKey={tk}
                                    stroke={colorMap[tk]}
                                    strokeWidth={1.5}
                                    dot={false}
                                    hide={isHidden(tk)}
                                />
                            ))}
                            <Line
                                type="monotone"
                                dataKey={TOTAL_KEY}
                                stroke={TOTAL_COLOR}
                                strokeWidth={3}
                                dot={false}
                                hide={isHidden(TOTAL_KEY)}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
