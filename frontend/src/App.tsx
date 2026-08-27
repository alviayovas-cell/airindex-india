import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/common/ProtectedRoute";
import { FullPageLoader } from "@/components/common/Spinner";

const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const AirfareData = lazy(() => import("@/pages/AirfareData"));
const RouteAnalysis = lazy(() => import("@/pages/RouteAnalysis"));
const PriceIndex = lazy(() => import("@/pages/PriceIndex"));
const LeadTimeAnalysis = lazy(() => import("@/pages/LeadTimeAnalysis"));
const DataQuality = lazy(() => import("@/pages/DataQuality"));
const DataSources = lazy(() => import("@/pages/DataSources"));
const Reports = lazy(() => import("@/pages/Reports"));
const Methodology = lazy(() => import("@/pages/Methodology"));
const Settings = lazy(() => import("@/pages/Settings"));
const NotFound = lazy(() => import("@/pages/NotFound"));

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/airfares" element={<AirfareData />} />
          <Route path="/routes" element={<RouteAnalysis />} />
          <Route path="/index" element={<PriceIndex />} />
          <Route path="/lead-time" element={<LeadTimeAnalysis />} />
          <Route path="/data-quality" element={<DataQuality />} />
          <Route path="/sources" element={<DataSources />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
