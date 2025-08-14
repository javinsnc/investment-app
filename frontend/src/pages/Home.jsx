import React, {useEffect, useState, useCallback} from "react";
import api from "../utils/api";
import SummaryCards from "../components/SummaryCards";
import AssetsTable from "../components/AssetsTable";
import DistributionPie from "../components/DistributionPie";
import AddAssetModal from "../components/AddAssetModal";
import {t} from "../utils/i18n";

export default function Home() {
    const [assets, setAssets] = useState([]);
    const [metrics, setMetrics] = useState({});
    const [error, setError] = useState(null);
    const [showAdd, setShowAdd] = useState(false);

    const loadAll = useCallback(() => {
        api.get(`/api/assets`)
            .then((r) => setAssets(r.data))
            .catch((err) => {
                console.error("assets", err);
                setError(t("failedAssets"));
            });

        api.get(`/api/metrics`)
            .then((r) => setMetrics(r.data))
            .catch((err) => {
                console.error("metrics", err);
                setError(t("failedMetrics"));
            });
    }, []);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">{t("home")}</h1>
            </div>

            {error && <p className="text-red-500">{error}</p>}

            {/* Resumen */}
            <SummaryCards metrics={metrics}/>

            {/* Gráfico de assets (pie) */}
            <DistributionPie assets={assets}/>

            {/* Tabla de assets con fila de acciones (+ Add izquierda, Update derecha) */}
            <AssetsTable assets={assets} onChanged={loadAll} onAdd={() => setShowAdd(true)}/>

            {/* Modal para añadir nuevo asset */}
            <AddAssetModal
                open={showAdd}
                onClose={() => setShowAdd(false)}
                onSaved={() => loadAll()}
            />
        </div>
    );
}
