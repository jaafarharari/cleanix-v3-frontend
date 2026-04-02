import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { Users, UserPlus, Mail, Loader2, Shield } from 'lucide-react';
import AdminNav from '@/components/AdminNav';

export default function TeamManagement() {
  const [members, setMembers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  useEffect(() => {
    Promise.all([api.entities.User.list(), api.entities.Job.filter({ status: 'complete' })]).then(([users, jobData]) => {
      setMembers(users.filter(u => u.role === 'user' || u.role === 'tm'));
      setJobs(jobData);
      setLoading(false);
    });
  }, []);

  const getStats = (email) => {
    const cj = jobs.filter(j => j.cleaner_email === email);
    const avg = cj.reduce((acc, j) => {
      if (j.clock_in_time && j.clock_out_time) return acc + (new Date(j.clock_out_time) - new Date(j.clock_in_time)) / 60000;
      return acc;
    }, 0) / (cj.length || 1);
    return { completed: cj.length, avgMinutes: Math.round(avg) };
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteName) return;
    setInviting(true);
    try {
      const result = await api.users.inviteUser(inviteEmail, inviteRole, inviteName);
      const roleLabel = inviteRole === 'tm' ? 'Team Manager' : 'Cleaner';
      setInviteResult({ type: 'success', message: `${roleLabel} invited! Temp password: ${result.temp_password}` });
      setInviteEmail('');
      setInviteName('');
      setInviteRole('user');
      // Refresh list
      const users = await api.entities.User.list();
      setMembers(users.filter(u => u.role === 'user' || u.role === 'tm'));
    } catch (e) {
      setInviteResult({ type: 'error', message: e.message || 'Invite failed' });
    }
    setInviting(false);
    setTimeout(() => setInviteResult(null), 15000);
  };

  const cleaners = members.filter(m => m.role === 'user');
  const teamManagers = members.filter(m => m.role === 'tm');

  return (
    <div className="min-h-screen bg-dark-900">
      <AdminNav />
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-bold text-white">Team</h1>
        </div>

        {/* Invite form */}
        <div className="card p-5">
          <p className="font-semibold text-white mb-3 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-accent" /> Invite team member
          </p>
          <div className="space-y-3">
            <div className="flex gap-3">
              <input type="text" className="input-dark flex-1" placeholder="Full name" value={inviteName}
                onChange={e => setInviteName(e.target.value)} />
              <input type="email" className="input-dark flex-1" placeholder="email@example.com" value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleInvite()} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setInviteRole('user')}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  inviteRole === 'user' ? 'bg-accent/15 text-accent-light border-accent/30' : 'bg-dark-800 text-dark-400 border-dark-700 hover:border-dark-600'
                }`}>
                Cleaner
              </button>
              <button onClick={() => setInviteRole('tm')}
                className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  inviteRole === 'tm' ? 'bg-teal-500/15 text-teal-400 border-teal-500/30' : 'bg-dark-800 text-dark-400 border-dark-700 hover:border-dark-600'
                }`}>
                Team Manager
              </button>
            </div>
            <button className="btn-primary w-full" onClick={handleInvite} disabled={!inviteEmail || !inviteName || inviting}>
              {inviting ? 'Sending...' : `Invite as ${inviteRole === 'tm' ? 'Team Manager' : 'Cleaner'}`}
            </button>
          </div>
          {inviteResult && (
            <p className={`text-sm mt-2 ${inviteResult.type === 'success' ? 'text-success' : 'text-danger'}`}>
              {inviteResult.message}
            </p>
          )}
        </div>

        {/* Team Managers */}
        {teamManagers.length > 0 && (
          <div>
            <h2 className="font-semibold text-dark-300 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-400" /> Team Managers ({teamManagers.length})
            </h2>
            <div className="space-y-3">
              {teamManagers.map(tm => (
                <div key={tm.id} className="card p-4 flex items-center gap-4 animate-slide-up">
                  <div className="w-10 h-10 rounded-full bg-teal-500/15 flex items-center justify-center text-teal-400 font-bold text-lg flex-shrink-0">
                    {tm.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white">{tm.full_name}</p>
                    <p className="text-sm text-dark-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {tm.email}</p>
                  </div>
                  <span className="badge bg-teal-500/15 text-teal-400 border border-teal-500/20">TM</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cleaners */}
        <div>
          <h2 className="font-semibold text-dark-300 mb-3">Cleaners ({cleaners.length})</h2>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
          ) : cleaners.length === 0 ? (
            <div className="text-center py-12 text-dark-500">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No cleaners yet. Invite someone above!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cleaners.map(cleaner => {
                const stats = getStats(cleaner.email);
                return (
                  <div key={cleaner.id} className="card p-4 flex items-center gap-4 animate-slide-up">
                    <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center text-accent font-bold text-lg flex-shrink-0">
                      {cleaner.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-white">{cleaner.full_name}</p>
                      <p className="text-sm text-dark-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {cleaner.email}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium text-dark-200">{stats.completed} jobs</p>
                      {stats.completed > 0 && <p className="text-dark-400">avg {stats.avgMinutes}m</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
