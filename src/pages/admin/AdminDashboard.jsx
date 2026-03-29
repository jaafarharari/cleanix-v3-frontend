import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Plus, TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import AdminNav from '@/components/AdminNav';

const statusBadge = {
  pending: 'badge-pending',
  assigned: 'badge-assigned',
  in_progress: 'badge-in-progress',
  complete: 'badge-complete',
  cancelled: 'badge-cancelled',
};

export default function AdminDashboard() {
  const [jobs, setJobs] = useState([]);
  const [issues, setIssues] = useState([]);
  const [cityFilter, setCityFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [jobData, issueData] = await Promise.all([
        api.entities.Job.filter({ scheduled_date: today }),
        api.entities.MaintenanceIssue.filter({ status: 'open' }),
      ]);
      setJobs(jobData);
      setIssues(issueData);
      setLoading(false);
    };
    fetch();
  }, []);

  const cities = ['All', ...new Set(jobs.map(j => j.city).filter(Boolean))];
  const filtered = cityFilter === 'All' ? jobs : jobs.filter(j => j.city === cityFilter);

  const stats = {
    total: jobs.length,
    complete: jobs.filter(j => j.status === 'complete').length,
    in_progress: jobs.filter(j => j.status === 'in_progress').length,
    unassigned: jobs.filter(j => j.status === 'pending').length,
  };

  const urgentUnassigned = jobs.filter(
    j => j.status === 'pending' && j.checkin_time &&
      new Date(`${today}T${j.checkin_time}`) - new Date() < 4 * 60 * 60 * 1000
  );

  return (
    <div className="min-h-screen bg-dark-900">
      <AdminNav />
      <main className="max-w-7xl mx-auto px-6 py-8 pb-16">
        {urgentUnassigned.length > 0 && (
          <div className="mb-6 bg-danger/10 border border-danger/20 rounded-xl p-4 flex items-center gap-3 glow-danger animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0" />
            <p className="text-danger font-medium text-sm">
              {urgentUnassigned.length} unassigned job{urgentUnassigned.length > 1 ? 's' : ''} with check-in within 4 hours!
            </p>
            <Link to="/jobs" className="ml-auto">
              <button className="btn-danger text-sm px-3 py-1.5">View Jobs</button>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Today', value: stats.total, icon: TrendingUp, color: 'text-dark-100' },
            { label: 'Complete', value: stats.complete, icon: CheckCircle2, color: 'text-success' },
            { label: 'In Progress', value: stats.in_progress, icon: Clock, color: 'text-purple-400' },
            { label: 'Unassigned', value: stats.unassigned, icon: AlertTriangle, color: 'text-warning' },
          ].map(s => (
            <div key={s.label} className="card p-5 animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`w-4 h-4 ${s.color} opacity-60`} />
                <p className="text-sm text-dark-400">{s.label}</p>
              </div>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {cities.map(c => (
            <button key={c} onClick={() => setCityFilter(c)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                cityFilter === c
                  ? 'bg-accent/15 text-accent-light border-accent/30'
                  : 'bg-dark-800 text-dark-400 border-dark-700 hover:border-dark-600 hover:text-dark-200'
              }`}>{c}</button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Today's Jobs</h2>
                <div className="flex items-center gap-2">
                  <button className="btn-ghost text-sm border border-dark-700 flex items-center gap-1.5" onClick={() => { setLoading(true); Promise.all([api.entities.Job.filter({ scheduled_date: today }), api.entities.MaintenanceIssue.filter({ status: 'open' })]).then(([j, i]) => { setJobs(j); setIssues(i); setLoading(false); }); }}>
                  <RefreshCw className="w-4 h-4" /> Refresh
                  </button>
                  <Link to="/jobs">
                  <button className="btn-primary text-sm flex items-center gap-1.5">
                  <Plus className="w-4 h-4" />New Job
                  </button>
                  </Link>
                </div>
          </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-dark-500">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No jobs scheduled today{cityFilter !== 'All' ? ` for ${cityFilter}` : ''}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(job => (
              <div key={job.id} className="card-hover p-4 flex items-center gap-4 cursor-pointer animate-slide-up"
                onClick={() => navigate(`/job?id=${job.id}`)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white truncate">{job.property_name}</p>
                    <span className={`badge ${statusBadge[job.status]}`}>{job.status.replace('_', ' ')}</span>
                  </div>
                  <p className="text-sm text-dark-400 mt-0.5">{job.city}</p>
                </div>
                <div className="text-right text-sm flex-shrink-0">
                  {job.cleaner_name ? (
                    <p className="font-medium text-dark-200">{job.cleaner_name}</p>
                  ) : (
                    <p className="text-warning font-medium">Unassigned</p>
                  )}
                  {job.checkin_time && (
                    <p className="flex items-center gap-1 justify-end text-dark-500">
                      <Clock className="w-3 h-3" /> {job.checkin_time}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
