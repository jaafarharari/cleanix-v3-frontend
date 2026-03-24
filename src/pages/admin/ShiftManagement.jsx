import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { Users, Plus, Trash2, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
import AdminNav from '@/components/AdminNav';

const statusConfig = {
  available: { label: 'Available', cls: 'bg-success/10 text-success border-success/20' },
  partial: { label: 'Partial', cls: 'bg-warning/10 text-warning border-warning/20' },
  unavailable: { label: 'Off', cls: 'bg-danger/10 text-danger border-danger/20' },
};

export default function ShiftManagement() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [cleaners, setCleaners] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState(null);
  const [form, setForm] = useState({ status: 'available', available_from: '08:00', available_until: '17:00', notes: '' });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => { loadAll(); }, [weekStart]);

  const loadAll = async () => {
    setLoading(true);
    const startStr = format(weekStart, 'yyyy-MM-dd');
    const endStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');
    const [users, allAvail, allJobs] = await Promise.all([
      api.entities.User.list(), api.entities.CleanerAvailability.list('-date', 500), api.entities.Job.list('-scheduled_date', 500),
    ]);
    setCleaners(users);
    setAvailability(allAvail.filter(a => a.date >= startStr && a.date <= endStr));
    setJobs(allJobs.filter(j => j.scheduled_date >= startStr && j.scheduled_date <= endStr));
    setLoading(false);
  };

  const getAvail = (email, day) => {
    const d = format(day, 'yyyy-MM-dd');
    return availability.find(a => a.cleaner_email === email && a.date === d);
  };

  const getJobCount = (email, day) => {
    const d = format(day, 'yyyy-MM-dd');
    return jobs.filter(j => j.cleaner_email === email && j.scheduled_date === d).length;
  };

  const handleSave = async () => {
    const { cleaner, date } = addingFor;
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = getAvail(cleaner.email, date);
    const payload = { cleaner_email: cleaner.email, cleaner_name: cleaner.full_name, date: dateStr, ...form };
    let saved;
    if (existing) {
      saved = await api.entities.CleanerAvailability.update(existing.id, payload);
      setAvailability(prev => prev.map(a => a.id === existing.id ? saved : a));
    } else {
      saved = await api.entities.CleanerAvailability.create(payload);
      setAvailability(prev => [...prev, saved]);
    }
    setAddingFor(null);
  };

  const handleDelete = async (avail) => {
    await api.entities.CleanerAvailability.delete(avail.id);
    setAvailability(prev => prev.filter(a => a.id !== avail.id));
  };

  const openForm = (cleaner, day) => {
    const existing = getAvail(cleaner.email, day);
    setForm(existing ? { status: existing.status, available_from: existing.available_from || '08:00', available_until: existing.available_until || '17:00', notes: existing.notes || '' }
      : { status: 'available', available_from: '08:00', available_until: '17:00', notes: '' });
    setAddingFor({ cleaner, date: day });
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <AdminNav />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-accent" />
            <h1 className="text-xl font-bold text-white">Shift Management</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost p-2 border border-dark-700" onClick={() => setWeekStart(subWeeks(weekStart, 1))}><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-medium text-dark-300 min-w-[160px] text-center">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
            <button className="btn-ghost p-2 border border-dark-700" onClick={() => setWeekStart(addWeeks(weekStart, 1))}><ChevronRight className="w-4 h-4" /></button>
            <button className="btn-ghost text-sm border border-dark-700" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>This Week</button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left text-sm font-medium text-dark-400 px-3 py-2 w-36">Cleaner</th>
                  {days.map(day => (
                    <th key={day.toISOString()} className={`text-center text-xs font-medium px-2 py-2 rounded-lg ${isSameDay(day, new Date()) ? 'bg-accent/10 text-accent-light' : 'text-dark-500'}`}>
                      <div>{format(day, 'EEE')}</div>
                      <div className="font-bold text-sm">{format(day, 'd')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cleaners.map(cleaner => (
                  <tr key={cleaner.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-sm text-white truncate max-w-[130px]">{cleaner.full_name}</div>
                      <div className="text-xs text-dark-500 truncate max-w-[130px]">{cleaner.email}</div>
                    </td>
                    {days.map(day => {
                      const avail = getAvail(cleaner.email, day);
                      const jobCount = getJobCount(cleaner.email, day);
                      return (
                        <td key={day.toISOString()} className="p-1">
                          <button onClick={() => openForm(cleaner, day)}
                            className={`w-full h-20 rounded-xl border text-xs flex flex-col items-center justify-center gap-1 transition-all hover:brightness-110 ${
                              avail ? statusConfig[avail.status].cls : 'bg-dark-800 border-dark-700 text-dark-500 hover:border-dark-600'
                            }`}>
                            {avail ? (
                              <>
                                <span className="font-semibold">{statusConfig[avail.status].label}</span>
                                {avail.status !== 'unavailable' && avail.available_from && <span className="opacity-70">{avail.available_from}–{avail.available_until}</span>}
                                {jobCount > 0 && <span className="badge bg-dark-700 text-dark-300 border-dark-600 text-[10px]">{jobCount} job{jobCount > 1 ? 's' : ''}</span>}
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                <span>Set shift</span>
                                {jobCount > 0 && <span className="badge bg-accent/10 text-accent-light border-accent/20 text-[10px]">{jobCount} job{jobCount > 1 ? 's' : ''}</span>}
                              </>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {addingFor && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setAddingFor(null)}>
          <div className="card p-5 w-80 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-white mb-1">{addingFor.cleaner.full_name}</h3>
            <p className="text-sm text-dark-400 mb-4">{format(addingFor.date, 'EEE MMM d')}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-dark-400 block mb-1">Status</label>
                <select className="input-dark w-full" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="available">Available</option>
                  <option value="partial">Partial</option>
                  <option value="unavailable">Unavailable (Off)</option>
                </select>
              </div>
              {form.status !== 'unavailable' && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-dark-400 block mb-1">From</label>
                    <input type="time" className="input-dark w-full" value={form.available_from} onChange={e => setForm(f => ({ ...f, available_from: e.target.value }))} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-dark-400 block mb-1">Until</label>
                    <input type="time" className="input-dark w-full" value={form.available_until} onChange={e => setForm(f => ({ ...f, available_until: e.target.value }))} />
                  </div>
                </div>
              )}
              <input className="input-dark w-full" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
              <div className="flex gap-2 pt-1">
                {getAvail(addingFor.cleaner.email, addingFor.date) && (
                  <button className="btn-danger text-sm flex items-center gap-1" onClick={() => { handleDelete(getAvail(addingFor.cleaner.email, addingFor.date)); setAddingFor(null); }}>
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                )}
                <button className="btn-ghost flex-1 border border-dark-700 text-sm" onClick={() => setAddingFor(null)}>Cancel</button>
                <button className="btn-primary flex-1 text-sm" onClick={handleSave}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
