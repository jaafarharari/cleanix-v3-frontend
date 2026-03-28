import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { Link } from 'react-router-dom';
import { Download, Building2, CalendarDays, CheckCircle2, AlertCircle, Loader2, RefreshCw, Plug, Trash2, Power, Clock } from 'lucide-react';
import AdminNav from '@/components/AdminNav';
import { format } from 'date-fns';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
function authFetch(path, options = {}) {
  const token = localStorage.getItem('cleanix_access_token');
  return fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, ...options })
    .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Failed'); return j; });
}

const PROVIDERS = [
  { id: 'uplisting', label: 'Uplisting', keyHint: 'Settings → API & Webhooks' },
  { id: 'smoobu', label: 'Smoobu', keyHint: 'Settings → API Keys' },
];

// ── Manual import helpers (same as before) ─────────────────
async function fetchUplistingProperties(apiKey) {
  const raw = await api.pms.uplisting(apiKey, '/properties');
  const list = Array.isArray(raw) ? raw : (raw?.data || raw?.properties || Object.values(raw).find(v => Array.isArray(v)) || []);
  return list.map(p => p.attributes ? { id: p.id, name: p.attributes.nickname || p.attributes.name, address: p.attributes.address ? [p.attributes.address.street, p.attributes.address.city].filter(Boolean).join(', ') : '', city: p.attributes.address?.city || '' } : { id: p.id, name: p.nickname || p.name || `Property ${p.id}`, address: p.address || '', city: p.city || '' });
}

async function fetchUplistingBookings(apiKey, properties) {
  const today = new Date().toISOString().split('T')[0];
  const future = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
  const arrays = await Promise.all(properties.map(async p => {
    try { const raw = await api.pms.uplisting(apiKey, `/bookings/${p.id}?from=${today}&to=${future}`); return (Array.isArray(raw) ? raw : (raw?.bookings || raw?.data || [])).map(b => ({ ...b, _pms_prop_id: String(p.id) })); }
    catch { return []; }
  }));
  return arrays.flat();
}

async function fetchSmoobuProperties(apiKey) {
  const raw = await api.pms.smoobu(apiKey, '/apartments');
  const apts = raw?.apartments || raw;
  if (typeof apts === 'object' && !Array.isArray(apts)) return Object.entries(apts).map(([id, a]) => ({ id, name: a.name || `Apt ${id}`, city: a.location?.city || '' }));
  return Array.isArray(apts) ? apts.map(a => ({ id: a.id, name: a.name, city: a.city || '' })) : [];
}

async function fetchSmoobuBookings(apiKey) {
  const today = new Date().toISOString().split('T')[0];
  const future = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
  const raw = await api.pms.smoobu(apiKey, `/reservations?from=${today}&to=${future}&pageSize=100`);
  return raw?.bookings || raw?.reservations || (Array.isArray(raw) ? raw : []);
}

export default function PMSImport() {
  // Saved connections
  const [connections, setConnections] = useState([]);
  const [loadingConns, setLoadingConns] = useState(true);
  const [showAddConn, setShowAddConn] = useState(false);
  const [connProvider, setConnProvider] = useState('uplisting');
  const [connApiKey, setConnApiKey] = useState('');
  const [savingConn, setSavingConn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Manual import state
  const [manualMode, setManualMode] = useState(false);
  const [manualProvider, setManualProvider] = useState('uplisting');
  const [manualApiKey, setManualApiKey] = useState('');
  const [manualStep, setManualStep] = useState('key');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState('');
  const [pmsProperties, setPmsProperties] = useState([]);
  const [pmsBookings, setPmsBookings] = useState([]);
  const [selectedProps, setSelectedProps] = useState(new Set());
  const [importResults, setImportResults] = useState(null);

  useEffect(() => { loadConnections(); }, []);

  const loadConnections = async () => {
    setLoadingConns(true);
    try { const data = await authFetch('/api/pms/connections'); setConnections(data); }
    catch (e) { console.error(e); }
    setLoadingConns(false);
  };

  const saveConnection = async () => {
    if (!connApiKey.trim()) return;
    setSavingConn(true);
    try {
      const data = await authFetch('/api/pms/connections', { method: 'POST', body: JSON.stringify({ provider: connProvider, api_key: connApiKey.trim() }) });
      setConnections(prev => { const filtered = prev.filter(c => c.provider !== connProvider); return [...filtered, data]; });
      setConnApiKey(''); setShowAddConn(false);
    } catch (e) { alert(e.message); }
    setSavingConn(false);
  };

  const deleteConnection = async (id) => {
    try {
      await authFetch(`/api/pms/connections/${id}`, { method: 'DELETE' });
      setConnections(prev => prev.filter(c => c.id !== id));
    } catch (e) { alert(e.message); }
  };

  const toggleConnection = async (id) => {
    try {
      const data = await authFetch(`/api/pms/connections/${id}/toggle`, { method: 'POST' });
      setConnections(prev => prev.map(c => c.id === id ? data : c));
    } catch (e) { alert(e.message); }
  };

  const triggerSync = async () => {
    setSyncing(true); setSyncMessage('');
    try {
      const data = await authFetch('/api/pms/sync-now', { method: 'POST' });
      setSyncMessage(data.message || 'Sync triggered');
      setTimeout(loadConnections, 5000); // refresh after 5s to show updated status
    } catch (e) { setSyncMessage('Sync failed: ' + e.message); }
    setSyncing(false);
  };

  // ── Manual import logic ──────────────────────────────────
  const handleManualFetch = async () => {
    if (!manualApiKey.trim()) return;
    setManualLoading(true); setManualError('');
    try {
      let props, bookings;
      if (manualProvider === 'uplisting') { props = await fetchUplistingProperties(manualApiKey.trim()); bookings = await fetchUplistingBookings(manualApiKey.trim(), props); }
      else { props = await fetchSmoobuProperties(manualApiKey.trim()); bookings = await fetchSmoobuBookings(manualApiKey.trim()); }
      setPmsProperties(props); setPmsBookings(bookings);
      setSelectedProps(new Set(props.map(p => String(p.id))));
      setManualStep('preview');
    } catch (e) { setManualError(e.message || 'Failed to connect'); }
    setManualLoading(false);
  };

  const toggleProp = (id) => setSelectedProps(prev => { const n = new Set(prev); n.has(String(id)) ? n.delete(String(id)) : n.add(String(id)); return n; });
  const getBookingsForProp = (propId) => {
    if (manualProvider === 'uplisting') return pmsBookings.filter(b => String(b._pms_prop_id || b.property_id) === String(propId));
    return pmsBookings.filter(b => String(b.apartment?.id || b.apartmentId || b.apartment_id) === String(propId));
  };

  const handleManualImport = async () => {
    setManualLoading(true); setManualError('');
    try {
      const existingProps = await api.entities.Property.list();
      const existingJobs = await api.entities.Job.list();
      let propsCreated = 0, jobsCreated = 0, jobsSkipped = 0;
      const propMap = {};
      for (const p of pmsProperties) {
        if (!selectedProps.has(String(p.id))) continue;
        let existing = existingProps.find(ep => ep.name === p.name);
        if (!existing) { existing = await api.entities.Property.create({ name: p.name, address: p.name, city: p.city || '', is_active: true }); propsCreated++; }
        propMap[String(p.id)] = existing;
      }
      for (const b of pmsBookings) {
        const pmsId = manualProvider === 'uplisting' ? String(b._pms_prop_id || b.property_id) : String(b.apartment?.id || b.apartmentId || b.apartment_id);
        const propRecord = propMap[pmsId];
        if (!propRecord) continue;
        const date = manualProvider === 'uplisting' ? b.check_out : (b.departure || b.check_out);
        if (!date) continue;
        if (existingJobs.some(j => j.property_id === propRecord.id && j.scheduled_date === date)) { jobsSkipped++; continue; }
        await api.entities.Job.create({
          property_id: propRecord.id, property_name: propRecord.name, city: propRecord.city, status: 'pending', scheduled_date: date,
          checkout_time: b.departure_time || '', checkin_time: b.arrival_time || '',
          booking_source: manualProvider === 'uplisting' ? ({ airbnb: 'Airbnb', booking_dot_com: 'Booking.com' }[b.channel] || 'Other') : (b.channel?.name || 'Other'),
          guest_count: b.number_of_guests || (b.adults ? b.adults + (b.children || 0) : null),
          checklist: (propRecord.checklist_template || []).map(t => ({ task: t, completed: false })),
          status_history: [{ status: 'pending', timestamp: new Date().toISOString(), changed_by: 'manual_import' }],
        });
        jobsCreated++;
      }
      setImportResults({ propsCreated, jobsCreated, jobsSkipped }); setManualStep('done');
    } catch (e) { setManualError(e.message); }
    setManualLoading(false);
  };

  const resetManual = () => { setManualMode(false); setManualStep('key'); setManualApiKey(''); setPmsProperties([]); setPmsBookings([]); setSelectedProps(new Set()); setImportResults(null); setManualError(''); };

  return (
    <div className="min-h-screen bg-dark-900">
      <AdminNav />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center"><Download className="w-4 h-4 text-white" /></div>
          <div><h1 className="font-bold text-white">PMS Integration</h1><p className="text-sm text-dark-400">Auto-sync properties and bookings hourly</p></div>
        </div>

        {/* ── Saved connections ── */}
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2"><Plug className="w-4 h-4 text-accent" /> Connected PMS</h2>
            <div className="flex gap-2">
              <button className="btn-ghost text-sm border border-dark-700 flex items-center gap-1.5" onClick={triggerSync} disabled={syncing || connections.length === 0}>
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> Sync now
              </button>
              <button className="btn-primary text-sm flex items-center gap-1.5" onClick={() => setShowAddConn(true)}>
                <Plug className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          {syncMessage && <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 text-sm text-accent-light mb-4">{syncMessage}</div>}

          {loadingConns ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
          ) : connections.length === 0 ? (
            <div className="text-center py-8 text-dark-500">
              <Plug className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No PMS connected. Add one to enable auto-sync.</p>
              <p className="text-xs text-dark-600 mt-1">Properties and bookings will sync every hour automatically.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map(conn => (
                <div key={conn.id} className={`bg-dark-700/30 rounded-xl p-4 border ${conn.is_active ? 'border-success/20' : 'border-dark-700'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${conn.is_active ? 'bg-success' : 'bg-dark-600'}`} />
                      <div>
                        <p className="font-medium text-white capitalize">{conn.provider}</p>
                        <p className="text-xs text-dark-500">Key: {conn.api_key_preview}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn-ghost p-1.5" onClick={() => toggleConnection(conn.id)} title={conn.is_active ? 'Disable' : 'Enable'}>
                        <Power className={`w-4 h-4 ${conn.is_active ? 'text-success' : 'text-dark-500'}`} />
                      </button>
                      <button className="btn-ghost p-1.5 text-danger" onClick={() => deleteConnection(conn.id)} title="Remove">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {conn.last_sync_at && (
                    <div className="mt-2 flex items-center gap-3 text-xs text-dark-500">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Last sync: {format(new Date(conn.last_sync_at), 'MMM d, HH:mm')}</span>
                      <span className={conn.last_sync_status === 'success' ? 'text-success' : 'text-danger'}>{conn.last_sync_status}</span>
                      {conn.last_sync_status === 'success' && <span>{conn.last_sync_properties} props, {conn.last_sync_jobs} jobs</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Add connection modal ── */}
        {showAddConn && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddConn(false)}>
            <div className="card p-6 w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
              <h2 className="font-bold text-lg text-white mb-4">Connect PMS</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-dark-400 block mb-1.5">Provider</label>
                  <div className="flex gap-2">
                    {PROVIDERS.map(p => (
                      <button key={p.id} onClick={() => setConnProvider(p.id)}
                        className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                          connProvider === p.id ? 'bg-accent/15 text-accent-light border-accent/30' : 'bg-dark-800 text-dark-400 border-dark-700'
                        }`}>{p.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-dark-400 block mb-1.5">API Key</label>
                  <p className="text-xs text-dark-500 mb-2">Find it in {PROVIDERS.find(p => p.id === connProvider)?.keyHint}</p>
                  <input type="password" className="input-dark w-full" placeholder="Paste your API key..." value={connApiKey} onChange={e => setConnApiKey(e.target.value)} />
                </div>
                <p className="text-xs text-dark-500">Once saved, properties and bookings will sync automatically every hour.</p>
                <div className="flex gap-3">
                  <button className="btn-ghost flex-1 border border-dark-700" onClick={() => setShowAddConn(false)}>Cancel</button>
                  <button className="btn-primary flex-1 flex items-center justify-center gap-1.5" onClick={saveConnection} disabled={!connApiKey.trim() || savingConn}>
                    {savingConn && <Loader2 className="w-4 h-4 animate-spin" />} Save & Connect
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Manual import section ── */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Manual Import</h2>
            {!manualMode && <button className="btn-ghost text-sm border border-dark-700" onClick={() => setManualMode(true)}>One-time import</button>}
          </div>

          {!manualMode ? (
            <p className="text-sm text-dark-500">Use this for a one-time import without saving the API key. For automatic syncing, use the connections above.</p>
          ) : manualStep === 'key' ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                {PROVIDERS.map(p => (
                  <button key={p.id} onClick={() => setManualProvider(p.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      manualProvider === p.id ? 'bg-accent/15 text-accent-light border-accent/30' : 'bg-dark-800 text-dark-400 border-dark-700'
                    }`}>{p.label}</button>
                ))}
              </div>
              <div className="flex gap-3">
                <input type="password" className="input-dark flex-1" placeholder="API key..." value={manualApiKey} onChange={e => setManualApiKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleManualFetch()} />
                <button className="btn-primary" onClick={handleManualFetch} disabled={!manualApiKey.trim() || manualLoading}>
                  {manualLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                </button>
              </div>
              {manualError && <div className="flex items-center gap-2 text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg p-3"><AlertCircle className="w-4 h-4" />{manualError}</div>}
              <button className="btn-ghost text-sm" onClick={resetManual}>Cancel</button>
            </div>
          ) : manualStep === 'preview' ? (
            <div className="space-y-4">
              <p className="text-sm text-dark-300">Found <strong className="text-white">{pmsProperties.length}</strong> properties, <strong className="text-white">{pmsBookings.length}</strong> bookings</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pmsProperties.map(p => {
                  const sel = selectedProps.has(String(p.id));
                  return (
                    <div key={p.id} className={`p-3 rounded-xl border cursor-pointer transition-all ${sel ? 'border-accent/40 bg-accent/5' : 'border-dark-700 bg-dark-800'}`} onClick={() => toggleProp(p.id)}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded flex items-center justify-center ${sel ? 'bg-accent' : 'bg-dark-700'}`}>
                          {sel && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-sm text-white">{p.name}</span>
                        <span className="text-xs text-dark-500">{getBookingsForProp(p.id).length} bookings</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {manualError && <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg p-3">{manualError}</div>}
              <div className="flex gap-3">
                <button className="btn-ghost flex-1 border border-dark-700" onClick={resetManual}>Cancel</button>
                <button className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={selectedProps.size === 0 || manualLoading} onClick={handleManualImport}>
                  {manualLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Import {selectedProps.size}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
              <p className="font-bold text-white mb-2">Import complete!</p>
              <p className="text-sm text-dark-400">{importResults?.propsCreated} properties, {importResults?.jobsCreated} jobs created</p>
              <button className="btn-ghost text-sm mt-4" onClick={resetManual}>Done</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
