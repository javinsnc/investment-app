import React, {useEffect, useState} from "react";
import api from "../utils/api";
import {BarChart, Bar, XAxis, YAxis, Tooltip as BarTooltip, CartesianGrid, ResponsiveContainer} from "recharts";
import {fmtCurrency, fmtCurrencyCompact, fmtDate} from "../utils/format";
import {t} from "../utils/i18n";

const MAX_POINTS = 100;

function toISODate(d) {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function downsample(series, max = MAX_POINTS) {
    if (!Array.isArray(series) || series.length <= max) return series;
    const step = Math.ceil(series.length / max);
    const out = [];
    for (let i = 0; i < series.length; i += step) {
        out.push(series[i]);
    }
    if (out[out.length - 1] !== series[series.length - 1]) out.push(series[series.length - 1]);
    return out;
}

export default function History({assets}) {
    const [group, setGroup] = useState("day");
    const [selectedAsset, setSelectedAsset] = useState("all"); // ticker
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [history, setHistory] = useState([]);

    useEffect(() => {
        const today = new Date();
        const minus30 = new Date();
        minus30.setDate(today.getDate() - 30);
        setEndDate(toISODate(today));
        setStartDate(toISODate(minus30));
    }, []);

    useEffect(() => {
        if (!startDate || !endDate) return;
        (async () => {
            try {
                let url = "/api/history/portfolio";
                if (selectedAsset !== "all") url = `/api/history/asset/${selectedAsset}`;
                const res = await api.get(url, {params: {group, start: startDate, end: endDate}});
                let data = res.data.map(d => ({date: d.date, value: Number(d.value) || 0}));
                data.sort((a, b) => new Date(a.date) - new Date(b.date));
                data = downsample(data, MAX_POINTS);
                setHistory(data);
            } catch (e) {
                console.error("Error fetching history", e);
            }
        })();
    }, [group, selectedAsset, startDate, endDate]);

    const title = selectedAsset === "all" ? `${t("priceEvolution")} (${group})` : `${t("priceEvolution")} - ${selectedAsset} (${group})`;

    return (<div className="bg-white shadow-sm border border-gray-100 p-4 rounded-2xl space-y-3">
        <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium">{t("timeRange")}</label>
                <select className="border rounded px-2 py-1" value={group} onChange={e => setGroup(e.target.value)}>
                    <option value="day">{t("days")}</option>
                    <option value="week">{t("weeks")}</option>
                    <option value="month">{t("months")}</option>
                    <option value="year">{t("years")}</option>
                </select>
            </div>
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium">{t("assetLabel")}</label>
                <select className="border rounded px-2 py-1 min-w-[220px]" value={selectedAsset}
                        onChange={e => setSelectedAsset(e.target.value)}>
                    <option value="all">{t("allAssets")}</option>
                    {assets.map(a => <option key={a.ticker} value={a.ticker}>{a.name} ({a.ticker})</option>)}
                </select>
            </div>
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium">{t("from")}</label>
                <input type="date" className="border rounded px-2 py-1" value={startDate}
                       onChange={e => setStartDate(e.target.value)} max={endDate || undefined}/>
            </div>
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium">{t("to")}</label>
                <input type="date" className="border rounded px-2 py-1" value={endDate}
                       onChange={e => setEndDate(e.target.value)} min={startDate || undefined}/>
            </div>
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <ResponsiveContainer width="100%" height={340}>
            <BarChart data={history} margin={{top: 8, right: 16, bottom: 8, left: 88}}
                      barSize={Math.max(6, Math.min(40, Math.floor(800 / Math.max(1, history.length))))}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="date" tickFormatter={d => {
                    try {
                        return fmtDate.format(new Date(d));
                    } catch {
                        return d;
                    }
                }} tickMargin={8}/>
                <YAxis width={88} tickMargin={8} domain={["auto", "auto"]}
                       tickFormatter={v => fmtCurrencyCompact.format(v)}/>
                <BarTooltip labelFormatter={label => {
                    try {
                        return fmtDate.format(new Date(label));
                    } catch {
                        return label;
                    }
                }} formatter={value => fmtCurrency.format(value)}/>
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#4F46E5" animationDuration={600}/>
            </BarChart>
        </ResponsiveContainer>
    </div>);
}
