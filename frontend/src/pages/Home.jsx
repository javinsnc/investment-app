import React, { useEffect, useState, useCallback } from "react";
import api from "../utils/api";
import SummaryCards from "../components/SummaryCards";
import AssetsTable from "../components/AssetsTable";
import DistributionPie from "../components/DistributionPie";
import AddAssetModal from "../components/AddAssetModal";
import { t } from "../utils/i18n";

export default function Home() {
    const [assets, setAssets] = useState([]);
    const [metrics, setMetrics] = useState({});
    const [error, setError] = useState(null);
    const [showAdd, setShowAdd] = useState(false);
    const [updatingAll, setUpdatingAll] = useState(false);
    const [updateMsg, setUpdateMsg] = useState("");

    const loadAll = useCallback(() => {
        api.get(`/api/assets`).then(r => setAssets(r.data)).catch(err => {
            console.error("assets", err);
            setError(t("failedAssets"));
        });
        api.get(`/api/metrics`).then(r => setMetrics(r.data)).catch(err => {
            console.error("metrics", err);
            setError(t("failedMetrics"));
        });
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    const updateAllFunds = async () => {
        setUpdatingAll(true);
        setUpdateMsg("");
        try {
            await api.post("/api/updateLastPrices");
            setUpdateMsg(t("updatedOk"));
            loadAll();
        } catch (e) {
            console.error(e);
            setUpdateMsg(t("updatedErr"));
        } finally {
            setUpdatingAll(false);
            setTimeout(() => setUpdateMsg(""), 3000);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">{t("home")}</h1>
                <div className="flex items-center gap-3">
                    {updateMsg && <span className="text-sm text-gray-600">{updateMsg}</span>}
                    <button
                        onClick={updateAllFunds}
                        disabled={updatingAll}
                        className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                        title={t("updateAllFunds")}
                    >
                        {updatingAll ? t("updating") : t("updateAllFunds")}
                    </button>
                </div>
            </div>

            {error && <p className="text-red-500">{error}</p>}

            <SummaryCards metrics={metrics} />
            <AssetsTable assets={assets} onChanged={loadAll} onAdd={() => setShowAdd(true)} />
            <DistributionPie assets={assets} />

            <AddAssetModal open={showAdd} onClose={() => setShowAdd(false)} onSaved={() => loadAll()} />
        </div>
    );
}
