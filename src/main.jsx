import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useLayoutEffect } from "react";

import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/marketing.css";
import "../styles/dashboard.css";

import { WorkspaceProvider } from "./context/WorkspaceContext.jsx";
import MotionNotice from "./components/MotionNotice.jsx";
import MarketingPage from "./pages/MarketingPage.jsx";
import DemoEntry from "./pages/demo/DemoEntry.jsx";
import DemoLayout from "./pages/demo/DemoLayout.jsx";
import DemoOverview from "./pages/demo/DemoOverview.jsx";
import DemoAssets from "./pages/demo/DemoAssets.jsx";
import DemoFindings from "./pages/demo/DemoFindings.jsx";
import DemoConnectors from "./pages/demo/DemoConnectors.jsx";
import DemoCloudChecks from "./pages/demo/DemoCloudChecks.jsx";
import DemoWebsiteChecks from "./pages/demo/DemoWebsiteChecks.jsx";
import DemoBackups from "./pages/demo/DemoBackups.jsx";
import DemoIdentity from "./pages/demo/DemoIdentity.jsx";
import DemoActivity from "./pages/demo/DemoActivity.jsx";
import DemoNotifications from "./pages/demo/DemoNotifications.jsx";
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
      <WorkspaceProvider>
        <Routes>
          <Route path="/" element={<MarketingPage />} />
          <Route path="/demo-entry" element={<DemoEntry />} />
          <Route path="/demo" element={<DemoLayout page="overview"><DemoOverview /></DemoLayout>} />
          <Route path="/demo-assets" element={<DemoLayout page="assets"><DemoAssets /></DemoLayout>} />
          <Route path="/demo-findings" element={<DemoLayout page="findings"><DemoFindings /></DemoLayout>} />
          <Route path="/demo-connectors" element={<DemoLayout page="connectors"><DemoConnectors /></DemoLayout>} />
          <Route path="/demo-cloud" element={<DemoLayout page="cloud"><DemoCloudChecks /></DemoLayout>} />
          <Route path="/demo-website" element={<DemoLayout page="website"><DemoWebsiteChecks /></DemoLayout>} />
          <Route path="/demo-backups" element={<DemoLayout page="backup"><DemoBackups /></DemoLayout>} />
          <Route path="/demo-identity" element={<DemoLayout page="identity"><DemoIdentity /></DemoLayout>} />
          <Route path="/demo-activity" element={<DemoLayout page="activity"><DemoActivity /></DemoLayout>} />
          <Route path="/demo-notifications" element={<DemoLayout page="notifications"><DemoNotifications /></DemoLayout>} />
          <Route path="/demo-finding" element={<DemoLayout page="finding-detail"><DemoFindingDetail /></DemoLayout>} />
          <Route path="*" element={<MarketingPage />} />
        </Routes>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);