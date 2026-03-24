import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft, Lock, CheckCircle2, Loader2, Home, Flag } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(false);
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const token = localStorage.getItem('cleanix_access_token');
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSuccess(true); setNewPassword(''); setConfirmPassword('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const isAdmin = user?.role === 'admin';
  const backPath = isAdmin ? '/dashboard' : '/cleaner';

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col pb-20">
      <header className="bg-dark-800/80 backdrop-blur-xl border-b border-dark-700/50 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link to={backPath}><button className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></button></Link>
        <Lock className="w-5 h-5 text-accent" />
        <h1 className="font-bold text-white">Change Password</h1>
      </header>
      <main className="flex-1 px-4 py-6 max-w-sm mx-auto w-full">
        {success && (
          <div className="bg-success/10 border border-success/20 rounded-xl p-4 flex items-center gap-3 mb-6 animate-slide-up glow-success">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <p className="text-success font-medium text-sm">Password changed successfully!</p>
          </div>
        )}
        <div className="card p-6">
          <p className="text-sm text-dark-400 mb-5">Enter your new password below. Must be at least 6 characters.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-dark-300 block mb-2">New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" required className="input-dark w-full" />
            </div>
            <div>
              <label className="text-sm font-medium text-dark-300 block mb-2">Confirm Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required className="input-dark w-full" />
            </div>
            {error && <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 text-sm text-danger">{error}</div>}
            <button type="submit" className="btn-primary w-full h-11 flex items-center justify-center gap-2" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Change Password
            </button>
          </form>
        </div>
      </main>
      {!isAdmin && (
        <nav className="fixed bottom-0 left-0 right-0 bg-dark-800/90 backdrop-blur-xl border-t border-dark-700/50 px-4 py-2 z-40">
          <div className="max-w-lg mx-auto flex items-center justify-around">
            <Link to="/cleaner" className="flex flex-col items-center gap-1 py-1 text-dark-400"><Home className="w-5 h-5" /><span className="text-[10px] font-medium">Jobs</span></Link>
            <Link to="/cleaner/report" className="flex flex-col items-center gap-1 py-1 text-dark-400"><Flag className="w-5 h-5" /><span className="text-[10px] font-medium">Report</span></Link>
          </div>
        </nav>
      )}
    </div>
  );
}
