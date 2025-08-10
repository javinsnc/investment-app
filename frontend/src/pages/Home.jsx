import React, { useEffect, useState } from "react";
import api from "../utils/api";
import SummaryCards from "../components/SummaryCards";
import AssetsTable from "../components/AssetsTable";
import DistributionPie from "../components/DistributionPie";
import { t } from "../utils/i18n";

export default function Home(){
  const [assets,setAssets]=useState([]);
  const [metrics,setMetrics]=useState({});
  const [error,setError]=useState(null);

  useEffect(()=>{
    api.get(`/api/assets`).then(r=>setAssets(r.data)).catch(err=>{ console.error("assets",err); setError(t("failedAssets")); });
    api.get(`/api/metrics`).then(r=>setMetrics(r.data)).catch(err=>{ console.error("metrics",err); setError(t("failedMetrics")); });
  },[]);

  return (<div className="space-y-6">
    <h1 className="text-3xl font-bold">{t("home")}</h1>
    {error && <p className="text-red-500">{error}</p>}
    <SummaryCards metrics={metrics}/>
    <AssetsTable assets={assets}/>
    <DistributionPie assets={assets}/>
  </div>);
}
