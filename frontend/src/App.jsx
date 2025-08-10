import React from "react";
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Performance from "./pages/Performance";
import { t } from "./utils/i18n";

const LinkBase="px-3 py-2 rounded-md text-sm font-medium hover:text-blue-600 hover:bg-blue-50";
const LinkActive="text-blue-700 bg-blue-100";

export default function App(){
  return (
    <Router>
      <nav className="bg-white shadow-sm border-b border-gray-100 px-4 py-3 flex gap-2">
        <NavLink to="/" end className={({isActive})=>`${LinkBase} ${isActive?LinkActive:"text-gray-700"}`}>{t("home")}</NavLink>
        <NavLink to="/performance" className={({isActive})=>`${LinkBase} ${isActive?LinkActive:"text-gray-700"}`}>{t("performancePage")}</NavLink>
      </nav>
      <div className="p-4">
        <Routes>
          <Route path="/" element={<Home/>}/>
          <Route path="/performance" element={<Performance/>}/>
        </Routes>
      </div>
    </Router>
  );
}
