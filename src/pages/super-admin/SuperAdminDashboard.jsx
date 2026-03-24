import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { Building2, Users, Plus, Loader2, Shield, Sparkles, LogOut } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function apiFetch(path, options = {}) {
  const token = localStorage.getItem('cleanix_access_token');
  return fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    ...options,
  }).then(async r => {
    const json = await r.json();
    if (!r.ok) throw new Error(json.error || 'Request failed');
    return json;
  });
}

export default function SuperAdminDashboard() {
  const { logout } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiFetch('/api/organisations').then(data => { setOrgs(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleCreateOrg = async () => {
    if (!orgName.trim()) return;
    setCreating(true);
    try {
      const org = await apiFetch('/api/organisations', { method: 'POST', body: JSON.stringify({ name: orgName.trim() }) });
      setOrgs(prev => [{ ...org, admin_count: 0, cleaner_count: 0 }, ...prev]);
      setOrgName('');
      setShowCreateOrg(false);
    } catch (e) { alert(e.message); }
    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <header className="bg-dark-800/80 backdrop-blur-xl border-b border-dark-700/50 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-600/20">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">CleanOps</span>
            <span className="badge bg-purple-500/15 text-purple-400 border border-purple-500/20 text-[10px]">Super Admin</span>
          </div>
          <div className="ml-auto">
            <button onClick={logout} className="btn-ghost p-2"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Organisations</h1>
            <p className="text-sm text-dark-400 mt-1">Manage organisations, admins, and cleaners</p>
          </div>
          <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowCreateOrg(true)}>
            <Plus className="w-4 h-4" /> New Organisation
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
        ) : orgs.length === 0 ? (
          <div className="text-center py-20 text-dark-500">
            <Building2 className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No organisations yet</p>
            <p className="text-sm mt-1">Create your first organisation to get started</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orgs.map(org => (
              <Link key={org.id} to={`/super/org/${org.id}`}>
                <div className="card-hover p-5 animate-slide-up">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{org.name}</p>
                      <p className="text-xs text-dark-500">{org.slug}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-dark-400">
                      <Shield className="w-3.5 h-3.5" />
                      <span>{org.admin_count || 0} admin{org.admin_count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-dark-400">
                      <Users className="w-3.5 h-3.5" />
                      <span>{org.cleaner_count || 0} cleaner{org.cleaner_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {!org.is_active && <span className="badge bg-danger/15 text-danger border-danger/20 mt-3">Inactive</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {showCreateOrg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreateOrg(false)}>
          <div className="card p-6 w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg text-white mb-4">New Organisation</h2>
            <input className="input-dark w-full mb-4" placeholder="Organisation name" value={orgName} onChange={e => setOrgName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateOrg()} autoFocus />
            <div className="flex gap-3">
              <button className="btn-ghost flex-1 border border-dark-700" onClick={() => setShowCreateOrg(false)}>Cancel</button>
              <button className="btn-primary flex-1 flex items-center justify-center gap-1.5" onClick={handleCreateOrg} disabled={!orgName.trim() || creating}>
                {creating && <Loader2 className="w-4 h-4 animate-spin" />} Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
