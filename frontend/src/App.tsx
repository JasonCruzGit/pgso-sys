import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Categories from './pages/Categories';
import Receiving from './pages/Receiving';
import Requests from './pages/Requests';
import IndividualPropertyAccountability from './pages/IndividualPropertyAccountability';
import TemporaryCertificate from './pages/TemporaryCertificate';
import PrePostInspectionRepair from './pages/PrePostInspectionRepair';
import NewInventoryRequest from './pages/NewInventoryRequest';
import IncomingInventoryRequests from './pages/IncomingInventoryRequests';
import ItemCatalog from './pages/ItemCatalog';
import RealProperties from './pages/RealProperties';
import Assets from './pages/Assets';
import StockManagement from './pages/StockManagement';
import PropertyIssuance from './pages/PropertyIssuance';
import Inspections from './pages/Inspections';
import Procurement from './pages/Procurement';
import Reports from './pages/Reports';
import Users from './pages/Users';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';
import SettingsLayout, { SettingsIndexRedirect } from './components/SettingsLayout';
import Departments from './pages/Departments';
import Suppliers from './pages/Suppliers';
import SystemInfo from './pages/SystemInfo';
import AnalyticsLayout, { AnalyticsIndexRedirect } from './components/AnalyticsLayout';
import AiAssistant from './pages/AiAssistant';
import AiAnalytics from './pages/AiAnalytics';
import AiExecutive from './pages/AiExecutive';
import { IcsRecordsPage, ParRecordsPage } from './pages/AccountabilityRegistry';
import Masterlist from './pages/Masterlist';
import Tracking from './pages/Tracking';
import ItemRegistry from './pages/ItemRegistry';
import PoItems from './pages/PoItems';
import Communications from './pages/Communications';
import FloatingChatWidget from './components/FloatingChatWidget';
import FleetLayout, { FleetIndexRedirect } from './pages/fleet/FleetLayout';
import FleetDashboard from './pages/fleet/FleetDashboard';
import FleetLiveMap from './pages/fleet/FleetLiveMap';
import FleetSchedules from './pages/fleet/FleetSchedules';
import FleetVehicles from './pages/fleet/FleetVehicles';
import FleetRegistration from './pages/fleet/FleetRegistration';
import FleetDriversLicense from './pages/fleet/FleetDriversLicense';
import FleetInsurance from './pages/fleet/FleetInsurance';
import FleetReports from './pages/fleet/FleetReports';
import DocumentTracking from './pages/documents/DocumentTracking';
import DocumentDetail from './pages/documents/DocumentDetail';
import DocumentReports from './pages/documents/DocumentReports';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function EmployeeBlockedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (user?.role?.slug === 'department_user') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeIndexRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (user?.role?.slug === 'document_tracking' || user?.role?.slug === 'document_tracking_admin') {
    return <Navigate to="/documents" replace />;
  }
  if (user?.role?.slug === 'gso_inventory_officer') {
    return <Navigate to="/item-registry" replace />;
  }
  return <Dashboard />;
}

function AppRoutes() {
  return (
    <>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<HomeIndexRedirect />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="receiving" element={<Receiving />} />
        <Route path="catalog" element={<ItemCatalog />} />
        <Route path="real-properties" element={<RealProperties />} />
        <Route path="individual-property-accountability" element={<EmployeeBlockedRoute><IndividualPropertyAccountability /></EmployeeBlockedRoute>} />
        <Route path="temporary-certificate" element={<EmployeeBlockedRoute><TemporaryCertificate /></EmployeeBlockedRoute>} />
        <Route path="pre-post-inspection-repair" element={<EmployeeBlockedRoute><PrePostInspectionRepair /></EmployeeBlockedRoute>} />
        <Route path="new-inventory-request" element={<EmployeeBlockedRoute><NewInventoryRequest /></EmployeeBlockedRoute>} />
        <Route path="incoming-inventory-requests" element={<EmployeeBlockedRoute><IncomingInventoryRequests /></EmployeeBlockedRoute>} />
        <Route path="requests" element={<Requests />} />
        <Route path="acceptance-inspection" element={<Navigate to="/procurement/air" replace />} />
        <Route path="item-registry" element={<EmployeeBlockedRoute><ItemRegistry /></EmployeeBlockedRoute>} />
        <Route path="po-items" element={<EmployeeBlockedRoute><PoItems /></EmployeeBlockedRoute>} />
        <Route path="fleet" element={<FleetLayout />}>
          <Route index element={<FleetIndexRedirect />} />
          <Route path="dashboard" element={<FleetDashboard />} />
          <Route path="map" element={<FleetLiveMap />} />
          <Route path="schedules" element={<FleetSchedules />} />
          <Route path="vehicles" element={<FleetVehicles />} />
          <Route path="registration" element={<FleetRegistration />} />
          <Route path="drivers-license" element={<FleetDriversLicense />} />
          <Route path="insurance" element={<FleetInsurance />} />
          <Route path="reports" element={<FleetReports />} />
        </Route>
        <Route path="documents/reports" element={<EmployeeBlockedRoute><DocumentReports /></EmployeeBlockedRoute>} />
        <Route path="documents" element={<EmployeeBlockedRoute><DocumentTracking /></EmployeeBlockedRoute>} />
        <Route path="documents/:id" element={<EmployeeBlockedRoute><DocumentDetail /></EmployeeBlockedRoute>} />
        <Route path="material-releases" element={<Navigate to="/procurement/mr-release" replace />} />
        <Route path="procurement" element={<EmployeeBlockedRoute><Procurement /></EmployeeBlockedRoute>} />
        <Route path="procurement/:section" element={<EmployeeBlockedRoute><Procurement /></EmployeeBlockedRoute>} />
        <Route path="ics-records" element={<EmployeeBlockedRoute><IcsRecordsPage /></EmployeeBlockedRoute>} />
        <Route path="par-records" element={<EmployeeBlockedRoute><ParRecordsPage /></EmployeeBlockedRoute>} />
        <Route path="masterlist" element={<EmployeeBlockedRoute><Masterlist /></EmployeeBlockedRoute>} />
        <Route path="tracking" element={<EmployeeBlockedRoute><Tracking /></EmployeeBlockedRoute>} />
        <Route path="assets" element={<Assets />} />
        <Route path="communications" element={<Communications />} />
        <Route path="stock" element={<StockManagement />} />
        <Route path="property" element={<EmployeeBlockedRoute><PropertyIssuance /></EmployeeBlockedRoute>} />
        <Route path="inspections" element={<Inspections />} />
        <Route path="reports" element={<Reports />} />
        <Route path="analytics" element={<AnalyticsLayout />}>
          <Route index element={<AnalyticsIndexRedirect />} />
          <Route path="ai-assistant" element={<AiAssistant />} />
          <Route path="kpis" element={<AiAnalytics />} />
          <Route path="executive" element={<AiExecutive />} />
        </Route>
        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<SettingsIndexRedirect />} />
          <Route path="account" element={<Settings />} />
          <Route path="users" element={<Users />} />
          <Route path="categories" element={<Categories />} />
          <Route path="departments" element={<Departments />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="audit" element={<AuditLogs />} />
          <Route path="system" element={<SystemInfo />} />
        </Route>
        <Route path="users" element={<Navigate to="/settings/users" replace />} />
        <Route path="audit-logs" element={<Navigate to="/settings/audit" replace />} />
        <Route path="categories" element={<Navigate to="/settings/categories" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <FloatingChatWidget />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
