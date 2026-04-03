import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { BarChart3, Download, Loader2, ChevronLeft, ChevronRight, Clock, ArrowRight, Calculator } from 'lucide-react';
import { format, startOfWeek, addDays, subWeeks, addWeeks } from 'date-fns';
import AdminNav from '@/components/AdminNav';

export default function Reports() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [cleaners, setCleaners] = useState([]);
  const [allJobs, setAllJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('hours');

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

  // ── Helpers ──────────────────────────────────────────────
  const getCompletedJobs = (email) => allJobs.filter(j => j.cleaner_email === email && j.status === 'complete' && j.clock_in_time && j.clock_out_time);

  const getJobDuration = (job) => {
    if (!job.clock_in_time || !job.clock_out_time) return 0;
    return (new Date(job.clock_out_time) - new Date(job.clock_in_time)) / 1000 / 60;
  };

  const getDayCleanMins = (email, day) => {
    const d = format(day, 'yyyy-MM-dd');
    return allJobs.filter(j => j.cleaner_email === email && j.scheduled_date === d && j.status === 'complete' && j.clock_in_time && j.clock_out_time)
      .reduce((acc, j) => acc + getJobDuration(j), 0);
  };

  const getTotalCleanMins = (email) => getCompletedJobs(email).reduce((acc, j) => acc + getJobDuration(j), 0);

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
        gaps.push({ from_property: dayJobs[i].property_name, to_property: dayJobs[i + 1].property_name, clock_out: dayJobs[i].clock_out_time, clock_in: dayJobs[i + 1].clock_in_time, gap_minutes: Math.round(gapMins) });
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

  const getDayGapMins = (email, day) => getGapsForDay(email, day).reduce((acc, g) => acc + g.gap_minutes, 0);
  const getTotalGapMins = (email) => days.reduce((acc, day) => acc + getDayGapMins(email, day), 0);

  // Total = clean + travel
  const getDayTotalMins = (email, day) => getDayCleanMins(email, day) + getDayGapMins(email, day);
  const getWeekTotalMins = (email) => getTotalCleanMins(email) + getTotalGapMins(email);

  const formatMins = (mins) => {
    if (mins === 0) return '—';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const formatHoursDecimal = (mins) => (mins / 60).toFixed(2);
  const formatTime = (ts) => ts ? format(new Date(ts), 'HH:mm') : '';

  // ── CSV Exports ──────────────────────────────────────────
  const downloadCSVFile = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadHoursCSV = () => {
    const header = ['Cleaner', 'Email', ...days.map(d => format(d, 'EEE MMM d')), 'Total Hours', 'Total Jobs'];
    const rows = cleaners.map(c => [c.full_name || 'Unnamed', c.email, ...days.map(d => formatHoursDecimal(getDayCleanMins(c.email, d))), formatHoursDecimal(getTotalCleanMins(c.email)), getCompletedJobs(c.email).length]);
    downloadCSVFile([header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n'), `cleaner-hours-${startStr}-to-${endStr}.csv`);
  };

  const downloadGapsCSV = () => {
    const header = ['Cleaner', 'Email', 'Date', 'From Property', 'Clock Out', 'To Property', 'Clock In', 'Gap (minutes)'];
    const rows = [];
    for (const c of cleaners) { for (const g of getAllGapsForCleaner(c.email)) { rows.push([c.full_name || 'Unnamed', c.email, g.date, g.from_property, formatTime(g.clock_out), g.to_property, formatTime(g.clock_in), g.gap_minutes]); } }
    if (rows.length === 0) rows.push(['No gap data', '', '', '', '', '', '', '']);
    downloadCSVFile([header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n'), `cleaner-gaps-${startStr}-to-${endStr}.csv`);
  };

  const downloadTotalCSV = () => {
    const header = ['Cleaner', 'Email', ...days.map(d => `${format(d, 'EEE MMM d')} Clean`), ...days.map(d => `${format(d, 'EEE MMM d')} Travel`), ...days.map(d => `${format(d, 'EEE MMM d')} Total`), 'Week Clean Hours', 'Week Travel Hours', 'Week Total Hours', 'Jobs'];
    const rows = cleaners.map(c => [
      c.full_name || 'Unnamed', c.email,
      ...days.map(d => formatHoursDecimal(getDayCleanMins(c.email, d))),
      ...days.map(d => formatHoursDecimal(getDayGapMins(c.email, d))),
      ...days.map(d => formatHoursDecimal(getDayTotalMins(c.email, d))),
      formatHoursDecimal(getTotalCleanMins(c.email)),
      formatHoursDecimal(getTotalGapMins(c.email)),
      formatHoursDecimal(getWeekTotalMins(c.email)),
      getCompletedJobs(c.email).length,
    ]);
    downloadCSVFile([header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n'), `cleaner-total-hours-${startStr}-to-${endStr}.csv`);
  };

  const handleExport = () => {
    if (activeTab === 'hours') downloadHoursCSV();
    else if (activeTab === 'gaps') downloadGapsCSV();
    else downloadTotalCSV();
  };

  // ── Render helpers ───────────────────────────────────────
  const renderWeekNav = () => (
    <div className="flex items-center gap-2">
      <button className="btn-ghost p-2 border border-dark-700" onClick={() => setWeekStart(subWeeks(weekStart, 1))}><ChevronLeft className="w-4 h-4" /></button>
      <span className="text-sm font-medium text-dark-300 min-w-[180px] text-center">{format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}</span>
      <button className="btn-ghost p-2 border border-dark-700" onClick={() => setWeekStart(addWeeks(weekStart, 1))}><ChevronRight className="w-4 h-4" /></button>
      <button className="btn-ghost text-sm border border-dark-700" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>This Week</button>
      <button className="btn-primary text-sm flex items-center gap-1.5" onClick={handleExport}><Download className="w-4 h-4" /> Export CSV</button>
    </div>
  );

  const renderCleanerCell = (cleaner) => (
    <td className="px-3 py-2">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">{cleaner.full_name?.[0]?.toUpperCase() || '?'}</div>
        <div>
          <div className="font-medium text-sm text-white truncate max-w-[140px]">{cleaner.full_name || 'Unnamed'}</div>
          <div className="text-xs text-dark-500 truncate max-w-[140px]">{cleaner.email}</div>
        </div>
      </div>
    </td>
  );

  const renderDayHeaders = () => days.map(day => (
    <th key={day.toISOString()} className={`text-center text-xs font-medium px-2 py-2 rounded-lg ${format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'bg-accent/10 text-accent-light' : 'text-dark-500'}`}>
      <div>{format(day, 'EEE')}</div>
      <div className="font-bold text-sm">{format(day, 'd')}</div>
    </th>
  ));

  return (
    <div className="min-h-screen bg-dark-900">
      <AdminNav />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-accent" />
            <h1 className="text-xl font-bold text-white">Reports</h1>
          </div>
          {renderWeekNav()}
        </div>

        <div className="flex gap-2 mb-6">
          {[
            { id: 'hours', label: 'Hours worked', icon: Clock },
            { id: 'gaps', label: 'Time between jobs', icon: ArrowRight },
            { id: 'total', label: 'Total hours', icon: Calculator },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                activeTab === tab.id ? 'bg-accent/15 text-accent-light border-accent/30' : 'bg-dark-800 text-dark-400 border-dark-700 hover:border-dark-600'
              }`}>
              <tab.icon className="w-3.5 h-3.5 inline mr-1.5" />{tab.label}
            </button>
          ))}
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
                <thead><tr><th className="text-left text-sm font-medium text-dark-400 px-3 py-2 w-44">Cleaner</th>{renderDayHeaders()}<th className="text-center text-sm font-medium text-dark-300 px-3 py-2">Total</th><th className="text-center text-sm font-medium text-dark-300 px-3 py-2">Jobs</th></tr></thead>
                <tbody>
                  {cleaners.map(c => (
                    <tr key={c.id}>
                      {renderCleanerCell(c)}
                      {days.map(day => { const m = getDayCleanMins(c.email, day); return <td key={day.toISOString()} className="p-1"><div className={`rounded-xl text-center py-3 text-sm font-medium ${m > 0 ? 'bg-accent/10 text-accent-light border border-accent/20' : 'bg-dark-800 text-dark-600 border border-dark-700/50'}`}>{formatMins(m)}</div></td>; })}
                      <td className="px-3 py-2"><div className={`text-center font-bold text-sm ${getTotalCleanMins(c.email) > 0 ? 'text-white' : 'text-dark-600'}`}>{formatMins(getTotalCleanMins(c.email))}</div></td>
                      <td className="px-3 py-2"><div className={`text-center font-medium text-sm ${getCompletedJobs(c.email).length > 0 ? 'text-dark-200' : 'text-dark-600'}`}>{getCompletedJobs(c.email).length || '—'}</div></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr>
                  <td className="px-3 py-3 font-semibold text-sm text-dark-300">Totals</td>
                  {days.map(day => <td key={day.toISOString()} className="p-1"><div className="rounded-xl text-center py-2 text-xs font-semibold text-dark-400 bg-dark-800 border border-dark-700/50">{formatMins(cleaners.reduce((a, c) => a + getDayCleanMins(c.email, day), 0))}</div></td>)}
                  <td className="px-3 py-3 text-center font-bold text-sm text-accent-light">{formatMins(cleaners.reduce((a, c) => a + getTotalCleanMins(c.email), 0))}</td>
                  <td className="px-3 py-3 text-center font-bold text-sm text-dark-200">{cleaners.reduce((a, c) => a + getCompletedJobs(c.email).length, 0) || '—'}</td>
                </tr></tfoot>
              </table>
            </div>
          </>
        ) : activeTab === 'gaps' ? (
          /* ── Gaps Tab ── */
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1">
                <thead><tr><th className="text-left text-sm font-medium text-dark-400 px-3 py-2 w-44">Cleaner</th>{renderDayHeaders()}<th className="text-center text-sm font-medium text-dark-300 px-3 py-2">Avg gap</th></tr></thead>
                <tbody>
                  {cleaners.map(c => {
                    const allGaps = getAllGapsForCleaner(c.email);
                    const avgGap = allGaps.length > 0 ? Math.round(allGaps.reduce((a, g) => a + g.gap_minutes, 0) / allGaps.length) : 0;
                    return (
                      <tr key={c.id}>
                        {renderCleanerCell(c)}
                        {days.map(day => { const dayGaps = getGapsForDay(c.email, day); const total = dayGaps.reduce((a, g) => a + g.gap_minutes, 0); return <td key={day.toISOString()} className="p-1"><div className={`rounded-xl text-center py-2 text-sm font-medium ${dayGaps.length > 0 ? total > 60 ? 'bg-warning/10 text-warning border border-warning/20' : 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-dark-800 text-dark-600 border border-dark-700/50'}`}>{dayGaps.length > 0 ? <><div>{formatMins(total)}</div><div className="text-[10px] opacity-60">{dayGaps.length} gap{dayGaps.length > 1 ? 's' : ''}</div></> : '—'}</div></td>; })}
                        <td className="px-3 py-2"><div className={`text-center font-bold text-sm ${avgGap > 0 ? 'text-white' : 'text-dark-600'}`}>{avgGap > 0 ? formatMins(avgGap) : '—'}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-semibold text-dark-300">Gap details this week</h3>
              {cleaners.map(c => { const gaps = getAllGapsForCleaner(c.email); if (gaps.length === 0) return null; return (
                <div key={c.id} className="card p-4">
                  <p className="font-medium text-white mb-3 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-accent font-bold text-xs">{c.full_name?.[0]?.toUpperCase() || '?'}</div>{c.full_name}
                  </p>
                  <div className="space-y-2">
                    {gaps.map((g, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm bg-dark-700/30 rounded-lg px-3 py-2">
                        <span className="text-xs text-dark-500 w-16">{format(new Date(g.date), 'EEE d')}</span>
                        <span className="text-dark-300 truncate max-w-[140px]">{g.from_property}</span>
                        <span className="text-dark-500 text-xs">{formatTime(g.clock_out)}</span>
                        <ArrowRight className="w-3 h-3 text-dark-600 flex-shrink-0" />
                        <span className="text-dark-300 truncate max-w-[140px]">{g.to_property}</span>
                        <span className="text-dark-500 text-xs">{formatTime(g.clock_in)}</span>
                        <span className={`ml-auto font-medium flex-shrink-0 ${g.gap_minutes > 60 ? 'text-warning' : 'text-teal-400'}`}>{formatMins(g.gap_minutes)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ); })}
              {cleaners.every(c => getAllGapsForCleaner(c.email).length === 0) && <div className="text-center py-8 text-dark-500 text-sm">No gaps recorded this week.</div>}
            </div>
          </>
        ) : (
          /* ── Total Hours Tab (clean + travel) ── */
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="text-left text-sm font-medium text-dark-400 px-3 py-2 w-44">Cleaner</th>
                    {renderDayHeaders()}
                    <th className="text-center text-sm font-medium text-dark-300 px-3 py-2">Clean</th>
                    <th className="text-center text-sm font-medium text-dark-300 px-3 py-2">Travel</th>
                    <th className="text-center text-sm font-medium text-dark-300 px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cleaners.map(c => {
                    const weekClean = getTotalCleanMins(c.email);
                    const weekTravel = getTotalGapMins(c.email);
                    const weekTotal = weekClean + weekTravel;
                    return (
                      <tr key={c.id}>
                        {renderCleanerCell(c)}
                        {days.map(day => {
                          const clean = getDayCleanMins(c.email, day);
                          const travel = getDayGapMins(c.email, day);
                          const total = clean + travel;
                          return (
                            <td key={day.toISOString()} className="p-1">
                              <div className={`rounded-xl text-center py-2 text-sm ${total > 0 ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-dark-800 border border-dark-700/50'}`}>
                                {total > 0 ? (
                                  <>
                                    <div className="font-medium text-purple-300">{formatMins(total)}</div>
                                    <div className="text-[10px] text-dark-500">{formatMins(clean)} + {formatMins(travel)}</div>
                                  </>
                                ) : <span className="text-dark-600">—</span>}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2"><div className={`text-center font-medium text-sm ${weekClean > 0 ? 'text-accent-light' : 'text-dark-600'}`}>{formatMins(weekClean)}</div></td>
                        <td className="px-3 py-2"><div className={`text-center font-medium text-sm ${weekTravel > 0 ? 'text-teal-400' : 'text-dark-600'}`}>{formatMins(weekTravel)}</div></td>
                        <td className="px-3 py-2"><div className={`text-center font-bold text-sm ${weekTotal > 0 ? 'text-purple-300' : 'text-dark-600'}`}>{formatMins(weekTotal)}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="px-3 py-3 font-semibold text-sm text-dark-300">Totals</td>
                    {days.map(day => {
                      const dayTotal = cleaners.reduce((a, c) => a + getDayTotalMins(c.email, day), 0);
                      return <td key={day.toISOString()} className="p-1"><div className="rounded-xl text-center py-2 text-xs font-semibold text-dark-400 bg-dark-800 border border-dark-700/50">{formatMins(dayTotal)}</div></td>;
                    })}
                    <td className="px-3 py-3 text-center font-bold text-sm text-accent-light">{formatMins(cleaners.reduce((a, c) => a + getTotalCleanMins(c.email), 0))}</td>
                    <td className="px-3 py-3 text-center font-bold text-sm text-teal-400">{formatMins(cleaners.reduce((a, c) => a + getTotalGapMins(c.email), 0))}</td>
                    <td className="px-3 py-3 text-center font-bold text-sm text-purple-300">{formatMins(cleaners.reduce((a, c) => a + getWeekTotalMins(c.email), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-dark-500">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-accent/10 border border-accent/20" /><span>Clean time</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-teal-500/10 border border-teal-500/20" /><span>Travel time</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-purple-500/10 border border-purple-500/20" /><span>Total (clean + travel)</span></div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}