import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { Plus, Home, MapPin, Edit2, Trash2, X, Check, Loader2, ClipboardCheck } from 'lucide-react';
import AdminNav from '@/components/AdminNav';

const emptyForm = { name: '', address: '', city: '', latitude: '', longitude: '', host_notes: '', checklist_template: [], checkout_checklist_template: [] };

export default function Properties() {
  const [properties, setProperties] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [newTask, setNewTask] = useState('');
  const [newCheckoutTask, setNewCheckoutTask] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.entities.Property.list().then(data => { setProperties(data); setLoading(false); });
  }, []);

  const openCreate = () => { setForm(emptyForm); setEditId(null); setShowForm(true); };
  const openEdit = (p) => { setForm({ ...p, checklist_template: p.checklist_template || [], checkout_checklist_template: p.checkout_checklist_template || [] }); setEditId(p.id); setShowForm(true); };

  const handleSave = async () => {
    const data = { ...form, latitude: form.latitude ? parseFloat(form.latitude) : null, longitude: form.longitude ? parseFloat(form.longitude) : null };
    if (editId) {
      const updated = await api.entities.Property.update(editId, data);
      setProperties(prev => prev.map(p => p.id === editId ? updated : p));
    } else {
      const created = await api.entities.Property.create(data);
      setProperties(prev => [...prev, created]);
    }
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    await api.entities.Property.delete(id);
    setProperties(prev => prev.filter(p => p.id !== id));
  };

  const addTask = () => { if (!newTask.trim()) return; setForm(f => ({ ...f, checklist_template: [...(f.checklist_template || []), newTask.trim()] })); setNewTask(''); };
  const removeTask = (i) => { setForm(f => ({ ...f, checklist_template: f.checklist_template.filter((_, idx) => idx !== i) })); };

  const addCheckoutTask = () => { if (!newCheckoutTask.trim()) return; setForm(f => ({ ...f, checkout_checklist_template: [...(f.checkout_checklist_template || []), newCheckoutTask.trim()] })); setNewCheckoutTask(''); };
  const removeCheckoutTask = (i) => { setForm(f => ({ ...f, checkout_checklist_template: f.checkout_checklist_template.filter((_, idx) => idx !== i) })); };

  return (
    <div className="min-h-screen bg-dark-900">
      <AdminNav />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Home className="w-5 h-5 text-accent" />
            <h1 className="text-xl font-bold text-white">Properties</h1>
          </div>
          <button className="btn-primary text-sm flex items-center gap-1.5" onClick={openCreate}>
            <Plus className="w-4 h-4" /> Add Property
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
        ) : properties.length === 0 ? (
          <div className="text-center py-20 text-dark-500">
            <Home className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No properties yet. Add your first one!</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {properties.map(p => (
              <div key={p.id} className="card-hover p-5 animate-slide-up">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-white">{p.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-dark-500" />
                      <p className="text-sm text-dark-400">{p.address}</p>
                    </div>
                    <span className="badge bg-dark-700 text-dark-300 border border-dark-600 mt-2">{p.city}</span>
                  </div>
                  <div className="flex gap-1">
                    <button className="btn-ghost p-2" onClick={() => openEdit(p)}><Edit2 className="w-4 h-4" /></button>
                    <button className="btn-ghost p-2 text-danger" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex gap-3 mt-2">
                  {p.checklist_template?.length > 0 && <p className="text-xs text-dark-500">{p.checklist_template.length} cleaning tasks</p>}
                  {p.checkout_checklist_template?.length > 0 && <p className="text-xs text-warning/70">{p.checkout_checklist_template.length} checkout tasks</p>}
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
              <h2 className="font-bold text-lg text-white">{editId ? 'Edit Property' : 'Add Property'}</h2>
              <button onClick={() => setShowForm(false)} className="text-dark-500 hover:text-dark-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <input className="input-dark w-full" placeholder="Property name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="input-dark w-full" placeholder="Full address *" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              <input className="input-dark w-full" placeholder="City *" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className="input-dark w-full" placeholder="Latitude" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} />
                <input className="input-dark w-full" placeholder="Longitude" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} />
              </div>
              <textarea className="input-dark w-full resize-none" placeholder="Host notes for cleaners" value={form.host_notes} onChange={e => setForm({ ...form, host_notes: e.target.value })} rows={3} />

              {/* Cleaning checklist */}
              <div>
                <p className="text-sm font-medium text-dark-300 mb-2">Cleaning checklist</p>
                <p className="text-xs text-dark-500 mb-2">Tasks the cleaner completes during the clean</p>
                <div className="space-y-2 mb-2">
                  {(form.checklist_template || []).map((task, i) => (
                    <div key={i} className="flex items-center gap-2 bg-dark-700 rounded-lg px-3 py-2 text-sm text-dark-200">
                      <span className="flex-1">{task}</span>
                      <button onClick={() => removeTask(i)}><X className="w-3 h-3 text-dark-500 hover:text-dark-300" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="input-dark flex-1" placeholder="Add cleaning task..." value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} />
                  <button className="btn-ghost border border-dark-700 px-3" onClick={addTask}>Add</button>
                </div>
              </div>

              {/* Checkout checklist */}
              <div className="border-t border-dark-700 pt-4">
                <p className="text-sm font-medium text-warning mb-2 flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4" /> Checkout checklist
                </p>
                <p className="text-xs text-dark-500 mb-2">Items the cleaner must verify before clocking out. Unchecked items get flagged for the next visit.</p>
                <div className="space-y-2 mb-2">
                  {(form.checkout_checklist_template || []).map((task, i) => (
                    <div key={i} className="flex items-center gap-2 bg-warning/5 border border-warning/10 rounded-lg px-3 py-2 text-sm text-dark-200">
                      <span className="flex-1">{task}</span>
                      <button onClick={() => removeCheckoutTask(i)}><X className="w-3 h-3 text-dark-500 hover:text-dark-300" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="input-dark flex-1" placeholder="Add checkout item..." value={newCheckoutTask} onChange={e => setNewCheckoutTask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCheckoutTask()} />
                  <button className="btn-ghost border border-dark-700 px-3" onClick={addCheckoutTask}>Add</button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button className="btn-ghost flex-1 border border-dark-700" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn-primary flex-1 flex items-center justify-center gap-1.5" onClick={handleSave} disabled={!form.name || !form.address || !form.city}>
                  <Check className="w-4 h-4" /> Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
