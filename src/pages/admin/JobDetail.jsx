import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Video, Flag, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import AdminNav from '@/components/AdminNav';

const statusBadge = { pending: 'badge-pending', assigned: 'badge-assigned', in_progress: 'badge-in-progress', complete: 'badge-complete', cancelled: 'badge-cancelled' };

export default function JobDetail() {
  const [job, setJob] = useState(null);
  const [issues, setIssues] = useState([]);
  const [cleaners, setCleaners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const jobId = new URLSearchParams(window.location.search).get('id');

  useEffect(() => {
    if (!jobId) return;
    Promise.all([
      api.entities.Job.filter({ id: jobId }),
      api.entities.MaintenanceIssue.filter({ job_id: jobId }),
      api.entities.User.list(),
    ]).then(([jd, id, ud]) => { setJob(jd[0] || null); setIssues(id); setCleaners(ud.filter(u => u.role === 'user')); setLoading(false); });
  }, [jobId]);

  const handleOverride = async (field, value) => {
    setSaving(true);
    const updates = { [field]: value };
    if (field === 'cleaner_email') {
      const cleaner = cleaners.find(c => c.email === value);
      updates.cleaner_name = cleaner?.full_name || value;
      if (job.status === 'pending') {
        updates.status = 'assigned';
        updates.status_history = [...(job.status_history || []), { status: 'assigned', timestamp: new Date().toISOString(), changed_by: 'admin' }];
      }
      api.notifications.send([value], 'Job Assigned', `You've been assigned to ${job.property_name}`, `/cleaner/job?id=${job.id}`).catch(() => {});
    }
    const updated = await api.entities.Job.update(job.id, updates);
    setJob(updated);
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen bg-dark-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  if (!job) return <div className="min-h-screen bg-dark-900 flex items-center justify-center text-dark-500">Job not found.</div>;

  return (
    <div className="min-h-screen bg-dark-900">
      <AdminNav />
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <button className="btn-ghost p-2" onClick={() => navigate('/dashboard')}><ArrowLeft className="w-4 h-4" /></button>
          <div className="flex-1">
            <h1 className="font-bold text-white">{job.property_name}</h1>
            <p className="text-sm text-dark-400">{job.city} · {job.scheduled_date}</p>
          </div>
          <span className={`badge ${statusBadge[job.status]}`}>{job.status.replace('_', ' ')}</span>
        </div>

        <div className="card p-5 grid grid-cols-2 gap-4 text-sm">
          {[['Check-out', job.checkout_time], ['Check-in', job.checkin_time], ['Guests', job.guest_count], ['Source', job.booking_source],
            ...(job.clock_in_time ? [['Clocked In', format(new Date(job.clock_in_time), 'HH:mm')]] : []),
            ...(job.clock_out_time ? [['Clocked Out', format(new Date(job.clock_out_time), 'HH:mm')]] : []),
          ].map(([label, val]) => (
            <div key={label}><p className="text-xs text-dark-500">{label}</p><p className="font-medium text-dark-200">{val || '—'}</p></div>
          ))}
        </div>

        <div className="card p-5 space-y-4">
          <p className="font-semibold text-white">Admin Override</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-dark-500 mb-1.5 block">Assign Cleaner</label>
              <select className="input-dark w-full" value={job.cleaner_email || ''} onChange={e => handleOverride('cleaner_email', e.target.value)}>
                <option value="">Select cleaner</option>
                {cleaners.map(c => <option key={c.id} value={c.email}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-dark-500 mb-1.5 block">Override Status</label>
              <select className="input-dark w-full" value={job.status} onChange={e => handleOverride('status', e.target.value)}>
                {['pending', 'assigned', 'in_progress', 'complete', 'cancelled'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          {saving && <p className="text-xs text-accent">Saving...</p>}
        </div>

        {job.checklist?.length > 0 && (
          <div className="card p-5">
            <p className="font-semibold text-white mb-3">Checklist</p>
            <div className="space-y-2">
              {job.checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={`w-4 h-4 ${item.completed ? 'text-success' : 'text-dark-600'}`} />
                  <span className={item.completed ? 'text-dark-500 line-through' : 'text-dark-200'}>{item.task}</span>
                  {item.completed_at && <span className="text-xs text-dark-500 ml-auto">{format(new Date(item.completed_at), 'HH:mm')}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {(job.before_video_url || job.after_video_url) && (
          <div className="card p-5">
            <p className="font-semibold text-white mb-3">Videos</p>
            <div className="grid grid-cols-2 gap-4">
              {job.before_video_url && <div><p className="text-xs text-dark-500 mb-1">Before</p><video src={job.before_video_url} controls className="w-full rounded-lg" /></div>}
              {job.after_video_url && <div><p className="text-xs text-dark-500 mb-1">After</p><video src={job.after_video_url} controls className="w-full rounded-lg" /></div>}
            </div>
          </div>
        )}

        {job.cleaner_notes && (
          <div className="card p-5"><p className="font-semibold text-white mb-2">Cleaner Notes</p><p className="text-sm text-dark-300">{job.cleaner_notes}</p></div>
        )}

        {issues.length > 0 && (
          <div className="card p-5">
            <p className="font-semibold text-white mb-3 flex items-center gap-2"><Flag className="w-4 h-4 text-warning" /> Issues ({issues.length})</p>
            <div className="space-y-3">
              {issues.map(issue => (
                <div key={issue.id} className="bg-warning/5 border border-warning/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="badge bg-warning/15 text-warning border-warning/20">{issue.category}</span>
                    <span className={`badge ${issue.status === 'open' ? 'badge-open' : 'badge-resolved'}`}>{issue.status}</span>
                  </div>
                  <p className="text-sm text-dark-300">{issue.description}</p>
                  {issue.photo_urls?.length > 0 && (
                    <div className="flex gap-2 mt-2">{issue.photo_urls.map((url, i) => <img key={i} src={url} alt="" className="w-16 h-16 rounded object-cover border border-dark-700" />)}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {job.status_history?.length > 0 && (
          <div className="card p-5">
            <p className="font-semibold text-white mb-3">Status History</p>
            <div className="space-y-2">
              {job.status_history.map((h, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  <span className="font-medium text-dark-200 capitalize">{h.status?.replace('_', ' ')}</span>
                  <span className="text-dark-500">{h.timestamp ? format(new Date(h.timestamp), 'MMM d, HH:mm') : ''}</span>
                  <span className="text-dark-500 ml-auto">{h.changed_by}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
