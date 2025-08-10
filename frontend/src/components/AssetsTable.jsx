import React, { useState } from "react";
import api from "../utils/api";
import { fmtCurrency, fmtNumber, formatByType } from "../utils/format";
import { t } from "../utils/i18n";

// Soporta coma decimal y puntos de millar (es-ES) -> número JS
function parseLocaleNumber(input) {
    if (input == null || input === "") return null;
    const normalized = String(input).replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
}

function InlineForm({ asset, side, onCancel, onSaved }) {
    const [opDate, setOpDate] = useState("");
    const [price, setPrice] = useState("");
    const [qty, setQty] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ ok: null, text: "" });

    const submit = async (e) => {
        e.preventDefault();
        setMsg({ ok: null, text: "" });

        const p = parseLocaleNumber(price);
        const q = parseLocaleNumber(qty);
        if (!opDate || p == null || q == null || p <= 0 || q <= 0) {
            setMsg({ ok: false, text: t("errorOp") });
            return;
        }

        // Validación cliente: no vender más de lo que tengo
        if (side === "SELL" && q > Number(asset.quantity)) {
            setMsg({ ok: false, text: t("cannotSellMore") });
            return;
        }

        setSaving(true);
        try {
            await api.post("/api/operations", {
                name: asset.name,
                ticker: asset.ticker,
                asset_type: asset.type,
                side,
                op_date: opDate,
                price: p,
                quantity: q,
            });
            setMsg({ ok: true, text: t("successOp") });
            onSaved?.();
            onCancel?.(); // cerrar formulario
        } catch (err) {
            const status = err?.response?.status;
            if (status === 409) {
                setMsg({ ok: false, text: t("cannotSellMore") });
            } else {
                setMsg({ ok: false, text: t("errorOp") });
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <tr className="bg-blue-50/30">
            <td colSpan={11} className="p-3">
                <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-600 mb-1">{t("fieldDate")}</label>
                        <input
                            type="date"
                            className="border rounded px-2 py-1"
                            value={opDate}
                            onChange={(e) => setOpDate(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-600 mb-1">{t("fieldPrice")}</label>
                        <input
                            className="border rounded px-2 py-1"
                            placeholder="1.234,56"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-600 mb-1">{t("fieldQty")}</label>
                        <input
                            className="border rounded px-2 py-1"
                            placeholder="100"
                            value={qty}
                            onChange={(e) => setQty(e.target.value)}
                            required
                        />
                    </div>

                    {msg.text && (
                        <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>
              {msg.text}
            </span>
                    )}

                    <div className="ml-auto flex gap-2">
                        <button type="button" className="px-3 py-2 rounded-md border" onClick={onCancel}>
                            {t("cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className={`px-3 py-2 rounded-md text-white ${
                                side === "BUY" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                            } disabled:opacity-60`}
                        >
                            {saving ? "…" : t("save")}
                        </button>
                    </div>
                </form>
            </td>
        </tr>
    );
}

export default function AssetsTable({ assets, onChanged, onAdd }) {
    const [openRow, setOpenRow] = useState(null); // ticker de fila abierta
    const [mode, setMode] = useState(null); // 'BUY' | 'SELL'

    const openForm = (ticker, m) => {
        setOpenRow(ticker === openRow && mode === m ? null : ticker);
        setMode(m);
    };

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
                        <th className="text-right p-2 border">{/* acciones */}</th>
                    </tr>
                    </thead>

                    <tbody>
                    {assets.map((asset) => {
                        const qty = Number(asset.quantity);
                        const price = Number(asset.purchase_price);
                        const invested = Number(asset.invested ?? qty * price);
                        const currentPrice =
                            asset.current_price != null ? Number(asset.current_price) : null;
                        const currentValue =
                            asset.current_value != null
                                ? Number(asset.current_value)
                                : currentPrice != null
                                    ? currentPrice * qty
                                    : null;
                        const pnlAbs =
                            asset.pnl_abs != null
                                ? Number(asset.pnl_abs)
                                : currentPrice != null
                                    ? (currentPrice - price) * qty
                                    : null;
                        const pnlPct =
                            asset.pnl_pct != null
                                ? Number(asset.pnl_pct)
                                : currentPrice != null && price > 0
                                    ? ((currentPrice - price) / price) * 100
                                    : null;

                        const isOpen = openRow === asset.ticker;

                        return (
                            <React.Fragment key={asset.id}>
                                <tr className="odd:bg-white even:bg-gray-50">
                                    <td className="p-2 border">{asset.name}</td>
                                    <td className="p-2 border">{asset.ticker}</td>
                                    <td className="p-2 border">{asset.type}</td>
                                    <td className="p-2 border text-right">{fmtNumber.format(qty)}</td>
                                    <td className="p-2 border text-right">{formatByType(asset.type, price)}</td>
                                    <td className="p-2 border text-right">
                                        {currentPrice != null ? formatByType(asset.type, currentPrice) : "—"}
                                    </td>
                                    <td className="p-2 border text-right">{fmtCurrency.format(invested)}</td>
                                    <td className="p-2 border text-right">
                                        {currentValue != null ? fmtCurrency.format(currentValue) : "—"}
                                    </td>
                                    <td
                                        className={`p-2 border text-right ${
                                            (pnlAbs ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                                        }`}
                                    >
                                        {pnlAbs != null ? fmtCurrency.format(pnlAbs) : "—"}
                                    </td>
                                    <td
                                        className={`p-2 border text-right ${
                                            (pnlPct ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                                        }`}
                                    >
                                        {pnlPct != null ? `${pnlPct.toFixed(2)}%` : "—"}
                                    </td>
                                    <td className="p-2 border text-right">
                                        <div className="inline-flex gap-2">
                                            <button
                                                title={t("buy")}
                                                className="px-2 py-1 rounded-md text-white bg-green-600 hover:bg-green-700"
                                                onClick={() => openForm(asset.ticker, "BUY")}
                                            >
                                                ＋
                                            </button>
                                            <button
                                                title={t("sell")}
                                                className="px-2 py-1 rounded-md text-white bg-red-600 hover:bg-red-700"
                                                onClick={() => openForm(asset.ticker, "SELL")}
                                            >
                                                －
                                            </button>
                                        </div>
                                    </td>
                                </tr>

                                {isOpen && (
                                    <InlineForm
                                        asset={asset}
                                        side={mode}
                                        onCancel={() => setOpenRow(null)}
                                        onSaved={onChanged}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}

                    {assets.length === 0 && (
                        <tr>
                            <td className="p-3 text-center text-gray-500" colSpan={11}>
                                {t("noAssets")}
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* Botón global + Add debajo de la tabla */}
            <div className="mt-3">
                <button
                    onClick={onAdd}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700"
                >
                    <span className="text-lg leading-none">＋</span>
                    {t("add")}
                </button>
            </div>
        </div>
    );
}
