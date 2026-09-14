import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useLayoutEffect } from "react";

import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/marketing.css";
import "../styles/dashboard.css";

import MotionNotice from "./components/MotionNotice.jsx";
import MarketingPage from "./pages/MarketingPage.jsx";
import DemoLayout from "./pages/demo/DemoLayout.jsx";
import DemoOverview from "./pages/demo/DemoOverview.jsx";
import DemoAssets from "./pages/demo/DemoAssets.jsx";
import DemoFindings from "./pages/demo/DemoFindings.jsx";
import DemoConnectors from "./pages/demo/DemoConnectors.jsx";
import DemoFindingDetail from "./pages/demo/DemoFindingDetail.jsx";

function BodyClass() {
  const location = useLocation();
  useLayoutEffect(() => {
    const marketing = location.pathname === "/";
    document.body.className = marketing ? "marketing" : "demo-body";
  }, [location.pathname]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <BodyClass />
      <MotionNotice />
      <Routes>
        <Route path="/" element={<MarketingPage />} />
        <Route path="/demo" element={<DemoLayout page="overview"><DemoOverview /></DemoLayout>} />
        <Route path="/demo-assets" element={<DemoLayout page="assets"><DemoAssets /></DemoLayout>} />
        <Route path="/demo-findings" element={<DemoLayout page="findings"><DemoFindings /></DemoLayout>} />
        <Route path="/demo-connectors" element={<DemoLayout page="connectors"><DemoConnectors /></DemoLayout>} />
        <Route path="/demo-finding" element={<DemoLayout page="finding-detail"><DemoFindingDetail /></DemoLayout>} />
        <Route path="*" element={<MarketingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);