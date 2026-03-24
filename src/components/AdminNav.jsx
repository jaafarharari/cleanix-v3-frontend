import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { LayoutDashboard, Briefcase, Home, Users, Activity, AlertTriangle, Download, Calendar, LogOut, Sparkles, Bell } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/live-ops', label: 'Live Ops', icon: Activity },
  { path: '/jobs', label: 'Jobs', icon: Briefcase },
  { path: '/properties', label: 'Properties', icon: Home },
  { path: '/team', label: 'Team', icon: Users },
  { path: '/shifts', label: 'Shifts', icon: Calendar },
  { path: '/issues', label: 'Issues', icon: AlertTriangle },
  { path: '/pms', label: 'PMS', icon: Download },
];

export default function AdminNav() {
  const location = useLocation();
  const { logout, user } = useAuth();
  const [openIssues, setOpenIssues] = useState(0);
  const { isSubscribed, isSupported, subscribe } = usePushNotifications();

  useEffect(() => {
    api.entities.MaintenanceIssue.filter({ status: 'open' }).then(d => setOpenIssues(d.length)).catch(() => {});
  }, []);

  return (
    <header className="bg-dark-800/80 backdrop-blur-xl border-b border-dark-700/50 px-4 py-3 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center gap-4 overflow-x-auto">
        <Link to="/dashboard" className="flex items-center gap-2.5 flex-shrink-0 mr-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-sm">CleanOps</span>
          {user?.organisation && <span className="text-xs text-dark-500 hidden md:inline">· {user.organisation.name}</span>}
          <span className="badge bg-accent/15 text-accent-light border border-accent/20 text-[10px]">Admin</span>
        </Link>
        <nav className="flex items-center gap-1 flex-nowrap">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link key={path} to={path}>
                <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap relative ${
                  active ? 'bg-accent/15 text-accent-light' : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/50'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {label === 'Issues' && openIssues > 0 && (
                    <span className="ml-1 bg-danger text-white text-[10px] rounded-full px-1.5 leading-4 font-bold">{openIssues}</span>
                  )}
                </button>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {isSupported && !isSubscribed && (
            <button onClick={subscribe} className="btn-ghost p-2" title="Enable notifications"><Bell className="w-4 h-4" /></button>
          )}
          <button onClick={logout} className="btn-ghost p-2" title="Logout"><LogOut className="w-4 h-4" /></button>
        </div>
      </div>
    </header>
  );
}
