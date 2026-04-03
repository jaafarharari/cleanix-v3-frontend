import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import OfflineBanner from '@/components/OfflineBanner';

import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';

import SuperAdminDashboard from './pages/super-admin/SuperAdminDashboard';
import OrgDetail from './pages/super-admin/OrgDetail';
import Invoices from './pages/super-admin/Invoices';

import AdminDashboard from './pages/admin/AdminDashboard';
import Properties from './pages/admin/Properties';
import TeamManagement from './pages/admin/TeamManagement';
import AdminJobs from './pages/admin/AdminJobs';
import JobDetail from './pages/admin/JobDetail';
import MaintenanceIssues from './pages/admin/MaintenanceIssues';
import LiveOpsBoard from './pages/admin/LiveOpsBoard';
import ShiftManagement from './pages/admin/ShiftManagement';
import PMSImport from './pages/admin/PMSImport';
import Reports from './pages/admin/Reports';

import CleanerHome from './pages/cleaner/CleanerHome';
import CleanerJobDetail from './pages/cleaner/CleanerJobDetail';
import CleanerReport from './pages/cleaner/CleanerReport';

function getHomeRoute(role) {
  if (role === 'super_admin') return '/super';
  if (role === 'admin' || role === 'tm') return '/dashboard';
  return '/cleaner';
}
const AuthenticatedApp = () => {
  const { isLoadingAuth, user, isAuthenticated } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-dark-900">
        <div className="w-8 h-8 border-4 border-dark-700 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const home = getHomeRoute(user?.role);

  return (
    <Routes>
      <Route path="/" element={<Navigate to={home} replace />} />
      <Route path="/super" element={<SuperAdminDashboard />} />
      <Route path="/super/org/:orgId" element={<OrgDetail />} />
      <Route path="/super/invoices" element={<Invoices />} />
      <Route path="/dashboard" element={<AdminDashboard />} />
      <Route path="/properties" element={<Properties />} />
      <Route path="/team" element={<TeamManagement />} />
      <Route path="/jobs" element={<AdminJobs />} />
      <Route path="/job" element={<JobDetail />} />
      <Route path="/issues" element={<MaintenanceIssues />} />
      <Route path="/live-ops" element={<LiveOpsBoard />} />
      <Route path="/shifts" element={<ShiftManagement />} />
      <Route path="/pms" element={<PMSImport />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/cleaner" element={<CleanerHome />} />
      <Route path="/cleaner/job" element={<CleanerJobDetail />} />
      <Route path="/cleaner/report" element={<CleanerReport />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <OfflineBanner />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<AuthenticatedApp />} />
          </Routes>
        </Router>
      </QueryClientProvider>
    </AuthProvider>
  );
}
