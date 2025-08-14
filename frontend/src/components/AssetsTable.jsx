import React, {useState, useRef} from "react";
import api from "../utils/api";
import {fmtCurrency, fmtNumber, formatByType} from "../utils/format";
import {t} from "../utils/i18n";
import {FaPlus, FaMinus, FaSyncAlt, FaFileImport} from "react-icons/fa";

function parseLocaleNumber(input) {
    if (input == null || input === "") return null;
    const normalized = String(input).replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
}

function InlineForm({asset, operation_type, onCancel, onSaved}) {
    const [opDate, setOpDate] = useState("");
    const [price, setPrice] = useState("");
    const [qty, setQty] = useState("");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ok: null, text: ""});

    const submit = async (e) => {
        e.preventDefault();
        setMsg({ok: null, text: ""});

        const p = parseLocaleNumber(price);
        const q = parseLocaleNumber(qty);
        if (!opDate || p == null || q == null || p <= 0 || q <= 0) {
            setMsg({ok: false, text: t("errorOp")});
            return;
        }
        if (operation_type === "sell" && q > Number(asset.quantity)) {
            setMsg({ok: false, text: t("cannotSellMore")});
            return;
        }

        setSaving(true);
        try {
            await api.post("/api/operations", {
                name: asset.name,
                ticker: asset.ticker,
                asset_type: asset.type,
                operation_type: operation_type.toLowerCase(),
                op_date: opDate,
                price: p,
                quantity: q,
            });
            setMsg({ok: true, text: t("successOp")});
            onSaved?.();
            onCancel?.();
        } catch (err) {
            const status = err?.response?.status;
            setMsg({ok: false, text: status === 409 ? t("cannotSellMore") : t("errorOp")});
        } finally {
            setSaving(false);
        }
    };

    return (
        <tr className="bg-blue-50/30">
            <td colSpan={13} className="p-3">
                <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-600 mb-1">{t("fieldDate")}</label>
                        <input type="date" className="border rounded px-2 py-1" value={opDate}
                               onChange={(e) => setOpDate(e.target.value)} required/>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-600 mb-1">{t("fieldPrice")}</label>
                        <input className="border rounded px-2 py-1" placeholder="1.234,56" value={price}
                               onChange={(e) => setPrice(e.target.value)} required/>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-gray-600 mb-1">{t("fieldQty")}</label>
                        <input className="border rounded px-2 py-1" placeholder="100" value={qty}
                               onChange={(e) => setQty(e.target.value)} required/>
                    </div>

                    {msg.text && (
                        <span className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</span>
                    )}

                    <div className="ml-auto flex gap-2">
                        <button type="button" className="px-3 py-2 rounded border"
                                onClick={onCancel}>{t("cancel")}</button>
                        <button
                            type="submit"
                            disabled={saving}
                            className={`px-3 py-2 rounded text-white ${operation_type === "buy" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} disabled:opacity-60`}
                        >
                            {saving ? "…" : t("save")}
                        </button>
                    </div>
                </form>
            </td>
        </tr>
    );
}

export default function AssetsTable({assets, onChanged, onAdd}) {
    const [openRow, setOpenRow] = useState(null);
    const [mode, setMode] = useState(null);
    const [updating, setUpdating] = useState({});
    const [updateMsg, setUpdateMsg] = useState({});
    const [updatingAll, setUpdatingAll] = useState(false);
    const [updateAllMsg, setUpdateAllMsg] = useState("");

    // --- Import CSV ---
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);

    const openForm = (ticker, m) => {
        setOpenRow(ticker === openRow && mode === m ? null : ticker);
        setMode(m);
    };

    const updatePrice = async (ticker, type) => {
        if (type !== "fund") {
            setUpdateMsg((m) => ({...m, [ticker]: "nf"}));
            return;
        }
        setUpdating((u) => ({...u, [ticker]: true}));
        setUpdateMsg((m) => ({...m, [ticker]: ""}));
        try {
            await api.post(`/api/updateLastPrices`, null, {params: {ticker}});
            setUpdateMsg((m) => ({...m, [ticker]: "ok"}));
            onChanged?.();
        } catch (e) {
            setUpdateMsg((m) => ({...m, [ticker]: "err"}));
        } finally {
            setUpdating((u) => ({...u, [ticker]: false}));
        }
    };

    const updateAllFunds = async () => {
        setUpdatingAll(true);
        setUpdateAllMsg("");
        try {
            await api.post("/api/updateLastPrices");
            setUpdateAllMsg(t("updatedOk"));
            onChanged?.();
        } catch (_e) {
            setUpdateAllMsg(t("updatedErr"));
        } finally {
            setUpdatingAll(false);
            setTimeout(() => setUpdateAllMsg(""), 3000);
        }
    };

    const onClickImport = () => fileInputRef.current?.click();

    const handleCsvSelected = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setImporting(true);
            const text = await file.text();
            await api.post("/api/operations/import", text, {
                headers: {"Content-Type": "text/csv"},
            });
            onChanged?.();
            alert("CSV imported successfully");
        } catch (err) {
            console.error("CSV import error", err);
            const msg = err?.response?.data?.error || err.message || "Import error";
            alert(`CSV import error: ${msg}`);
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const renderLastDate = (d) => {
        if (!d) return "—";
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return d;
        try {
            const dt = new Date(d);
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, "0");
            const day = String(dt.getDate()).padStart(2, "0");
            return `${y}-${m}-${day}`;
        } catch {
            return String(d);
        }
    };

    return (
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="overflow-auto rounded-lg">
                <table className="min-w-full">
                    <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-200 border-b border-gray-300">
                        <th className="text-left p-2 font-semibold text-base whitespace-nowrap">{t("name")}</th>
                        <th className="text-left p-2 font-semibold text-base whitespace-nowrap">{t("ticker")}</th>
                        <th className="text-left p-2 font-semibold text-base whitespace-nowrap">{t("type")}</th>
                        <th className="text-right p-2 font-semibold text-base whitespace-nowrap">{t("quantity")}</th>
                        <th className="text-right p-2 font-semibold text-base whitespace-nowrap">{t("purchasePrice")}</th>
                        <th className="text-right p-2 font-semibold text-base whitespace-nowrap">{t("currentPrice")}</th>
                        <th className="text-left p-2 font-semibold text-base whitespace-nowrap">{t("lastPriceDate")}</th>
                        <th className="text-right p-2 font-semibold text-base whitespace-nowrap">{t("totalCost")}</th>
                        <th className="text-right p-2 font-semibold text-base whitespace-nowrap">{t("currentValueCol")}</th>
                        <th className="text-right p-2 font-semibold text-base whitespace-nowrap">{t("plEur")}</th>
                        <th className="text-right p-2 font-semibold text-base whitespace-nowrap">{t("plPct")}</th>
                        <th className="text-right p-2 font-semibold text-base whitespace-nowrap"></th>
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

                        const isOpen = openRow === asset.ticker;
                        const tick = asset.ticker;
                        const isUpdating = !!updating[tick];
                        const uMsg = updateMsg[tick] || "";

                        return (
                            <React.Fragment key={asset.id}>
                                <tr className="hover:bg-gray-50">
                                    <td className="p-2">{asset.name}</td>
                                    <td className="p-2">{asset.ticker}</td>
                                    <td className="p-2">{asset.type}</td>
                                    <td className="p-2 text-right">{fmtNumber.format(qty)}</td>
                                    <td className="p-2 text-right">{formatByType(asset.type, price)}</td>
                                    <td className="p-2 text-right">{currentPrice != null ? formatByType(asset.type, currentPrice) : "—"}</td>
                                    <td className="p-2">{renderLastDate(asset.last_price_date)}</td>
                                    <td className="p-2 text-right">{fmtCurrency.format(invested)}</td>
                                    <td className="p-2 text-right">{currentValue != null ? fmtCurrency.format(currentValue) : "—"}</td>
                                    <td className={`p-2 text-right ${(pnlAbs ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        {pnlAbs != null ? fmtCurrency.format(pnlAbs) : "—"}
                                    </td>
                                    <td className={`p-2 text-right ${(pnlPct ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                        {pnlPct != null ? `${pnlPct.toFixed(2)}%` : "—"}
                                    </td>
                                    <td className="p-2 text-right">
                                        <div className="inline-flex gap-2">
                                            <button
                                                title={t("buy")}
                                                className="w-8 h-8 flex items-center justify-center rounded text-white bg-green-600 hover:bg-green-700"
                                                onClick={() => openForm(asset.ticker, "buy")}
                                            >
                                                <FaPlus size={12}/>
                                            </button>
                                            <button
                                                title={t("sell")}
                                                className="w-8 h-8 flex items-center justify-center rounded text-white bg-red-600 hover:bg-red-700"
                                                onClick={() => openForm(asset.ticker, "sell")}
                                            >
                                                <FaMinus size={12}/>
                                            </button>
                                            <button
                                                title={t("updateLastPrice")}
                                                className={`w-8 h-8 flex items-center justify-center rounded text-white ${
                                                    asset.type === "fund" ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
                                                }`}
                                                disabled={asset.type !== "fund" || isUpdating}
                                                onClick={() => updatePrice(asset.ticker, asset.type)}
                                            >
                                                <FaSyncAlt size={12} className={isUpdating ? "animate-spin" : ""}/>
                                            </button>
                                        </div>
                                        {uMsg === "ok" &&
                                            <div className="text-xs text-green-600 mt-1">{t("updatedOk")}</div>}
                                        {uMsg === "err" &&
                                            <div className="text-xs text-red-600 mt-1">{t("updatedErr")}</div>}
                                        {uMsg === "nf" &&
                                            <div className="text-xs text-gray-500 mt-1">{t("onlyFunds")}</div>}
                                    </td>
                                </tr>

                                {isOpen && (
                                    <InlineForm
                                        asset={asset}
                                        operation_type={mode}
                                        onCancel={() => setOpenRow(null)}
                                        onSaved={onChanged}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}

                    {assets.length === 0 && (
                        <tr>
                            <td className="p-3 text-center text-gray-500" colSpan={13}>{t("noAssets")}</td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            <div className="mt-3 flex items-center justify-between">
                {/* Izquierda: + Add y Import from csv */}
                <div className="flex items-center gap-2">
                    {onAdd ? (
                        <button
                            onClick={onAdd}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                        >
                            <FaPlus size={14}/>
                            {t("add")}
                        </button>
                    ) : (
                        <span/>
                    )}

                    <button
                        onClick={() => (fileInputRef.current?.click())}
                        disabled={importing}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
                        title="Import operations from CSV"
                    >
                        <FaFileImport size={14}/>
                        {importing ? "Importing…" : "Import from csv"}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        style={{display: "none"}}
                        onChange={handleCsvSelected}
                    />
                </div>

                {/* Derecha: Update All Prices */}
                <div className="flex items-center gap-2">
                    {updateAllMsg && <span className="text-sm text-gray-600">{updateAllMsg}</span>}
                    <button
                        onClick={updateAllFunds}
                        disabled={updatingAll}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                        title={t("updateAllPrices")}
                    >
                        <FaSyncAlt className={updatingAll ? "animate-spin" : ""} size={14}/>
                        {updatingAll ? t("updating") : t("updateAllPrices")}
                    </button>
                </div>
            </div>
        </div>
    );
}
