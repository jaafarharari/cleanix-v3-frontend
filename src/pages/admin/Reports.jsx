import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { BarChart3, Download, Loader2, ChevronLeft, ChevronRight, Clock, ArrowRight } from 'lucide-react';
import { format, startOfWeek, addDays, subWeeks, addWeeks } from 'date-fns';
import AdminNav from '@/components/AdminNav';

export default function Reports() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [cleaners, setCleaners] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('hours'); // 'hours' | 'gaps'

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const startStr = format(weekStart, 'yyyy-MM-dd');
  const endStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');

  useEffect(() => { loadData(); }, [weekStart]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [users, jobs] = await Promise.all([
        api.entities.User.list(),
        api.entities.Job.list('-scheduled_date', 500),
      ]);
      setCleaners(users.filter(u => u.role === 'user'));
      setAllJobs(jobs.filter(j => j.scheduled_date >= startStr && j.scheduled_date <= endStr));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // ── Hours tab helpers ────────────────────────────────────
  const getCompletedJobs = (email) => allJobs.filter(j => j.cleaner_email === email && j.status === 'complete' && j.clock_in_time && j.clock_out_time);

  const getJobDuration = (job) => {
    if (!job.clock_in_time || !job.clock_out_time) return 0;
    return (new Date(job.clock_out_time) - new Date(job.clock_in_time)) / 1000 / 60;
  };

  const getDayHours = (email, day) => {
    const d = format(day, 'yyyy-MM-dd');
    return allJobs.filter(j => j.cleaner_email === email && j.scheduled_date === d && j.status === 'complete' && j.clock_in_time && j.clock_out_time)
      .reduce((acc, j) => acc + getJobDuration(j), 0);
  };

  const getTotalHours = (email) => getCompletedJobs(email).reduce((acc, j) => acc + getJobDuration(j), 0);

  // ── Gap time helpers ─────────────────────────────────────
  const getGapsForDay = (email, day) => {
    const d = format(day, 'yyyy-MM-dd');
    const dayJobs = allJobs
      .filter(j => j.cleaner_email === email && j.scheduled_date === d && j.clock_in_time && j.clock_out_time && j.status === 'complete')
      .sort((a, b) => new Date(a.clock_in_time) - new Date(b.clock_in_time));

    const gaps = [];
    for (let i = 0; i < dayJobs.length - 1; i++) {
      const clockOut = new Date(dayJobs[i].clock_out_time);
      const nextClockIn = new Date(dayJobs[i + 1].clock_in_time);
      const gapMins = (nextClockIn - clockOut) / 1000 / 60;
      if (gapMins >= 0) {
        gaps.push({
          from_property: dayJobs[i].property_name,
          to_property: dayJobs[i + 1].property_name,
          clock_out: dayJobs[i].clock_out_time,
          clock_in: dayJobs[i + 1].clock_in_time,
          gap_minutes: Math.round(gapMins),
        });
      }
    }
    return gaps;
  };

  const getAllGapsForCleaner = (email) => {
    const allGaps = [];
    for (const day of days) {
      const dayGaps = getGapsForDay(email, day);
      allGaps.push(...dayGaps.map(g => ({ ...g, date: format(day, 'yyyy-MM-dd') })));
    }
    return allGaps;
  };

  const getDayTotalGap = (email, day) => {
    return getGapsForDay(email, day).reduce((acc, g) => acc + g.gap_minutes, 0);
  };

  const getTotalGap = (email) => {
    return days.reduce((acc, day) => acc + getDayTotalGap(email, day), 0);
  };

  // ── Format helpers ───────────────────────────────────────
  const formatMins = (mins) => {
    if (mins === 0) return '—';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const formatHoursDecimal = (mins) => (mins / 60).toFixed(2);

  const formatTime = (ts) => {
    if (!ts) return '';
    return format(new Date(ts), 'HH:mm');
  };

  // ── CSV Export ───────────────────────────────────────────
  const downloadHoursCSV = () => {
    const header = ['Cleaner', 'Email', ...days.map(d => format(d, 'EEE MMM d')), 'Total Hours', 'Total Jobs'];
    const rows = cleaners.map(c => {
      const dailyMins = days.map(d => formatHoursDecimal(getDayHours(c.email, d)));
      return [c.full_name || 'Unnamed', c.email, ...dailyMins, formatHoursDecimal(getTotalHours(c.email)), getCompletedJobs(c.email).length];
    });
    const csv = [header, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    downloadCSVFile(csv, `cleaner-hours-${startStr}-to-${endStr}.csv`);
  };

  const downloadGapsCSV = () => {
    const header = ['Cleaner', 'Email', 'Date', 'From Property', 'Clock Out', 'To Property', 'Clock In', 'Gap (minutes)'];
    const rows = [];
    for (const c of cleaners) {
      const gaps = getAllGapsForCleaner(c.email);
      for (const g of gaps) {
        rows.push([c.full_name || 'Unnamed', c.email, g.date, g.from_property, formatTime(g.clock_out), g.to_property, formatTime(g.clock_in), g.gap_minutes]);
      }
    }
    if (rows.length === 0) rows.push(['No gap data for this week', '', '', '', '', '', '', '']);
    const csv = [header, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    downloadCSVFile(csv, `cleaner-gaps-${startStr}-to-${endStr}.csv`);
  };

  const downloadCSVFile = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
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
            <span className="text-sm font-medium text-dark-300 min-w-[180px] text-center">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
            <button className="btn-ghost p-2 border border-dark-700" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button className="btn-ghost text-sm border border-dark-700" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              This Week
            </button>
            <button className="btn-primary text-sm flex items-center gap-1.5" onClick={activeTab === 'hours' ? downloadHoursCSV : downloadGapsCSV}>
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('hours')}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              activeTab === 'hours' ? 'bg-accent/15 text-accent-light border-accent/30' : 'bg-dark-800 text-dark-400 border-dark-700 hover:border-dark-600'
            }`}>
            <Clock className="w-3.5 h-3.5 inline mr-1.5" />Hours worked
          </button>
          <button onClick={() => setActiveTab('gaps')}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              activeTab === 'gaps' ? 'bg-accent/15 text-accent-light border-accent/30' : 'bg-dark-800 text-dark-400 border-dark-700 hover:border-dark-600'
            }`}>
            <ArrowRight className="w-3.5 h-3.5 inline mr-1.5" />Time between jobs
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
        ) : cleaners.length === 0 ? (
          <div className="text-center py-20 text-dark-500">No cleaners in your team yet.</div>
        ) : activeTab === 'hours' ? (
          /* ── Hours Tab ── */
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="text-left text-sm font-medium text-dark-400 px-3 py-2 w-44">Cleaner</th>
                    {days.map(day => (
                      <th key={day.toISOString()} className={`text-center text-xs font-medium px-2 py-2 rounded-lg ${
                        format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'bg-accent/10 text-accent-light' : 'text-dark-500'
                      }`}>
                        <div>{format(day, 'EEE')}</div>
                        <div className="font-bold text-sm">{format(day, 'd')}</div>
                      </th>
                    ))}
                    <th className="text-center text-sm font-medium text-dark-300 px-3 py-2">Total</th>
                    <th className="text-center text-sm font-medium text-dark-300 px-3 py-2">Jobs</th>
                  </tr>
                </thead>
                <tbody>
                  {cleaners.map(cleaner => {
                    const totalMins = getTotalHours(cleaner.email);
                    const totalJobs = getCompletedJobs(cleaner.email).length;
                    return (
                      <tr key={cleaner.id}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">
                              {cleaner.full_name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <div className="font-medium text-sm text-white truncate max-w-[140px]">{cleaner.full_name || 'Unnamed'}</div>
                              <div className="text-xs text-dark-500 truncate max-w-[140px]">{cleaner.email}</div>
                            </div>
                          </div>
                        </td>
                        {days.map(day => {
                          const dayMins = getDayHours(cleaner.email, day);
                          return (
                            <td key={day.toISOString()} className="p-1">
                              <div className={`rounded-xl text-center py-3 text-sm font-medium ${
                                dayMins > 0 ? 'bg-accent/10 text-accent-light border border-accent/20' : 'bg-dark-800 text-dark-600 border border-dark-700/50'
                              }`}>{formatMins(dayMins)}</div>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2"><div className={`text-center font-bold text-sm ${totalMins > 0 ? 'text-white' : 'text-dark-600'}`}>{formatMins(totalMins)}</div></td>
                        <td className="px-3 py-2"><div className={`text-center font-medium text-sm ${totalJobs > 0 ? 'text-dark-200' : 'text-dark-600'}`}>{totalJobs || '—'}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="px-3 py-3 font-semibold text-sm text-dark-300">Totals</td>
                    {days.map(day => {
                      const dayTotal = cleaners.reduce((acc, c) => acc + getDayHours(c.email, day), 0);
                      return (
                        <td key={day.toISOString()} className="p-1">
                          <div className="rounded-xl text-center py-2 text-xs font-semibold text-dark-400 bg-dark-800 border border-dark-700/50">{formatMins(dayTotal)}</div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center font-bold text-sm text-accent-light">
                      {formatMins(cleaners.reduce((acc, c) => acc + getTotalHours(c.email), 0))}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-sm text-dark-200">
                      {cleaners.reduce((acc, c) => acc + getCompletedJobs(c.email).length, 0) || '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-dark-500">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-accent/10 border border-accent/20" /><span>Hours worked</span></div>
              <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" /><span>Clock-in to clock-out</span></div>
            </div>
          </>
        ) : (
          /* ── Gaps Tab ── */
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="text-left text-sm font-medium text-dark-400 px-3 py-2 w-44">Cleaner</th>
                    {days.map(day => (
                      <th key={day.toISOString()} className={`text-center text-xs font-medium px-2 py-2 rounded-lg ${
                        format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'bg-accent/10 text-accent-light' : 'text-dark-500'
                      }`}>
                        <div>{format(day, 'EEE')}</div>
                        <div className="font-bold text-sm">{format(day, 'd')}</div>
                      </th>
                    ))}
                    <th className="text-center text-sm font-medium text-dark-300 px-3 py-2">Avg gap</th>
                  </tr>
                </thead>
                <tbody>
                  {cleaners.map(cleaner => {
                    const allGaps = getAllGapsForCleaner(cleaner.email);
                    const avgGap = allGaps.length > 0 ? Math.round(allGaps.reduce((a, g) => a + g.gap_minutes, 0) / allGaps.length) : 0;
                    return (
                      <tr key={cleaner.id}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">
                              {cleaner.full_name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <div className="font-medium text-sm text-white truncate max-w-[140px]">{cleaner.full_name || 'Unnamed'}</div>
                              <div className="text-xs text-dark-500 truncate max-w-[140px]">{cleaner.email}</div>
                            </div>
                          </div>
                        </td>
                        {days.map(day => {
                          const dayGaps = getGapsForDay(cleaner.email, day);
                          const totalGap = dayGaps.reduce((a, g) => a + g.gap_minutes, 0);
                          return (
                            <td key={day.toISOString()} className="p-1">
                              <div className={`rounded-xl text-center py-2 text-sm font-medium relative group ${
                                dayGaps.length > 0
                                  ? totalGap > 60 ? 'bg-warning/10 text-warning border border-warning/20'
                                  : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                                  : 'bg-dark-800 text-dark-600 border border-dark-700/50'
                              }`}>
                                {dayGaps.length > 0 ? (
                                  <div>
                                    <div>{formatMins(totalGap)}</div>
                                    <div className="text-[10px] opacity-60">{dayGaps.length} gap{dayGaps.length > 1 ? 's' : ''}</div>
                                  </div>
                                ) : '—'}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2">
                          <div className={`text-center font-bold text-sm ${avgGap > 0 ? 'text-white' : 'text-dark-600'}`}>
                            {avgGap > 0 ? formatMins(avgGap) : '—'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Detailed gap breakdown */}
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-semibold text-dark-300">Gap details this week</h3>
              {cleaners.map(cleaner => {
                const gaps = getAllGapsForCleaner(cleaner.email);
                if (gaps.length === 0) return null;
                return (
                  <div key={cleaner.id} className="card p-4">
                    <p className="font-medium text-white mb-3 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-accent font-bold text-xs">
                        {cleaner.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      {cleaner.full_name}
                    </p>
                    <div className="space-y-2">
                      {gaps.map((gap, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm bg-dark-700/30 rounded-lg px-3 py-2">
                          <span className="text-xs text-dark-500 w-16">{format(new Date(gap.date), 'EEE d')}</span>
                          <span className="text-dark-300 truncate max-w-[140px]">{gap.from_property}</span>
                          <span className="text-dark-500 text-xs">{formatTime(gap.clock_out)}</span>
                          <ArrowRight className="w-3 h-3 text-dark-600 flex-shrink-0" />
                          <span className="text-dark-300 truncate max-w-[140px]">{gap.to_property}</span>
                          <span className="text-dark-500 text-xs">{formatTime(gap.clock_in)}</span>
                          <span className={`ml-auto font-medium flex-shrink-0 ${gap.gap_minutes > 60 ? 'text-warning' : 'text-teal-400'}`}>
                            {formatMins(gap.gap_minutes)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {cleaners.every(c => getAllGapsForCleaner(c.email).length === 0) && (
                <div className="text-center py-8 text-dark-500 text-sm">No gaps recorded this week — cleaners had single jobs per day or no completed jobs.</div>
              )}
            </div>

            <div className="flex items-center gap-4 mt-4 text-xs text-dark-500">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-teal-500/10 border border-teal-500/20" /><span>Under 1 hour</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-warning/10 border border-warning/20" /><span>Over 1 hour</span></div>
              <div className="flex items-center gap-1.5"><ArrowRight className="w-3 h-3" /><span>Clock-out to next clock-in</span></div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
