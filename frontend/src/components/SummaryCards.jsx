import React from "react";
import {fmtCurrency} from "../utils/format";
import {t} from "../utils/i18n";

export default function SummaryCards({metrics}) {
    const pnl = Number(metrics.gain_loss ?? 0);
    const pnlPct = Number(metrics.gain_loss_pct ?? 0);
    return (<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white shadow-sm border border-gray-100 p-4 rounded-2xl"><h2
            className="text-sm text-gray-600">{t("investmentTotal")}</h2><p
            className="text-2xl font-semibold">{fmtCurrency.format(metrics.total_investment ?? 0)}</p></div>
        <div className="bg-white shadow-sm border border-gray-100 p-4 rounded-2xl"><h2
            className="text-sm text-gray-600">{t("currentValue")}</h2><p
            className="text-2xl font-semibold">{fmtCurrency.format(metrics.total_value ?? 0)}</p></div>
        <div className="bg-white shadow-sm border border-gray-100 p-4 rounded-2xl"><h2
            className="text-sm text-gray-600">{t("gainLossEUR")}</h2><p
            className={`text-2xl font-semibold ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtCurrency.format(pnl)}</p>
        </div>
        <div className="bg-white shadow-sm border border-gray-100 p-4 rounded-2xl"><h2
            className="text-sm text-gray-600">{t("gainLossPct")}</h2><p
            className={`text-2xl font-semibold ${pnlPct >= 0 ? "text-green-600" : "text-red-600"}`}>{pnlPct.toFixed(2)}%</p>
        </div>
    </div>);
}
