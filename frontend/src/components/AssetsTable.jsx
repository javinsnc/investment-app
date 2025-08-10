import React from "react";
import { fmtCurrency, fmtNumber, formatByType } from "../utils/format";
import { t } from "../utils/i18n";

export default function AssetsTable({ assets }) {
  return (
    <div className="bg-white shadow-sm border border-gray-100 p-4 rounded-2xl">
      <h2 className="text-lg font-semibold mb-3">{t("assetsTitle")}</h2>
      <div className="overflow-auto">
        <table className="min-w-full border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2 border">{t("name")}</th>
              <th className="text-left p-2 border">{t("ticker")}</th>
              <th className="text-left p-2 border">{t("type")}</th>
              <th className="text-right p-2 border">{t("quantity")}</th>
              <th className="text-right p-2 border">{t("purchasePrice")}</th>
              <th className="text-right p-2 border">{t("currentPrice")}</th>
              <th className="text-right p-2 border">{t("totalCost")}</th>
              <th className="text-right p-2 border">{t("currentValueCol")}</th>
              <th className="text-right p-2 border">{t("plEur")}</th>
              <th className="text-right p-2 border">{t("plPct")}</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const qty = Number(asset.quantity);
              const price = Number(asset.purchase_price);
              const invested = Number(asset.invested ?? qty * price);
              const currentPrice = asset.current_price != null ? Number(asset.current_price) : null;
              const currentValue = asset.current_value != null ? Number(asset.current_value) : (currentPrice != null ? currentPrice * qty : null);
              const pnlAbs = asset.pnl_abs != null ? Number(asset.pnl_abs) : (currentPrice != null ? (currentPrice - price) * qty : null);
              const pnlPct = asset.pnl_pct != null ? Number(asset.pnl_pct) : (currentPrice != null && price > 0 ? ((currentPrice - price) / price) * 100 : null);

              return (
                <tr key={asset.id} className="odd:bg-white even:bg-gray-50">
                  <td className="p-2 border">{asset.name}</td>
                  <td className="p-2 border">{asset.ticker}</td>
                  <td className="p-2 border">{asset.type}</td>
                  <td className="p-2 border text-right">{fmtNumber.format(qty)}</td>
                  <td className="p-2 border text-right">{formatByType(asset.type, price)}</td>
                  <td className="p-2 border text-right">{currentPrice != null ? formatByType(asset.type, currentPrice) : "—"}</td>
                  <td className="p-2 border text-right">{fmtCurrency.format(invested)}</td>
                  <td className="p-2 border text-right">{currentValue != null ? fmtCurrency.format(currentValue) : "—"}</td>
                  <td className={`p-2 border text-right ${pnlAbs >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {pnlAbs != null ? fmtCurrency.format(pnlAbs) : "—"}
                  </td>
                  <td className={`p-2 border text-right ${pnlPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {pnlPct != null ? `${pnlPct.toFixed(2)}%` : "—"}
                  </td>
                </tr>
              );
            })}
            {assets.length === 0 && (
              <tr>
                <td className="p-3 text-center text-gray-500" colSpan={10}>
                  {t("noAssets")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
