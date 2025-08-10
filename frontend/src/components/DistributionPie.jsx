import React, { useMemo } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as PieTooltipCore } from "recharts";
import { PIE_COLORS, makeGradientStops, fmtCurrency, fmtCurrencyCompact } from "../utils/format";
import { t } from "../utils/i18n";

function PieTooltip({ active, payload, total }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  const value = Number(p.value || 0);
  const percent = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="bg-white/95 backdrop-blur-sm shadow-lg rounded px-3 py-2 text-sm border">
      <div className="font-medium">{p.name}</div>
      <div><span className="text-gray-500">{t("invested")}&nbsp;</span><span className="font-semibold">{fmtCurrency.format(value)}</span></div>
      <div><span className="text-gray-500">{t("ofPortfolio")}&nbsp;</span><span className="font-semibold">{percent.toFixed(2)}%</span></div>
    </div>
  );
}

function RightLegend({ data, colors, total }) {
  return (
    <div className="flex flex-col gap-2 min-w-[220px]">
      {data.map((d, i) => {
        const percent = total > 0 ? (d.value / total) * 100 : 0;
        return (
          <div key={d.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
              <span className="text-sm">{d.name}</span>
            </div>
            <div className="text-sm tabular-nums">{percent.toFixed(1)}% · {fmtCurrencyCompact.format(d.value)}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function DistributionPie({ assets }) {
  const distribution = useMemo(() => assets.map(a => ({ name: a.ticker, value: Number(a.purchase_price) * Number(a.quantity), type: a.type })), [assets]);
  const total = useMemo(() => distribution.reduce((acc, d) => acc + (d.value || 0), 0), [distribution]);

  return (
    <div className="bg-white shadow-sm border border-gray-100 p-4 rounded-2xl">
      <h2 className="text-lg font-semibold mb-2 text-center">{t("distributionByAsset")}</h2>
      <div className="w-full flex flex-col lg:flex-row items-center gap-6">
        <div className="w-full lg:w-[65%]">
          <ResponsiveContainer width="100%" height={360}>
            <PieChart>
              <defs>
                {distribution.map((_, i) => {
                  const color = PIE_COLORS[i % PIE_COLORS.length];
                  const stops = makeGradientStops(color);
                  const id = `grad-${i}`;
                  return (
                    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1" key={id}>
                      <stop offset="0%" stopColor={stops.start} />
                      <stop offset="60%" stopColor={stops.mid} />
                      <stop offset="100%" stopColor={stops.end} />
                    </linearGradient>
                  );
                })}
              </defs>
              <Pie data={distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={140} paddingAngle={2} isAnimationActive={true} labelLine={false} label={({ name }) => name}>
                {distribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#grad-${index})`} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
                ))}
              </Pie>
              <PieTooltipCore content={<PieTooltip total={total} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full lg:w-[35%]"><RightLegend data={distribution} colors={PIE_COLORS} total={total} /></div>
      </div>
    </div>
  );
}
