export const fmtCurrency=new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR",maximumFractionDigits:2});
export const fmtCurrencyCompact=new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR",notation:"compact",maximumFractionDigits:1});
export const fmtNumber=new Intl.NumberFormat("es-ES");
export const fmtDate=new Intl.DateTimeFormat("es-ES",{year:"numeric",month:"2-digit",day:"2-digit"});
export const formatByType=(type,value)=>{
  if(value==null||isNaN(value))return "—";
  switch((type||"").toLowerCase()){
    case "forex": return new Intl.NumberFormat("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4}).format(value);
    case "crypto": return new Intl.NumberFormat("es-ES",{minimumFractionDigits:6,maximumFractionDigits:8}).format(value);
    default: return new Intl.NumberFormat("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  }
};
export const PIE_COLORS=["#6366F1","#22C55E","#F59E0B","#EF4444","#06B6D4","#A855F7","#84CC16","#E11D48","#14B8A6","#3B82F6"];
export const makeGradientStops=(hex)=>({start:hex,mid:hex+"CC",end:hex+"99"});
