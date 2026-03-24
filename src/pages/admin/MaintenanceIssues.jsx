import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { Flag, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import AdminNav from '@/components/AdminNav';

const categoryColors = {
  Appliance: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  Plumbing: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  Electrical: 'bg-warning/15 text-warning border-warning/20',
  Damage: 'bg-danger/15 text-danger border-danger/20',
  Safety: 'bg-red-500/20 text-red-400 border-red-500/30',
  Other: 'bg-dark-600/50 text-dark-300 border-dark-600',
};

export default function MaintenanceIssues() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');

  useEffect(() => {
    api.entities.MaintenanceIssue.list('-created_date', 100).then(data => { setIssues(data); setLoading(false); });
  }, []);

  const handleStatusChange = async (issueId, newStatus) => {
    const updated = await api.entities.MaintenanceIssue.update(issueId, { status: newStatus });
    setIssues(prev => prev.map(i => i.id === issueId ? updated : i));
  };

  const filtered = statusFilter === 'all' ? issues : issues.filter(i => i.status === statusFilter);

  return (
    <div className="min-h-screen bg-dark-900">
      <AdminNav />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Flag className="w-5 h-5 text-warning" />
            <h1 className="text-xl font-bold text-white">Maintenance Issues</h1>
          </div>
          <div className="flex gap-2">
            {['all', 'open', 'acknowledged', 'resolved'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === s ? 'bg-accent/15 text-accent-light' : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
                }`}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-dark-500">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No {statusFilter !== 'all' ? statusFilter : ''} issues</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(issue => (
              <div key={issue.id} className={`card p-5 animate-slide-up ${issue.status === 'open' ? 'border-warning/20' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`badge border ${categoryColors[issue.category] || categoryColors.Other}`}>{issue.category}</span>
                      <p className="text-sm font-medium text-dark-200">{issue.property_name}</p>
                      <span className="text-xs text-dark-500">
                        {issue.created_date ? format(new Date(issue.created_date), 'MMM d, HH:mm') : ''}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-dark-300">{issue.description}</p>
                    {issue.photo_urls?.length > 0 && (
                      <div className="flex gap-2 mt-3">
                        {issue.photo_urls.map((url, i) => (
                          <img key={i} src={url} alt="issue" className="w-16 h-16 rounded-lg object-cover border border-dark-700" />
                        ))}
                      </div>
                    )}
                    {issue.reported_by && <p className="text-xs text-dark-500 mt-2">Reported by {issue.reported_by}</p>}
                  </div>
                  <select className="input-dark text-sm w-36 flex-shrink-0" value={issue.status}
                    onChange={e => handleStatusChange(issue.id, e.target.value)}>
                    <option value="open">Open</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
