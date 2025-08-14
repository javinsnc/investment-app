// EN/ES minimal i18n in one file. Default: EN.
// Switch with: localStorage.setItem("lang","es"); location.reload();

const messages = {
    en: {
        home: "Home",
        performancePage: "Performance",

        // Summary
        investmentTotal: "Total Investment",
        currentValue: "Current Value",
        gainLossEUR: "Gain / Loss (€)",
        gainLossPct: "Gain / Loss (%)",

        // Table
        assetsTitle: "Assets",
        name: "Name",
        ticker: "Ticker",
        type: "Type",
        quantity: "Quantity",
        purchasePrice: "Average Cost",
        currentPrice: "Current Price",
        lastPriceDate: "Last Price Date",
        totalCost: "Total Cost",
        currentValueCol: "Current Value",
        plEur: "P/L €",
        plPct: "P/L %",
        noAssets: "No assets yet.",

        // Distribution
        distributionByAsset: "Distribution by Asset (Cost Invested)",
        invested: "Invested:",
        ofPortfolio: "% of portfolio:",

        // History
        priceEvolution: "Price Evolution",
        timeRange: "Time Range:",
        assetLabel: "Asset:",
        allAssets: "All assets",
        from: "From:",
        to: "To:",
        days: "Days",
        weeks: "Weeks",
        months: "Months",
        years: "Years",

        // Inline / modal ops
        add: "Add",
        addAsset: "Add new asset",
        fieldDate: "Date",
        fieldPrice: "Price",
        fieldQty: "Quantity",
        fieldName: "Name",
        fieldTicker: "Ticker",
        fieldType: "Type",
        cancel: "Cancel",
        save: "Save",
        buy: "Buy",
        sell: "Sell",
        successOp: "Operation saved successfully.",
        errorOp: "Failed to save operation.",
        cannotSellMore: "You cannot sell more than your current quantity.",
        type_stock: "Stock",
        type_fund: "Fund",
        type_crypto: "Crypto",
        type_forex: "Forex",
        type_other: "Other",

        // Prices update buttons/messages
        updateLastPrice: "Update last price",
        updateAllPrices: "Update all prices",
        updating: "Updating…",
        updatedOk: "Updated.",
        updatedErr: "Failed to update.",
        onlyFunds: "Only available for funds.",

        // Errors
        failedAssets: "Failed to load assets",
        failedMetrics: "Failed to load metrics",
    },

    es: {
        home: "Inicio",
        performancePage: "Rendimiento",

        // Resumen
        investmentTotal: "Inversión Total",
        currentValue: "Valor Actual",
        gainLossEUR: "Ganancia / Pérdida (€)",
        gainLossPct: "Ganancia / Pérdida (%)",

        // Tabla
        assetsTitle: "Activos",
        name: "Nombre",
        ticker: "Ticker",
        type: "Tipo",
        quantity: "Cantidad",
        purchasePrice: "Coste medio",
        currentPrice: "Precio actual",
        lastPriceDate: "Fecha último precio",
        totalCost: "Coste total",
        currentValueCol: "Valor actual",
        plEur: "P/L €",
        plPct: "P/L %",
        noAssets: "No hay activos todavía.",

        // Distribución
        distributionByAsset: "Distribución por activo (coste invertido)",
        invested: "Inversión:",
        ofPortfolio: "% cartera:",

        // Histórico
        priceEvolution: "Evolución del precio",
        timeRange: "Rango temporal:",
        assetLabel: "Activo:",
        allAssets: "Todos los activos",
        from: "Desde:",
        to: "Hasta:",
        days: "Días",
        weeks: "Semanas",
        months: "Meses",
        years: "Años",

        // Inline / modal ops
        add: "Añadir",
        addAsset: "Añadir nuevo activo",
        fieldDate: "Fecha",
        fieldPrice: "Precio",
        fieldQty: "Cantidad",
        fieldName: "Nombre",
        fieldTicker: "Ticker",
        fieldType: "Tipo",
        cancel: "Cancelar",
        save: "Guardar",
        buy: "Compra",
        sell: "Venta",
        successOp: "Operación guardada correctamente.",
        errorOp: "Error al guardar la operación.",
        cannotSellMore: "No puedes vender más cantidad de la que tienes.",
        type_stock: "Acción",
        type_fund: "Fondo",
        type_crypto: "Cripto",
        type_forex: "Forex",
        type_other: "Otro",

        // Botones/msgs de actualización de precios
        updateLastPrice: "Actualizar último precio",
        updateAllPrices: "Actualizar todos los precios",
        updating: "Actualizando…",
        updatedOk: "Actualizado.",
        updatedErr: "Error al actualizar.",
        onlyFunds: "Solo disponible para fondos.",

        // Errores
        failedAssets: "Error al cargar activos",
        failedMetrics: "Error al cargar métricas",
    },
};

export function getLang() {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("lang") : null;
    return saved === "es" || saved === "en" ? saved : "en";
}

export function t(key) {
    const lang = getLang();
    return (messages[lang] && messages[lang][key]) || messages.en[key] || key;
}
