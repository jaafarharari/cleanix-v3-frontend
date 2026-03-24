import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { BarChart3, Download, ChevronLeft, ChevronRight, Loader2, Clock } from 'lucide-react';
import { format, startOfWeek, addDays, subWeeks, addWeeks } from 'date-fns';
import AdminNav from '@/components/AdminNav';

export default function AdminReports() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [cleaners, setCleaners] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const startStr = format(weekStart, 'yyyy-MM-dd');
  const endStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

  useEffect(() => { loadData(); }, [weekStart]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [users, allJobs] = await Promise.all([
        api.entities.User.list(),
        api.entities.Job.list('-scheduled_date', 500),
      ]);
      setCleaners(users.filter(u => u.role === 'user'));
      // Filter jobs to the selected week that have clock in/out times
      setJobs(allJobs.filter(j =>
        j.scheduled_date >= startStr &&
        j.scheduled_date <= endStr &&
        j.clock_in_time && j.clock_out_time
      ));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // Calculate hours for a cleaner on a specific day
  const getHoursForDay = (email, day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayJobs = jobs.filter(j => j.cleaner_email === email && j.scheduled_date === dateStr);
    let totalMinutes = 0;
    for (const job of dayJobs) {
      const diff = (new Date(job.clock_out_time) - new Date(job.clock_in_time)) / 60000;
      if (diff > 0) totalMinutes += diff;
    }
    return totalMinutes;
  };

  // Get total hours for a cleaner in the week
  const getWeekTotal = (email) => {
    return days.reduce((total, day) => total + getHoursForDay(email, day), 0);
  };

  // Get job count for a cleaner in the week
  const getJobCount = (email) => {
    return jobs.filter(j => j.cleaner_email === email).length;
  };

  // Format minutes to "Xh Ym"
  const formatMins = (mins) => {
    if (mins === 0) return '—';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // Format minutes to decimal hours for CSV
  const toDecimalHours = (mins) => (mins / 60).toFixed(2);

  // Export to CSV
  const exportCSV = () => {
    const header = ['Cleaner', 'Email', ...days.map(d => format(d, 'EEE dd/MM')), 'Total Hours', 'Jobs'];
    const rows = cleaners.map(c => {
      const dayHours = days.map(d => toDecimalHours(getHoursForDay(c.email, d)));
      return [
        c.full_name || 'Unnamed',
        c.email,
        ...dayHours,
        toDecimalHours(getWeekTotal(c.email)),
        getJobCount(c.email),
      ];
    });

    const csvContent = [header, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cleaner-hours-${startStr}-to-${endStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <AdminNav />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-accent" />
            <h1 className="text-xl font-bold text-white">Reports</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost p-2 border border-dark-700" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-dark-300 min-w-[160px] text-center">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
            <button className="btn-ghost p-2 border border-dark-700" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button className="btn-ghost text-sm border border-dark-700" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              This Week
            </button>
            <button className="btn-primary text-sm flex items-center gap-1.5" onClick={exportCSV} disabled={cleaners.length === 0}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
        ) : cleaners.length === 0 ? (
          <div className="text-center py-20 text-dark-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No cleaners in your team yet.</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="card p-4">
                <p className="text-sm text-dark-400">Total Cleaners</p>
                <p className="text-2xl font-bold text-white mt-1">{cleaners.length}</p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-dark-400">Jobs Completed</p>
                <p className="text-2xl font-bold text-success mt-1">{jobs.length}</p>
              </div>
              <div className="card p-4">
                <p className="text-sm text-dark-400">Total Hours</p>
                <p className="text-2xl font-bold text-accent mt-1">
                  {formatMins(cleaners.reduce((sum, c) => sum + getWeekTotal(c.email), 0))}
                </p>
              </div>
            </div>

            {/* Hours table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-700">
                      <th className="text-left text-sm font-medium text-dark-400 px-4 py-3 w-48">Cleaner</th>
                      {days.map(day => (
                        <th key={day.toISOString()}
                          className={`text-center text-xs font-medium px-3 py-3 ${
                            format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                              ? 'text-accent-light bg-accent/5'
                              : 'text-dark-500'
                          }`}>
                          <div>{format(day, 'EEE')}</div>
                          <div className="font-bold text-sm">{format(day, 'd')}</div>
                        </th>
                      ))}
                      <th className="text-center text-sm font-medium text-dark-300 px-4 py-3">Total</th>
                      <th className="text-center text-sm font-medium text-dark-300 px-4 py-3">Jobs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cleaners.map(cleaner => {
                      const weekTotal = getWeekTotal(cleaner.email);
                      const jobCount = getJobCount(cleaner.email);
                      return (
                        <tr key={cleaner.id} className="border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">
                                {cleaner.full_name?.[0]?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white">{cleaner.full_name || 'Unnamed'}</p>
                                <p className="text-xs text-dark-500">{cleaner.email}</p>
                              </div>
                            </div>
                          </td>
                          {days.map(day => {
                            const mins = getHoursForDay(cleaner.email, day);
                            return (
                              <td key={day.toISOString()} className="text-center px-3 py-3">
                                <span className={`text-sm ${mins > 0 ? 'text-dark-200 font-medium' : 'text-dark-600'}`}>
                                  {formatMins(mins)}
                                </span>
                              </td>
                            );
                          })}
                          <td className="text-center px-4 py-3">
                            <span className={`text-sm font-bold ${weekTotal > 0 ? 'text-accent-light' : 'text-dark-600'}`}>
                              {formatMins(weekTotal)}
                            </span>
                          </td>
                          <td className="text-center px-4 py-3">
                            <span className={`badge ${jobCount > 0 ? 'bg-success/15 text-success border-success/20' : 'bg-dark-700 text-dark-500 border-dark-600'}`}>
                              {jobCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Footer totals */}
                  <tfoot>
                    <tr className="border-t border-dark-600">
                      <td className="px-4 py-3 text-sm font-semibold text-dark-300">Totals</td>
                      {days.map(day => {
                        const dayTotal = cleaners.reduce((sum, c) => sum + getHoursForDay(c.email, day), 0);
                        return (
                          <td key={day.toISOString()} className="text-center px-3 py-3">
                            <span className={`text-sm font-medium ${dayTotal > 0 ? 'text-dark-200' : 'text-dark-600'}`}>
                              {formatMins(dayTotal)}
                            </span>
                          </td>
                        );
                      })}
                      <td className="text-center px-4 py-3">
                        <span className="text-sm font-bold text-accent">
                          {formatMins(cleaners.reduce((sum, c) => sum + getWeekTotal(c.email), 0))}
                        </span>
                      </td>
                      <td className="text-center px-4 py-3">
                        <span className="text-sm font-bold text-dark-200">{jobs.length}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
