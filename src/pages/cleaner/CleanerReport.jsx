import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { Link } from 'react-router-dom';
import { Flag, Camera, Loader2, CheckCircle2, Home, ArrowLeft } from 'lucide-react';

const CATEGORIES = ['Appliance', 'Plumbing', 'Electrical', 'Damage', 'Safety', 'Other'];

export default function CleanerReport() {
  const [properties, setProperties] = useState([]);
  const [myIssues, setMyIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [propertyId, setPropertyId] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      const me = await api.auth.me();
      const [props, issues] = await Promise.all([
        api.entities.Property.list(),
        api.entities.MaintenanceIssue.list('-created_date', 50),
      ]);
      setProperties(props);
      setMyIssues(issues.filter(i => i.reported_by === me.email));
      setLoading(false);
    };
    load();
  }, []);

  const handleAddPhoto = () => {
    if (photos.length >= 3) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploadingPhoto(true);
      try {
        const { file_url } = await api.integrations.Core.UploadFile({ file });
        setPhotos(prev => [...prev, file_url]);
      } catch (err) {
        console.error('Upload failed:', err);
      }
      setUploadingPhoto(false);
    };
    input.click();
  };

  const handleSubmit = async () => {
    if (!propertyId || !category || !description) return;
    setSubmitting(true);
    try {
      const user = await api.auth.me();
      await api.entities.MaintenanceIssue.create({
        property_id: propertyId,
        property_name: propertyName,
        category,
        description,
        photo_urls: photos,
        status: 'open',
        reported_by: user.email,
      });

      // Notify admins
      const allUsers = await api.entities.User.list();
      const adminEmails = allUsers.filter(u => u.role === 'admin').map(u => u.email);
      if (adminEmails.length > 0) {
        api.notifications.send(adminEmails, 'New Maintenance Issue', `${category} issue reported at ${propertyName}`, '/issues').catch(() => {});
      }

      setSuccess(true);
      setPropertyId('');
      setPropertyName('');
      setCategory('');
      setDescription('');
      setPhotos([]);
      setTimeout(() => setSuccess(false), 3000);

      // Refresh my issues
      const issues = await api.entities.MaintenanceIssue.list('-created_date', 50);
      const me = await api.auth.me();
      setMyIssues(issues.filter(i => i.reported_by === me.email));
    } catch (err) {
      console.error('Submit failed:', err);
    }
    setSubmitting(false);
  };

  const handlePropertyChange = (e) => {
    const prop = properties.find(p => p.id === e.target.value);
    setPropertyId(e.target.value);
    setPropertyName(prop?.name || '');
  };

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col pb-24">
      <header className="bg-dark-800/80 backdrop-blur-xl border-b border-dark-700/50 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link to="/cleaner"><button className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></button></Link>
        <Flag className="w-5 h-5 text-warning" />
        <h1 className="font-bold text-white">Report Issue</h1>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-6">
        {success && (
          <div className="bg-success/10 border border-success/20 rounded-xl p-4 flex items-center gap-3 animate-slide-up glow-success">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <p className="text-success font-medium text-sm">Issue reported successfully!</p>
          </div>
        )}

        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-white">New Issue</h2>

          <div>
            <label className="text-sm font-medium text-dark-300 block mb-1.5">Property *</label>
            <select className="input-dark w-full" value={propertyId} onChange={handlePropertyChange}>
              <option value="">Select property</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name} — {p.city}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-dark-300 block mb-1.5">Category *</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                    category === c ? 'bg-accent/15 text-accent-light border-accent/30' : 'bg-dark-800 text-dark-400 border-dark-700 hover:border-dark-600'
                  }`}>{c}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-dark-300 block mb-1.5">Description *</label>
            <textarea className="input-dark w-full resize-none" placeholder="Describe the issue..." value={description}
              onChange={e => setDescription(e.target.value)} rows={4} />
          </div>

          <div>
            <label className="text-sm font-medium text-dark-300 block mb-1.5">Photos (optional, up to 3)</label>
            <div className="flex gap-2 flex-wrap">
              {photos.map((url, i) => (
                <img key={i} src={url} alt="issue" className="w-20 h-20 rounded-xl object-cover border border-dark-700" />
              ))}
              {photos.length < 3 && (
                <button onClick={handleAddPhoto} disabled={uploadingPhoto}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-dark-600 flex items-center justify-center text-dark-500 hover:border-dark-500 hover:text-dark-400 transition-all">
                  {uploadingPhoto ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>

          <button className="btn-primary w-full h-12 flex items-center justify-center gap-2 bg-warning hover:bg-warning-dark"
            disabled={!propertyId || !category || !description || submitting} onClick={handleSubmit}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <Flag className="w-4 h-4" /> Submit Report
          </button>
        </div>

        {/* My previous reports */}
        {myIssues.length > 0 && (
          <div>
            <h2 className="font-semibold text-dark-300 mb-3">My Previous Reports</h2>
            <div className="space-y-3">
              {myIssues.slice(0, 10).map(issue => (
                <div key={issue.id} className="card p-4 animate-slide-up">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge bg-dark-700 text-dark-300 border-dark-600">{issue.category}</span>
                    <span className={`badge ${issue.status === 'open' ? 'badge-open' : issue.status === 'acknowledged' ? 'badge-acknowledged' : 'badge-resolved'}`}>{issue.status}</span>
                  </div>
                  <p className="text-sm text-dark-300">{issue.property_name}</p>
                  <p className="text-xs text-dark-500 mt-1 line-clamp-2">{issue.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-dark-800/90 backdrop-blur-xl border-t border-dark-700/50 px-4 pt-2 pb-8 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-around">
          <Link to="/cleaner" className="flex flex-col items-center gap-1 py-1 text-dark-400 hover:text-dark-200">
            <Home className="w-5 h-5" /><span className="text-[10px] font-medium">Jobs</span>
          </Link>
          <Link to="/cleaner/report" className="flex flex-col items-center gap-1 py-1 text-warning">
            <Flag className="w-5 h-5" /><span className="text-[10px] font-medium">Report Issue</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
