import { useState } from 'react';
import api from '@/api/apiClient';
import { Link } from 'react-router-dom';
import { Download, Building2, CalendarDays, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import AdminNav from '@/components/AdminNav';

// ── Uplisting helpers ──────────────────────────────────────
function parseUplistingProperty(p) {
  if (p.attributes) return { id: p.id, name: p.attributes.name || p.attributes.nickname, nickname: p.attributes.nickname, time_zone: p.attributes.time_zone, address: p.attributes.address || null };
  return p;
}

async function fetchUplistingProperties(apiKey) {
  const raw = await api.pms.uplisting(apiKey, '/properties');
  const list = Array.isArray(raw) ? raw : (raw?.data || raw?.properties || raw?.items || Object.values(raw).find(v => Array.isArray(v)) || []);
  return list.map(parseUplistingProperty);
}

async function fetchUplistingBookings(apiKey, properties) {
  const today = new Date().toISOString().split('T')[0];
  const future = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
  const arrays = await Promise.all(properties.map(async p => {
    try { const raw = await api.pms.uplisting(apiKey, `/bookings/${p.id}?from=${today}&to=${future}`); return Array.isArray(raw) ? raw : (raw?.bookings || raw?.data || []); }
    catch { return []; }
  }));
  return arrays.flat();
}

function uplistingBookingToJob(booking, propRecord) {
  const channelLabel = { airbnb: 'Airbnb', airbnb_official: 'Airbnb', booking_dot_com: 'Booking.com', homeaway: 'Other', uplisting: 'Other', google: 'Other' };
  return {
    property_id: propRecord.id, property_name: propRecord.name, city: propRecord.city, status: 'pending',
    scheduled_date: booking.check_out, checkout_time: booking.departure_time || '', checkin_time: booking.arrival_time || '',
    booking_source: channelLabel[booking.channel] || 'Other', guest_count: booking.number_of_guests || null, host_notes: booking.note || '',
    checklist: (propRecord.checklist_template || []).map(task => ({ task, completed: false })),
    status_history: [{ status: 'pending', timestamp: new Date().toISOString(), changed_by: 'pms_import' }],
  };
}

function uplistingPropToCreate(p) {
  const addrObj = p.address;
  return {
    name: p.name || p.nickname || `Property ${p.id}`,
    address: addrObj ? [addrObj.street, addrObj.city].filter(Boolean).join(', ') || p.name : p.name || '',
    city: addrObj?.city || p.time_zone?.split('/')[1]?.replace(/_/g, ' ') || '',
    is_active: true,
  };
}

// ── Smoobu helpers ─────────────────────────────────────────
async function fetchSmoobuProperties(apiKey) {
  const raw = await api.pms.smoobu(apiKey, '/apartments');
  // Smoobu returns { apartments: { id: {...}, id: {...} } }
  const apartments = raw?.apartments || raw;
  if (typeof apartments === 'object' && !Array.isArray(apartments)) {
    return Object.entries(apartments).map(([id, apt]) => ({
      id, name: apt.name || `Apartment ${id}`,
      address: apt.location || null,
      city: apt.location?.city || '',
    }));
  }
  return Array.isArray(apartments) ? apartments : [];
}

async function fetchSmoobuBookings(apiKey) {
  const today = new Date().toISOString().split('T')[0];
  const future = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
  const raw = await api.pms.smoobu(apiKey, `/reservations?from=${today}&to=${future}&pageSize=100`);
  return raw?.bookings || raw?.reservations || (Array.isArray(raw) ? raw : []);
}

function smoobuBookingToJob(booking, propRecord) {
  const channel = booking.channel?.name || booking.source || 'Other';
  return {
    property_id: propRecord.id, property_name: propRecord.name, city: propRecord.city, status: 'pending',
    scheduled_date: booking.departure || booking.check_out || '',
    checkout_time: '', checkin_time: '',
    booking_source: channel, guest_count: booking.adults ? (booking.adults + (booking.children || 0)) : null,
    host_notes: booking.notice || booking.notes || '',
    checklist: (propRecord.checklist_template || []).map(task => ({ task, completed: false })),
    status_history: [{ status: 'pending', timestamp: new Date().toISOString(), changed_by: 'pms_import' }],
  };
}

function smoobuPropToCreate(p) {
  return {
    name: p.name || `Property ${p.id}`,
    address: p.address?.street ? [p.address.street, p.address.city].filter(Boolean).join(', ') : p.name || '',
    city: p.address?.city || p.city || '',
    is_active: true,
  };
}

// ── Main component ─────────────────────────────────────────
const PROVIDERS = [
  { id: 'uplisting', label: 'Uplisting', keyPlaceholder: 'Your Uplisting API key...', keyHint: 'Settings → API & Webhooks' },
  { id: 'smoobu', label: 'Smoobu', keyPlaceholder: 'Your Smoobu API key...', keyHint: 'Settings → API Keys' },
];

export default function PMSImport() {
  const [provider, setProvider] = useState('uplisting');
  const [apiKey, setApiKey] = useState('');
  const [step, setStep] = useState('key'); // key | preview | done
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pmsProperties, setPmsProperties] = useState([]);
  const [pmsBookings, setPmsBookings] = useState([]);
  const [selectedProps, setSelectedProps] = useState(new Set());
  const [importResults, setImportResults] = useState(null);

  const prov = PROVIDERS.find(p => p.id === provider);

  const handleFetch = async () => {
    if (!apiKey.trim()) return;
    setLoading(true); setError('');
    try {
      let props, bookings;
      if (provider === 'uplisting') {
        props = await fetchUplistingProperties(apiKey.trim());
        bookings = await fetchUplistingBookings(apiKey.trim(), props);
      } else {
        props = await fetchSmoobuProperties(apiKey.trim());
        bookings = await fetchSmoobuBookings(apiKey.trim());
      }
      setPmsProperties(props);
      setPmsBookings(bookings);
      setSelectedProps(new Set(props.map(p => String(p.id))));
      setStep('preview');
    } catch (e) { setError(e.message || 'Failed to connect. Check your API key.'); }
    finally { setLoading(false); }
  };

  const toggleProp = (id) => setSelectedProps(prev => { const next = new Set(prev); next.has(String(id)) ? next.delete(String(id)) : next.add(String(id)); return next; });

  const getBookingsForProp = (propId) => {
    if (provider === 'uplisting') return pmsBookings.filter(b => String(b.property_id) === String(propId));
    return pmsBookings.filter(b => String(b.apartment?.id || b.apartmentId || b.apartment_id) === String(propId));
  };

  const handleImport = async () => {
    setLoading(true); setError('');
    try {
      const existingProps = await api.entities.Property.list();
      const existingJobs = await api.entities.Job.list();
      let propsCreated = 0, jobsCreated = 0, jobsSkipped = 0;
      const propIdMap = {};

      for (const pmsProp of pmsProperties) {
        if (!selectedProps.has(String(pmsProp.id))) continue;
        const propName = pmsProp.name || `Property ${pmsProp.id}`;
        let existing = existingProps.find(p => p.name === propName);
        if (!existing) {
          const createData = provider === 'uplisting' ? uplistingPropToCreate(pmsProp) : smoobuPropToCreate(pmsProp);
          existing = await api.entities.Property.create(createData);
          propsCreated++;
        }
        propIdMap[String(pmsProp.id)] = existing;
      }

      for (const booking of pmsBookings) {
        const pmsId = provider === 'uplisting'
          ? String(booking.property_id)
          : String(booking.apartment?.id || booking.apartmentId || booking.apartment_id);
        const propRecord = propIdMap[pmsId];
        if (!propRecord) continue;

        const jobData = provider === 'uplisting'
          ? uplistingBookingToJob(booking, propRecord)
          : smoobuBookingToJob(booking, propRecord);

        if (!jobData.scheduled_date) continue;

        if (existingJobs.some(j => j.property_id === propRecord.id && j.scheduled_date === jobData.scheduled_date)) {
          jobsSkipped++; continue;
        }

        await api.entities.Job.create(jobData);
        jobsCreated++;
      }

      setImportResults({ propsCreated, jobsCreated, jobsSkipped });
      setStep('done');
    } catch (e) { setError(e.message || 'Import failed.'); }
    finally { setLoading(false); }
  };

  const resetAll = () => {
    setStep('key'); setApiKey(''); setPmsProperties([]); setPmsBookings([]); setSelectedProps(new Set()); setImportResults(null); setError('');
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <AdminNav />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center"><Download className="w-4 h-4 text-white" /></div>
          <div><h1 className="font-bold text-white">PMS Import</h1><p className="text-sm text-dark-400">Sync properties and bookings from your PMS</p></div>
        </div>

        {/* Provider tabs */}
        {step === 'key' && (
          <div className="flex gap-2 mb-6">
            {PROVIDERS.map(p => (
              <button key={p.id} onClick={() => { setProvider(p.id); setApiKey(''); setError(''); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  provider === p.id ? 'bg-accent/15 text-accent-light border-accent/30' : 'bg-dark-800 text-dark-400 border-dark-700 hover:border-dark-600'
                }`}>{p.label}</button>
            ))}
          </div>
        )}

        {/* Step: API Key */}
        {step === 'key' && (
          <div className="card p-6">
            <h2 className="font-semibold text-white mb-1">Enter your {prov.label} API Key</h2>
            <p className="text-sm text-dark-400 mb-4">Find it in {prov.label} → {prov.keyHint}</p>
            <div className="flex gap-3">
              <input type="password" className="input-dark flex-1" placeholder={prov.keyPlaceholder} value={apiKey}
                onChange={e => setApiKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleFetch()} />
              <button className="btn-primary" onClick={handleFetch} disabled={!apiKey.trim() || loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
              </button>
            </div>
            {error && <div className="mt-3 flex items-center gap-2 text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg p-3"><AlertCircle className="w-4 h-4" />{error}</div>}
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-dark-300">
                Found <strong className="text-white">{pmsProperties.length}</strong> properties and{' '}
                <strong className="text-white">{pmsBookings.length}</strong> bookings from {prov.label}.
              </p>
              <button className="btn-ghost text-sm border border-dark-700" onClick={resetAll}><RefreshCw className="w-4 h-4 mr-1" /> Change</button>
            </div>
            <div className="space-y-3">
              {pmsProperties.map(prop => {
                const bookings = getBookingsForProp(prop.id);
                const selected = selectedProps.has(String(prop.id));
                return (
                  <div key={prop.id} className={`card p-4 flex items-start gap-3 cursor-pointer transition-all ${selected ? 'border-accent/40 glow-accent' : ''}`}
                    onClick={() => toggleProp(prop.id)}>
                    <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${selected ? 'bg-accent' : 'bg-dark-700'}`}>
                      {selected && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{prop.name}</p>
                      {prop.city && <p className="text-xs text-dark-500">{prop.city}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-dark-500 flex items-center gap-1"><CalendarDays className="w-3 h-3" />{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {error && <div className="flex items-center gap-2 text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg p-3"><AlertCircle className="w-4 h-4" />{error}</div>}
            <div className="flex gap-3">
              <button className="btn-ghost flex-1 border border-dark-700" onClick={resetAll}>Back</button>
              <button className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={selectedProps.size === 0 || loading} onClick={handleImport}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Importing...</> : <><Download className="w-4 h-4" />Import {selectedProps.size}</>}
              </button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && importResults && (
          <div className="card p-8 text-center glow-success border-success/20">
            <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-7 h-7 text-success" /></div>
            <h2 className="font-bold text-xl text-white mb-2">Import Complete!</h2>
            <div className="space-y-2 text-sm text-dark-300 mb-6">
              <p><strong className="text-white">{importResults.propsCreated}</strong> new properties</p>
              <p><strong className="text-white">{importResults.jobsCreated}</strong> jobs created</p>
              {importResults.jobsSkipped > 0 && <p className="text-dark-500">{importResults.jobsSkipped} skipped (already exist)</p>}
            </div>
            <div className="flex gap-3 justify-center">
              <Link to="/properties"><button className="btn-ghost border border-dark-700 flex items-center gap-2"><Building2 className="w-4 h-4" /> Properties</button></Link>
              <Link to="/jobs"><button className="btn-primary flex items-center gap-2"><CalendarDays className="w-4 h-4" /> Jobs</button></Link>
            </div>
            <button className="btn-ghost text-sm mt-4" onClick={resetAll}>Import more</button>
          </div>
        )}
      </main>
    </div>
  );
}
