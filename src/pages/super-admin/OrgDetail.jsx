import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Shield, Users, UserPlus, Loader2, Trash2, Mail } from 'lucide-react';

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

export default function OrgDetail() {
  const { orgId } = useParams();
  const [org, setOrg] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create admin form
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', password: '', full_name: '' });
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [adminResult, setAdminResult] = useState(null);

  useEffect(() => { loadOrg(); }, [orgId]);

  const loadOrg = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/organisations/${orgId}`);
      setOrg(data);
      setUsers(data.users || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleAddAdmin = async () => {
    if (!adminForm.email || !adminForm.password) return;
    setAddingAdmin(true);
    setAdminResult(null);
    try {
      await apiFetch('/api/auth/create-admin', {
        method: 'POST',
        body: JSON.stringify({ ...adminForm, org_id: orgId }),
      });
      setAdminResult({ type: 'success', message: `Admin ${adminForm.email} created!` });
      setAdminForm({ email: '', password: '', full_name: '' });
      loadOrg();
    } catch (e) {
      setAdminResult({ type: 'error', message: e.message });
    }
    setAddingAdmin(false);
  };

  const admins = users.filter(u => u.role === 'admin');
  const cleaners = users.filter(u => u.role === 'user');

  if (loading) return <div className="min-h-screen bg-dark-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;

  return (
    <div className="min-h-screen bg-dark-900">
      <header className="bg-dark-800/80 backdrop-blur-xl border-b border-dark-700/50 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link to="/super"><button className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></button></Link>
          <Building2 className="w-5 h-5 text-accent" />
          <div>
            <h1 className="font-bold text-white">{org?.name}</h1>
            <p className="text-xs text-dark-500">{org?.slug}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Add Admin */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" /> Admins ({admins.length})
            </h2>
            <button className="btn-primary text-sm flex items-center gap-1.5" onClick={() => setShowAddAdmin(!showAddAdmin)}>
              <UserPlus className="w-4 h-4" /> Add Admin
            </button>
          </div>

          {showAddAdmin && (
            <div className="bg-dark-700/50 rounded-xl p-4 mb-4 space-y-3 animate-slide-up">
              <input className="input-dark w-full" placeholder="Full name" value={adminForm.full_name}
                onChange={e => setAdminForm(f => ({ ...f, full_name: e.target.value }))} />
              <input className="input-dark w-full" placeholder="Email" type="email" value={adminForm.email}
                onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))} />
              <input className="input-dark w-full" placeholder="Password" type="password" value={adminForm.password}
                onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))} />
              <div className="flex gap-2">
                <button className="btn-ghost flex-1 border border-dark-600 text-sm" onClick={() => setShowAddAdmin(false)}>Cancel</button>
                <button className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5"
                  onClick={handleAddAdmin} disabled={!adminForm.email || !adminForm.password || addingAdmin}>
                  {addingAdmin && <Loader2 className="w-4 h-4 animate-spin" />} Create Admin
                </button>
              </div>
              {adminResult && (
                <p className={`text-sm ${adminResult.type === 'success' ? 'text-success' : 'text-danger'}`}>
                  {adminResult.message}
                </p>
              )}
            </div>
          )}

          {admins.length === 0 ? (
            <p className="text-dark-500 text-sm">No admins yet. Add one above.</p>
          ) : (
            <div className="space-y-2">
              {admins.map(admin => (
                <div key={admin.id} className="flex items-center gap-3 p-3 bg-dark-700/30 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-purple-500/15 flex items-center justify-center text-purple-400 font-bold">
                    {admin.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{admin.full_name || 'Unnamed'}</p>
                    <p className="text-xs text-dark-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {admin.email}</p>
                  </div>
                  <span className="badge bg-purple-500/15 text-purple-400 border-purple-500/20">Admin</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cleaners */}
        <div className="card p-5">
          <h2 className="font-semibold text-white flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-accent" /> Cleaners ({cleaners.length})
          </h2>
          <p className="text-xs text-dark-500 mb-3">Cleaners are invited by admins from within the app.</p>
          {cleaners.length === 0 ? (
            <p className="text-dark-500 text-sm">No cleaners yet. Admins can invite them from the Team page.</p>
          ) : (
            <div className="space-y-2">
              {cleaners.map(cleaner => (
                <div key={cleaner.id} className="flex items-center gap-3 p-3 bg-dark-700/30 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-accent font-bold">
                    {cleaner.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{cleaner.full_name || 'Unnamed'}</p>
                    <p className="text-xs text-dark-400">{cleaner.email}</p>
                  </div>
                  <span className="badge bg-accent/15 text-accent-light border-accent/20">Cleaner</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
