import React, { useEffect, useState } from "react";
import api from "../utils/api";
import { t } from "../utils/i18n";
import { fmtCurrency } from "../utils/format";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from "recharts";

// Fecha YYYY-MM-DD de hoy menos n días
function isoTodayMinus(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

export default function Performance() {
    const [assets, setAssets] = useState([]);
    const [series, setSeries] = useState([]);
    const [err, setErr] = useState("");
    const [group, setGroup] = useState("day");
    const [assetSel, setAssetSel] = useState("ALL"); // "ALL" | ticker
    const [from, setFrom] = useState(isoTodayMinus(30));
    const [to, setTo] = useState(isoTodayMinus(0));

    // carga lista de activos para el selector
    useEffect(() => {
        api.get("/api/assets").then(r => setAssets(r.data || [])).catch(() => {});
    }, []);

    // carga serie cuando cambian filtros
    useEffect(() => {
        const run = async () => {
            try {
                setErr("");
                const params = { group, start: from, end: to, maxPoints: 100 };
                if (assetSel === "ALL") {
                    const { data } = await api.get("/api/history/portfolio", { params });
                    setSeries(data || []);
                } else {
                    const { data } = await api.get(`/api/history/asset/${assetSel}`, { params });
                    setSeries(data || []);
                }
            } catch (e) {
                console.error(e);
                setErr("Failed to load performance");
            }
        };
        run();
    }, [assetSel, group, from, to]);

    // Eje Y formateado €
    const yTick = (v) => fmtCurrency.format(Number(v) || 0);
    const controlClass = "h-10 border rounded px-3";

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">{t("performancePage")}</h1>

            <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">{t("assetLabel")}</label>
                    <select
                        className={controlClass}
                        value={assetSel}
                        onChange={(e) => setAssetSel(e.target.value)}
                    >
                        <option value="ALL">{t("allAssets")}</option>
                        {assets.map(a => (
                            <option key={a.ticker} value={a.ticker}>{a.ticker}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">{t("timeRange")}</label>
                    <select
                        className={controlClass}
                        value={group}
                        onChange={(e) => setGroup(e.target.value)}
                    >
                        <option value="day">{t("days")}</option>
                        <option value="week">{t("weeks")}</option>
                        <option value="month">{t("months")}</option>
                        <option value="year">{t("years")}</option>
                    </select>
                </div>

                <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">{t("from")}</label>
                    <input
                        type="date"
                        className={controlClass}
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                    />
                </div>

                <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">{t("to")}</label>
                    <input
                        type="date"
                        className={controlClass}
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                    />
                </div>
            </div>

            {err && <p className="text-red-600 text-sm">{err}</p>}

            <div className="w-full h-80 bg-white border border-gray-100 rounded-2xl p-3">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis tickFormatter={yTick} width={130} tickMargin={12} />
                        <Tooltip
                            formatter={(v) => fmtCurrency.format(Number(v) || 0)}
                            labelFormatter={(l) => l}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#1E3A8A"
                            fill="#3B82F6"
                            fillOpacity={0.3}
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
