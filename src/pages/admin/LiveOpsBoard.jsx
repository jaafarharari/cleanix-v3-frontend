import { useState, useEffect, useRef } from 'react';
import api from '@/api/apiClient';
import { Link } from 'react-router-dom';
import { Activity, Clock, RefreshCw, User, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import AdminNav from '@/components/AdminNav';

const columns = [
  { key: 'pending', label: 'Unassigned', color: 'border-warning', glow: 'shadow-warning/5' },
  { key: 'assigned', label: 'Assigned', color: 'border-blue-500', glow: 'shadow-blue-500/5' },
  { key: 'in_progress', label: 'In Progress', color: 'border-purple-500', glow: 'shadow-purple-500/5' },
  { key: 'complete', label: 'Complete', color: 'border-success', glow: 'shadow-success/5' },
];

function timeSince(ts) {
  if (!ts) return null;
  const mins = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function JobCard({ job }) {
  const isUrgent = job.status !== 'complete' && job.checkin_time &&
    new Date(`${job.scheduled_date}T${job.checkin_time}`) - new Date() < 2 * 60 * 60 * 1000 &&
    new Date(`${job.scheduled_date}T${job.checkin_time}`) > new Date();

  return (
    <Link to={`/job?id=${job.id}`}>
      <div className={`bg-dark-700/50 rounded-xl border p-3 hover:bg-dark-700 transition-all cursor-pointer ${isUrgent ? 'border-danger/40 glow-danger' : 'border-dark-600/50'}`}>
        {isUrgent && (
          <div className="flex items-center gap-1 text-danger text-xs font-medium mb-1">
            <AlertTriangle className="w-3 h-3" /> Urgent
          </div>
        )}
        <div className="font-semibold text-sm text-white truncate">{job.property_name}</div>
        <div className="text-xs text-dark-400 mt-0.5">{job.city}</div>
        <div className="flex items-center gap-1 mt-2 text-xs text-dark-400">
          <User className="w-3 h-3" />
          {job.cleaner_name || <span className="text-warning font-medium">Unassigned</span>}
        </div>
        {job.checklist?.length > 0 && job.status === 'in_progress' && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-dark-500 mb-1">
              <span>Checklist</span>
              <span>{job.checklist.filter(c => c.completed).length}/{job.checklist.length}</span>
            </div>
            <div className="w-full bg-dark-600 rounded-full h-1.5">
              <div className="bg-purple-500 h-1.5 rounded-full transition-all"
                style={{ width: `${(job.checklist.filter(c => c.completed).length / job.checklist.length) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function LiveOpsBoard() {
  const [jobs, setJobs] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchJobs = async () => {
    const data = await api.entities.Job.filter({ scheduled_date: today });
    setJobs(data);
    setLastRefresh(new Date());
  };

  useEffect(() => { fetchJobs(); }, []);

  useEffect(() => {
    if (autoRefresh) intervalRef.current = setInterval(fetchJobs, 30000);
    else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh]);

  useEffect(() => {
    const unsub = api.entities.Job.subscribe((event) => {
      if (event.type === 'update') setJobs(prev => prev.map(j => j.id === event.id ? event.data : j));
      else if (event.type === 'create' && event.data.scheduled_date === today) setJobs(prev => [...prev, event.data]);
      else if (event.type === 'delete') setJobs(prev => prev.filter(j => j.id !== event.id));
      setLastRefresh(new Date());
    });
    return unsub;
  }, []);

  const jobsByStatus = (status) => jobs.filter(j => j.status === status);

  return (
    <div className="min-h-screen bg-dark-900">
      <AdminNav />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-success" />
            <h1 className="text-xl font-bold text-white">Live Ops Board</h1>
            <span className="text-sm text-dark-500">{format(new Date(), 'EEEE, MMM d')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-500">{format(lastRefresh, 'HH:mm:ss')}</span>
            <button onClick={() => setAutoRefresh(v => !v)}
              className={`btn-ghost text-xs flex items-center gap-1 border ${autoRefresh ? 'border-success/30 text-success' : 'border-dark-700 text-dark-500'}`}>
              <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin' : ''}`} style={autoRefresh ? { animationDuration: '3s' } : {}} />
              {autoRefresh ? 'Live' : 'Paused'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {columns.map(col => (
            <div key={col.key} className={`card p-3 border-l-4 ${col.color}`}>
              <div className="text-2xl font-bold text-white">{jobsByStatus(col.key).length}</div>
              <div className="text-xs text-dark-400 mt-0.5">{col.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {columns.map(col => (
            <div key={col.key} className={`card border-t-2 ${col.color} ${col.glow}`}>
              <div className="p-3 border-b border-dark-700/50 flex items-center justify-between">
                <span className="font-semibold text-sm text-dark-200">{col.label}</span>
                <span className="text-xs font-bold text-dark-400">{jobsByStatus(col.key).length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[300px]">
                {jobsByStatus(col.key).map(job => <JobCard key={job.id} job={job} />)}
                {jobsByStatus(col.key).length === 0 && (
                  <div className="text-center py-8 text-dark-600 text-sm">No jobs</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
