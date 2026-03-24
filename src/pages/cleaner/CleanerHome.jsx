import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw, Clock, AlertCircle, Home, LogOut, Sparkles, Bell, Flag } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const statusBadge = { pending: 'badge-pending', assigned: 'badge-assigned', in_progress: 'badge-in-progress', complete: 'badge-complete', cancelled: 'badge-cancelled' };

export default function CleanerHome() {
  const [jobs, setJobs] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { logout } = useAuth();
  const { isSubscribed, isSupported, subscribe } = usePushNotifications();
  const today = format(new Date(), 'yyyy-MM-dd');
  const navigate = useNavigate();

  const fetchJobs = async () => {
    setLoading(true);
    const me = await api.auth.me();
    setUser(me);
    const data = await api.entities.Job.filter({ cleaner_email: me.email, scheduled_date: today });
    data.sort((a, b) => (a.checkout_time || '').localeCompare(b.checkout_time || ''));
    setJobs(data);
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, []);

  const isUrgent = (job) => {
    if (job.status === 'complete' || !job.checkin_time) return false;
    const checkinDate = new Date(`${today}T${job.checkin_time}`);
    return differenceInMinutes(checkinDate, new Date()) < 180;
  };

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col pb-20">
      <header className="bg-dark-800/80 backdrop-blur-xl border-b border-dark-700/50 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">CleanOps</h1>
            {user && <p className="text-xs text-dark-400">{user.full_name}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {isSupported && !isSubscribed && (
            <button className="btn-ghost p-2" onClick={subscribe}><Bell className="w-4 h-4" /></button>
          )}
          <button className="btn-ghost p-2" onClick={fetchJobs}><RefreshCw className="w-4 h-4" /></button>
          <button className="btn-ghost p-2" onClick={logout}><LogOut className="w-4 h-4" /></button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Today's Jobs</h2>
          <p className="text-sm text-dark-400">{format(new Date(), 'EEEE, MMMM d')}</p>
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-dark-800 rounded-2xl animate-pulse" />)}</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 text-dark-500">
            <Home className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No jobs assigned for today</p>
            <p className="text-sm mt-1">Contact your host if you think this is a mistake</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map(job => (
              <Link key={job.id} to={`/cleaner/job?id=${job.id}`}>
                <div className={`card-hover p-4 ${isUrgent(job) ? 'border-danger/30 glow-danger' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-white">{job.property_name}</p>
                        {isUrgent(job) && <span className="flex items-center gap-1 text-xs font-medium text-danger"><AlertCircle className="w-3 h-3" /> Urgent</span>}
                      </div>
                      <p className="text-sm text-dark-400 mt-1">{job.city}</p>
                    </div>
                    <span className={`badge ${statusBadge[job.status]}`}>{job.status === 'complete' ? '✓ Done' : job.status.replace('_', ' ')}</span>
                  </div>
                  <div className="flex gap-4 mt-3 text-sm text-dark-500">
                    {job.checkout_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Out: {job.checkout_time}</span>}
                    {job.checkin_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-accent" /> In: {job.checkin_time}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Bottom nav for cleaners */}
      <nav className="fixed bottom-0 left-0 right-0 bg-dark-800/90 backdrop-blur-xl border-t border-dark-700/50 px-4 py-2 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-around">
          <Link to="/cleaner" className="flex flex-col items-center gap-1 py-1 text-accent">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Jobs</span>
          </Link>
          <Link to="/cleaner/report" className="flex flex-col items-center gap-1 py-1 text-dark-400 hover:text-dark-200">
            <Flag className="w-5 h-5" />
            <span className="text-[10px] font-medium">Report Issue</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
