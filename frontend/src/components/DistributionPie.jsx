import React, {useMemo} from "react";
import {ResponsiveContainer, PieChart, Pie, Cell, Tooltip as PieTooltipCore} from "recharts";
import {PIE_COLORS, makeGradientStops, fmtCurrency, fmtCurrencyCompact} from "../utils/format";
import {t} from "../utils/i18n";

function PieTooltip({active, payload, total}) {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0];
    const value = Number(p.value || 0);
    const percent = total > 0 ? (value / total) * 100 : 0;
    return (
        <div className="bg-white/95 backdrop-blur-sm shadow-lg rounded px-3 py-2 text-sm border">
            <div className="font-medium">{p.name}</div>
            <div><span className="text-gray-500">{t("invested")}&nbsp;</span><span
                className="font-semibold">{fmtCurrency.format(value)}</span></div>
            <div><span className="text-gray-500">{t("ofPortfolio")}&nbsp;</span><span
                className="font-semibold">{percent.toFixed(2)}%</span></div>
        </div>
    );
}

function RightLegend({data, colors, total}) {
    return (
        <div className="flex flex-col gap-2 min-w-[220px]">
            {data.map((d, i) => {
                const percent = total > 0 ? (d.value / total) * 100 : 0;
                return (
                    <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full"
                                  style={{backgroundColor: colors[i % colors.length]}}/>
                            <span className="text-sm">{d.name}</span>
                        </div>
                        <div className="text-sm tabular-nums">{percent.toFixed(1)}%
                            · {fmtCurrencyCompact.format(d.value)}</div>
                    </div>
                );
            })}
        </div>
    );
}

// Reusable pie card. `data` is an array of {name, value}.
export function PieCard({title, data}) {
    const total = useMemo(() => data.reduce((acc, d) => acc + (d.value || 0), 0), [data]);

    return (
        <div className="bg-white shadow-sm border border-gray-100 p-4 rounded-2xl">
            <h2 className="text-lg font-semibold mb-2 text-center">{title}</h2>
            <div className="w-full flex flex-col lg:flex-row items-center gap-6">
                <div className="w-full lg:w-[65%]">
                    <ResponsiveContainer width="100%" height={360}>
                        <PieChart>
                            <defs>
                                {data.map((_, i) => {
                                    const color = PIE_COLORS[i % PIE_COLORS.length];
                                    const stops = makeGradientStops(color);
                                    const id = `grad-${i}`;
                                    return (
                                        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1" key={id}>
                                            <stop offset="0%" stopColor={stops.start}/>
                                            <stop offset="60%" stopColor={stops.mid}/>
                                            <stop offset="100%" stopColor={stops.end}/>
                                        </linearGradient>
                                    );
                                })}
                            </defs>
                            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={140}
                                 paddingAngle={2} isAnimationActive={true} labelLine={false} label={({name}) => name}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`url(#grad-${index})`} stroke="rgba(0,0,0,0.06)"
                                          strokeWidth={1}/>
                                ))}
                            </Pie>
                            <PieTooltipCore content={<PieTooltip total={total}/>}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="w-full lg:w-[35%]"><RightLegend data={data} colors={PIE_COLORS} total={total}/>
                </div>
            </div>
        </div>
    );
}

const costInvested = (a) => Number(a.purchase_price) * Number(a.quantity);

// Sum cost invested grouped by the key returned by keyFn.
function groupSum(assets, keyFn) {
    const map = new Map();
    for (const a of assets) {
        const key = keyFn(a) || "—";
        const value = costInvested(a);
        map.set(key, (map.get(key) || 0) + (Number.isFinite(value) ? value : 0));
    }
    return Array.from(map, ([name, value]) => ({name, value}))
        .sort((x, y) => y.value - x.value);
}

// Existing chart: one slice per asset (by ticker).
export default function DistributionPie({assets}) {
    const data = useMemo(
        () => assets.map(a => ({name: a.ticker, value: costInvested(a)})),
        [assets]
    );
    return <PieCard title={t("distributionByAsset")} data={data}/>;
}

// Two charts side by side: by asset_type and by asset_class.
export function GroupedDistributions({assets}) {
    const byType = useMemo(() => groupSum(assets, a => a.type), [assets]);
    const byClass = useMemo(() => groupSum(assets, a => a.asset_class), [assets]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PieCard title={t("distributionByType")} data={byType}/>
            <PieCard title={t("distributionByClass")} data={byClass}/>
        </div>
    );
}
