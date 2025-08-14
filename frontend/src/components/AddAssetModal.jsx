import React, {useState} from "react";
import api from "../utils/api";
import {t} from "../utils/i18n";

// Permite coma decimal y puntos de millar (es-ES)
function parseLocaleNumber(input) {
    if (input == null || input === "") return null;
    const normalized = String(input).replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
}

export default function AddAssetModal({open, onClose, onSaved}) {
    const [form, setForm] = useState({
        name: "",
        ticker: "",
        asset_type: "stock",
        op_date: "",
        price: "",
        quantity: "",
    });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ok: null, text: ""});

    if (!open) return null;

    const change = (e) => {
        const {name, value} = e.target;
        setForm((f) => ({...f, [name]: value}));
    };

    const submit = async (e) => {
        e.preventDefault();
        setMsg({ok: null, text: ""});

        const price = parseLocaleNumber(form.price);
        const qty = parseLocaleNumber(form.quantity);
        if (!form.name || !form.ticker || !form.op_date || price == null || qty == null) {
            setMsg({ok: false, text: t("errorOp")});
            return;
        }

        setLoading(true);
        try {
            const body = {
                name: form.name,
                ticker: form.ticker,
                asset_type: form.asset_type,
                operation_type: "buy",
                op_date: form.op_date,
                price,
                quantity: qty,
            };
            await api.post("/api/operations", body);
            setMsg({ok: true, text: t("successOp")});
            onSaved?.();
            onClose?.();
        } catch (err) {
            setMsg({ok: false, text: t("errorOp")});
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 w-[95%] max-w-2xl p-5">
                <h3 className="text-xl font-semibold mb-4">{t("addAsset")}</h3>
                <form onSubmit={submit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col">
                            <label className="text-sm text-gray-600 mb-1">{t("fieldName")}</label>
                            <input className="border rounded px-3 py-2" name="name" value={form.name} onChange={change}
                                   required/>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-sm text-gray-600 mb-1">{t("fieldTicker")}</label>
                            <input className="border rounded px-3 py-2" name="ticker" value={form.ticker}
                                   onChange={change} placeholder="AAPL, BTC, EURUSD..." required/>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-sm text-gray-600 mb-1">{t("fieldType")}</label>
                            <select className="border rounded px-3 py-2" name="asset_type" value={form.asset_type}
                                    onChange={change} required>
                                <option value="stock">{t("type_stock")}</option>
                                <option value="fund">{t("type_fund")}</option>
                                <option value="crypto">{t("type_crypto")}</option>
                                <option value="forex">{t("type_forex")}</option>
                                <option value="other">{t("type_other")}</option>
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-sm text-gray-600 mb-1">{t("fieldDate")}</label>
                            <input type="date" className="border rounded px-3 py-2" name="op_date" value={form.op_date}
                                   onChange={change} required/>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-sm text-gray-600 mb-1">{t("fieldPrice")}</label>
                            <input className="border rounded px-3 py-2" name="price" value={form.price}
                                   onChange={change} placeholder="1.234,56" required/>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-sm text-gray-600 mb-1">{t("fieldQty")}</label>
                            <input className="border rounded px-3 py-2" name="quantity" value={form.quantity}
                                   onChange={change} placeholder="100" required/>
                        </div>
                    </div>

                    {msg.text && (
                        <p className={`${msg.ok ? "text-green-600" : "text-red-600"} text-sm`}>{msg.text}</p>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" className="px-4 py-2 rounded-md border" onClick={onClose}>
                            {t("cancel")}
                        </button>
                        <button type="submit" disabled={loading}
                                className="px-4 py-2 rounded-md bg-green-600 text-white disabled:opacity-60">
                            {loading ? "…" : t("save")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
