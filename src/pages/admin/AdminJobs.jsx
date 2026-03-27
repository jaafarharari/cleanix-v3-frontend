import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Clock, X, Check, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import AdminNav from '@/components/AdminNav';

const statusBadge = { pending: 'badge-pending', assigned: 'badge-assigned', in_progress: 'badge-in-progress', complete: 'badge-complete', cancelled: 'badge-cancelled' };

const emptyForm = { property_id: '', property_name: '', city: '', cleaner_email: '', cleaner_name: '', scheduled_date: format(new Date(), 'yyyy-MM-dd'), checkout_time: '', checkin_time: '', booking_source: 'Airbnb', guest_count: '', host_notes: '' };

export default function AdminJobs() {
  const [jobs, setJobs] = useState([]);
  const [properties, setProperties] = useState([]);
  const [cleaners, setCleaners] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.entities.Job.list('-scheduled_date', 50),
      api.entities.Property.list(),
      api.entities.User.list(),
    ]).then(([j, p, u]) => {
      setJobs(j); setProperties(p); setCleaners(u.filter(x => x.role === 'user')); setLoading(false);
    });
  }, []);

  const handlePropertySelect = (e) => {
    const prop = properties.find(p => p.id === e.target.value);
    if (!prop) return;
    setForm(f => ({ ...f, property_id: prop.id, property_name: prop.name, city: prop.city }));
  };

  const handleCleanerSelect = (e) => {
    const cleaner = cleaners.find(c => c.email === e.target.value);
    setForm(f => ({ ...f, cleaner_email: e.target.value, cleaner_name: cleaner?.full_name || e.target.value }));
  };

  const handleCreate = async () => {
    const prop = properties.find(p => p.id === form.property_id);
    const checklist = (prop?.checklist_template || []).map(task => ({ task, completed: false, completed_at: null }));
    const checkout_checklist = (prop?.checkout_checklist_template || []).map(task => ({ task, completed: false }));
    const status = form.cleaner_email ? 'assigned' : 'pending';
    const created = await api.entities.Job.create({
      ...form, guest_count: form.guest_count ? parseInt(form.guest_count) : null,
      checklist, checkout_checklist, status,
      status_history: [{ status, timestamp: new Date().toISOString(), changed_by: 'admin' }],
    });
    setJobs(prev => [created, ...prev]);
    setShowForm(false);
    setForm(emptyForm);

    if (form.cleaner_email) {
      api.notifications.send([form.cleaner_email], 'New Job Assigned', `You have a new cleaning job at ${form.property_name} on ${form.scheduled_date}`, '/cleaner').catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <AdminNav />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">Jobs</h1>
          <button className="btn-primary text-sm flex items-center gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> New Job
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 text-dark-500">No jobs yet.</div>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => (
              <div key={job.id} className="card-hover p-4 flex items-center gap-4 cursor-pointer" onClick={() => navigate(`/job?id=${job.id}`)}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white">{job.property_name}</p>
                    <span className={`badge ${statusBadge[job.status]}`}>{job.status.replace('_', ' ')}</span>
                    {job.checkout_flags?.length > 0 && <span className="badge badge-open text-[10px]">{job.checkout_flags.length} flagged</span>}
                  </div>
                  <p className="text-sm text-dark-400">{job.city} · {job.scheduled_date}</p>
                </div>
                <div className="text-right text-sm">
                  {job.cleaner_name ? <p className="font-medium text-dark-200">{job.cleaner_name}</p> : <p className="text-warning font-medium">Unassigned</p>}
                  {job.checkin_time && <p className="flex items-center gap-1 justify-end text-dark-500"><Clock className="w-3 h-3" /> {job.checkin_time}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg text-white">New Job</h2>
              <button onClick={() => setShowForm(false)} className="text-dark-500 hover:text-dark-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-dark-400 block mb-1.5">Property *</label>
                <select className="input-dark w-full" value={form.property_id} onChange={handlePropertySelect}>
                  <option value="">Select property</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name} — {p.city}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-dark-400 block mb-1.5">Scheduled Date</label>
                <input type="date" className="input-dark w-full" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm text-dark-400 block mb-1.5">Check-out</label><input type="time" className="input-dark w-full" value={form.checkout_time} onChange={e => setForm({ ...form, checkout_time: e.target.value })} /></div>
                <div><label className="text-sm text-dark-400 block mb-1.5">Check-in</label><input type="time" className="input-dark w-full" value={form.checkin_time} onChange={e => setForm({ ...form, checkin_time: e.target.value })} /></div>
              </div>
              <div>
                <label className="text-sm text-dark-400 block mb-1.5">Assign Cleaner</label>
                <select className="input-dark w-full" value={form.cleaner_email} onChange={handleCleanerSelect}>
                  <option value="">Select cleaner (optional)</option>
                  {cleaners.map(c => <option key={c.id} value={c.email}>{c.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm text-dark-400 block mb-1.5">Source</label><select className="input-dark w-full" value={form.booking_source} onChange={e => setForm({ ...form, booking_source: e.target.value })}><option value="Airbnb">Airbnb</option><option value="Booking.com">Booking.com</option><option value="Other">Other</option></select></div>
                <div><label className="text-sm text-dark-400 block mb-1.5">Guests</label><input type="number" className="input-dark w-full" value={form.guest_count} onChange={e => setForm({ ...form, guest_count: e.target.value })} /></div>
              </div>
              <input className="input-dark w-full" placeholder="Host notes for cleaner" value={form.host_notes} onChange={e => setForm({ ...form, host_notes: e.target.value })} />
              <div className="flex gap-3 pt-2">
                <button className="btn-ghost flex-1 border border-dark-700" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn-primary flex-1 flex items-center justify-center gap-1.5" onClick={handleCreate} disabled={!form.property_id}>
                  <Check className="w-4 h-4" /> Create Job
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
