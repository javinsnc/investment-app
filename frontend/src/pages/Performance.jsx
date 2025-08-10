import React, { useEffect, useState } from "react";
import api from "../utils/api";
import History from "../components/History";
import { t } from "../utils/i18n";

export default function Performance() {
  const [assets, setAssets] = useState([]);

  useEffect(() => {
    api.get(`/api/assets`).then(r => setAssets(r.data)).catch(err => {
      console.error("assets", err);
    });
  }, []);

  return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t("performancePage")}</h1>
        <History assets={assets} />
      </div>
  );
}
