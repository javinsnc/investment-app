import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api";
import { t } from "../utils/i18n";
import { fmtCurrency, PIE_COLORS } from "../utils/format";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from "recharts";

const TOTAL_COLOR = "#1E3A8A";
const TOTAL_FILL = "#3B82F6";

function isoToday() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

function colorFor(i) {
    return PIE_COLORS[i % PIE_COLORS.length];
}

function pctReturn(series) {
    if (!series || series.length === 0) return null;
    const first = series.find((p) => p.value > 0);
    const last = [...series].reverse().find((p) => p.value > 0);
    if (!first || !last || first.value === 0) return null;
    return (last.value / first.value - 1) * 100;
}

function FundChart({ data, color }) {
    return (
        <div className="w-full h-64 bg-white border border-gray-100 rounded-2xl p-3">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis
                        tickFormatter={(v) => fmtCurrency.format(Number(v) || 0)}
                        width={110}
                        tickMargin={10}
                        domain={["auto", "auto"]}
                    />
                    <Tooltip formatter={(v) => fmtCurrency.format(Number(v) || 0)} />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        fill={color}
                        fillOpacity={0.3}
                        strokeWidth={2}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export default function Performance() {
    const [assets, setAssets] = useState([]);
    const [data, setData] = useState({ total: [], byTicker: {} });
    const [err, setErr] = useState("");
    const [group, setGroup] = useState("day");
    const [from, setFrom] = useState("2025-09-01");
    const [to, setTo] = useState(isoToday());
    const [expanded, setExpanded] = useState(() => new Set());

    useEffect(() => {
        api.get("/api/assets").then((r) => setAssets(r.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        const run = async () => {
            try {
                setErr("");
                const params = { group, start: from, end: to, maxPoints: 200, breakdown: true };
                const { data: d } = await api.get("/api/history/portfolio", { params });
                setData(d || { total: [], byTicker: {} });
            } catch (e) {
                console.error(e);
                setErr("Failed to load performance");
            }
        };
        run();
    }, [group, from, to]);

    const tickers = useMemo(() => Object.keys(data.byTicker || {}).sort(), [data]);
    const nameFor = useMemo(() => {
        const m = {};
        for (const a of assets) m[a.ticker] = a.name || a.ticker;
        return (tk) => m[tk] || tk;
    }, [assets]);
    const colorMap = useMemo(() => {
        const m = {};
        tickers.forEach((tk, i) => { m[tk] = colorFor(i); });
        return m;
    }, [tickers]);

    const toggle = (tk) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(tk)) next.delete(tk); else next.add(tk);
            return next;
        });

    const controlClass = "h-10 border rounded px-3";

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">{t("performancePage")}</h1>

            <div className="flex flex-wrap gap-3 items-end">
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
            </div>

            {err && <p className="text-red-600 text-sm">{err}</p>}

            {/* 1) Gráfico de la cartera total */}
            <div className="w-full h-80 bg-white border border-gray-100 rounded-2xl p-3">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.total || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis
                            tickFormatter={(v) => fmtCurrency.format(Number(v) || 0)}
                            width={130}
                            tickMargin={12}
                        />
                        <Tooltip formatter={(v) => fmtCurrency.format(Number(v) || 0)} />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={TOTAL_COLOR}
                            fill={TOTAL_FILL}
                            fillOpacity={0.3}
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* 2) Listado de fondos con gráfico colapsable */}
            {tickers.length > 0 && (
                <div className="space-y-2">
                    <h2 className="text-lg font-semibold mt-4">{t("fundsInRange")}</h2>
                    <ul className="bg-white border border-gray-100 rounded-2xl divide-y">
                        {tickers.map((tk) => {
                            const series = data.byTicker[tk] || [];
                            const ret = pctReturn(series);
                            const isOpen = expanded.has(tk);
                            return (
                                <li key={tk}>
                                    <button
                                        type="button"
                                        onClick={() => toggle(tk)}
                                        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                                    >
                                        <span className="flex items-center gap-3 min-w-0">
                                            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: colorMap[tk] }} />
                                            <span className="truncate font-medium">{nameFor(tk)}</span>
                                            <span className="text-xs text-gray-500 hidden sm:inline">{tk}</span>
                                        </span>
                                        <span className="flex items-center gap-3 shrink-0">
                                            {ret != null && (
                                                <span className={`text-sm font-mono ${ret >= 0 ? "text-green-600" : "text-red-600"}`}>
                                                    {ret >= 0 ? "+" : ""}{ret.toFixed(2)}%
                                                </span>
                                            )}
                                            <span className="text-gray-400">{isOpen ? "▾" : "▸"}</span>
                                        </span>
                                    </button>
                                    <div className={`px-4 pb-4 ${isOpen ? "block" : "hidden"}`}>
                                        <FundChart data={series} color={colorMap[tk]} />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
