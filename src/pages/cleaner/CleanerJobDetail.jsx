import { useState, useEffect } from 'react';
import api from '@/api/apiClient';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, CheckCircle2, Loader2, Video, StopCircle, RotateCcw, X, Flag, Home } from 'lucide-react';
import { format } from 'date-fns';
import { useRef } from 'react';

// Inline VideoCapture component
function VideoCapture({ label, uploadedUrl, onUploaded }) {
  const [recording, setRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const videoRef = useRef(null);

  const startCamera = async () => {
    setCameraError(null); setShowCamera(true); setVideoBlob(null); setPreviewUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; videoRef.current.play(); }
    } catch { setCameraError('Camera access denied.'); }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm;codecs=vp8,opus' });
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setVideoBlob(blob); setPreviewUrl(URL.createObjectURL(blob));
      streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    };
    mediaRecorderRef.current = recorder; recorder.start(); setRecording(true);
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setRecording(false); };
  const retake = () => { setVideoBlob(null); setPreviewUrl(null); setShowCamera(false); };

  const uploadVideo = async () => {
    if (!videoBlob) return;
    setUploading(true);
    const file = new File([videoBlob], 'video.webm', { type: 'video/webm' });
    const { file_url } = await api.integrations.Core.UploadFile({ file });
    onUploaded(file_url);
    setShowCamera(false); setVideoBlob(null); setPreviewUrl(null); setUploading(false);
  };

  if (uploadedUrl) {
    return (
      <div className="flex items-center gap-3 p-3 bg-success/10 border border-success/20 rounded-xl">
        <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-success">{label} — Recorded ✓</p>
          <a href={uploadedUrl} target="_blank" rel="noreferrer" className="text-xs text-success/70 underline">Preview</a>
        </div>
        <button className="btn-ghost p-1 text-success" onClick={() => onUploaded(null)}><RotateCcw className="w-4 h-4" /></button>
      </div>
    );
  }

  if (showCamera) {
    return (
      <div className="rounded-xl border border-dark-700 overflow-hidden bg-black">
        {cameraError ? (
          <div className="p-4 text-danger text-sm text-center">
            <p>{cameraError}</p>
            <button className="btn-ghost mt-3 border border-dark-600 text-sm" onClick={() => setShowCamera(false)}><X className="w-4 h-4 mr-1" /> Close</button>
          </div>
        ) : previewUrl ? (
          <div>
            <video src={previewUrl} controls className="w-full max-h-64" />
            <div className="p-3 flex gap-2 bg-dark-800">
              <button className="btn-ghost flex-1 border border-dark-700 text-sm" onClick={retake}><RotateCcw className="w-4 h-4 mr-1" /> Retake</button>
              <button className="btn-primary flex-1 bg-success hover:bg-success-dark text-sm" onClick={uploadVideo} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                {uploading ? 'Uploading...' : 'Use This'}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <video ref={videoRef} className="w-full max-h-64 object-cover" playsInline muted autoPlay />
            <div className="p-3 flex gap-2 bg-dark-800">
              <button className="btn-ghost border border-dark-700 p-2" onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setShowCamera(false); }}><X className="w-4 h-4" /></button>
              {!recording ? (
                <button className="btn-primary flex-1 bg-danger hover:bg-danger-dark text-sm" onClick={startRecording}><Video className="w-4 h-4 mr-1" /> Start</button>
              ) : (
                <button className="btn-primary flex-1 bg-danger animate-pulse text-sm" onClick={stopRecording}><StopCircle className="w-4 h-4 mr-1" /> Stop</button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return <button className="btn-primary w-full h-14 text-base" onClick={startCamera}><Video className="w-5 h-5 mr-2" /> Record {label}</button>;
}

export default function CleanerJobDetail() {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [beforeVideoUrl, setBeforeVideoUrl] = useState(null);
  const [afterVideoUrl, setAfterVideoUrl] = useState(null);
  const [clockingIn, setClockingIn] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const navigate = useNavigate();
  const jobId = new URLSearchParams(window.location.search).get('id');

  useEffect(() => {
    if (!jobId) return;
    api.entities.Job.filter({ id: jobId }).then(data => { setJob(data[0] || null); setLoading(false); });
  }, [jobId]);

  useEffect(() => {
    if (job?.clock_in_time && job?.status === 'in_progress') {
      const start = new Date(job.clock_in_time).getTime();
      const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
      return () => clearInterval(interval);
    }
  }, [job?.clock_in_time, job?.status]);

  const formatTime = s => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${h > 0 ? h + 'h ' : ''}${m}m ${sec}s`;
  };

  const handleBeforeVideo = async (url) => {
    setBeforeVideoUrl(url);
    if (url) { const updated = await api.entities.Job.update(job.id, { before_video_url: url }); setJob(updated); }
  };

  const handleClockIn = async () => {
    setGpsError(null); setClockingIn(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      if (job.latitude && job.longitude) {
        const R = 6371000, dLat = ((job.latitude - latitude) * Math.PI) / 180, dLon = ((job.longitude - longitude) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(latitude * Math.PI / 180) * Math.cos(job.latitude * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        if (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) > 150) { setGpsError('You must be at the property (within 150m).'); setClockingIn(false); return; }
      }
      const now = new Date().toISOString();
      const updated = await api.entities.Job.update(job.id, {
        status: 'in_progress', clock_in_time: now, clock_in_lat: latitude, clock_in_lng: longitude,
        status_history: [...(job.status_history || []), { status: 'in_progress', timestamp: now, changed_by: 'cleaner' }],
      });
      setJob(updated); setClockingIn(false);
    }, () => { setGpsError('Could not get location. Enable GPS.'); setClockingIn(false); }, { timeout: 10000 });
  };

  const handleChecklistToggle = async (idx) => {
    const checklist = [...(job.checklist || [])];
    checklist[idx] = { ...checklist[idx], completed: !checklist[idx].completed, completed_at: !checklist[idx].completed ? new Date().toISOString() : null };
    const updated = await api.entities.Job.update(job.id, { checklist });
    setJob(updated);
  };

  const handleClockOut = async () => {
    setSubmitting(true);
    const now = new Date().toISOString();
    const updated = await api.entities.Job.update(job.id, {
      status: 'complete', clock_out_time: now, after_video_url: afterVideoUrl || job.after_video_url, cleaner_notes: notes,
      status_history: [...(job.status_history || []), { status: 'complete', timestamp: now, changed_by: 'cleaner' }],
    });
    setJob(updated); setSubmitting(false);
    // Notify admins
    const allUsers = await api.entities.User.list();
    const admins = allUsers.filter(u => u.role === 'admin').map(u => u.email);
    if (admins.length) api.notifications.send(admins, 'Job Complete', `${job.property_name} has been cleaned`, `/job?id=${job.id}`).catch(() => {});
  };

  if (loading) return <div className="min-h-screen bg-dark-900 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  if (!job) return <div className="min-h-screen bg-dark-900 flex items-center justify-center text-dark-500">Job not found.</div>;

  const allDone = job.checklist?.length > 0 && job.checklist.every(t => t.completed);

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col pb-20">
      <header className="bg-dark-800/80 backdrop-blur-xl border-b border-dark-700/50 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button className="btn-ghost p-2" onClick={() => navigate('/cleaner')}><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <h1 className="font-bold text-white">{job.property_name}</h1>
          <p className="text-xs text-dark-400">{job.city}</p>
        </div>
        {job.status === 'in_progress' && (
          <div className="bg-purple-500/15 border border-purple-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-purple-300 font-mono font-bold text-sm">{formatTime(elapsed)}</span>
          </div>
        )}
        <span className={`badge ${job.status === 'complete' ? 'badge-complete' : 'badge-assigned'}`}>{job.status.replace('_', ' ')}</span>
      </header>

      <main className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-4">
        {/* Completed */}
        {job.status === 'complete' && (
          <div className="card p-6 text-center glow-success border-success/20">
            <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2" />
            <p className="font-semibold text-success">Job Complete</p>
            {job.clock_out_time && <p className="text-sm text-success/70 mt-1">Clocked out at {format(new Date(job.clock_out_time), 'HH:mm')}</p>}
          </div>
        )}

        {/* In Progress */}
        {job.status === 'in_progress' && (
          <>
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-white">Cleaning Checklist</p>
                <span className="text-sm text-dark-400">{job.checklist?.filter(t => t.completed).length || 0}/{job.checklist?.length || 0}</span>
              </div>
              {!job.checklist?.length ? <p className="text-sm text-dark-500">No checklist items</p> : (
                <div className="space-y-3">
                  {job.checklist.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 cursor-pointer" onClick={() => handleChecklistToggle(i)}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${item.completed ? 'bg-success border-success' : 'border-dark-600'}`}>
                        {item.completed && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-sm ${item.completed ? 'line-through text-dark-500' : 'text-dark-200'}`}>{item.task}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link to={`/cleaner/report`}>
              <button className="btn-ghost w-full border border-dark-700 flex items-center justify-center gap-2">
                <Flag className="w-4 h-4 text-warning" /> Flag Maintenance Issue
              </button>
            </Link>

            {(allDone || !job.checklist?.length) && (
              <div className="card p-4 space-y-3 border-accent/20 glow-accent">
                <p className="font-semibold text-white">Submit & Clock Out</p>
                <VideoCapture label="After Clean Video" uploadedUrl={afterVideoUrl} onUploaded={setAfterVideoUrl} />
                <textarea className="input-dark w-full resize-none" placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
                <button className="btn-primary w-full h-12 bg-success hover:bg-success-dark flex items-center justify-center gap-2" disabled={!afterVideoUrl || submitting} onClick={handleClockOut}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Submit & Clock Out
                </button>
                {!afterVideoUrl && <p className="text-xs text-center text-dark-500">Upload after video to submit</p>}
              </div>
            )}
          </>
        )}

        {/* Pre-clean */}
        {(job.status === 'assigned' || job.status === 'pending') && (
          <>
            <div className="card p-4 space-y-3">
              <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-dark-500 mt-0.5" /><p className="text-sm text-dark-300">{job.city}</p></div>
              <div className="flex gap-6 text-sm">
                {job.checkout_time && <div><p className="text-xs text-dark-500">Check-out</p><p className="font-medium text-dark-200">{job.checkout_time}</p></div>}
                {job.checkin_time && <div><p className="text-xs text-dark-500">Check-in</p><p className="font-medium text-dark-200">{job.checkin_time}</p></div>}
                {job.guest_count && <div><p className="text-xs text-dark-500">Guests</p><p className="font-medium text-dark-200">{job.guest_count}</p></div>}
              </div>
              {job.host_notes && (
                <div className="bg-warning/10 border border-warning/15 rounded-lg p-3 text-sm text-warning">
                  <p className="font-medium mb-1">Host Notes</p><p className="text-warning/80">{job.host_notes}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="bg-accent/10 border border-accent/15 rounded-xl p-3 text-sm text-accent-light">
                <p className="font-medium mb-0.5">Before you clock in</p>
                <p className="text-xs text-accent-light/60">Record a walkthrough video of the property.</p>
              </div>
              <VideoCapture label="Before Clean Video" uploadedUrl={beforeVideoUrl || job.before_video_url} onUploaded={handleBeforeVideo} />
              {gpsError && <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-sm text-danger">{gpsError}</div>}
              <button className="btn-primary w-full h-14 text-base" disabled={!(beforeVideoUrl || job.before_video_url) || clockingIn} onClick={handleClockIn}>
                {clockingIn ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Clock className="w-5 h-5 mr-2" />} Clock In
              </button>
              {!(beforeVideoUrl || job.before_video_url) && <p className="text-xs text-center text-dark-500">Record before video to enable clock-in</p>}
            </div>
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-dark-800/90 backdrop-blur-xl border-t border-dark-700/50 px-4 py-2 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-around">
          <Link to="/cleaner" className="flex flex-col items-center gap-1 py-1 text-dark-400"><Home className="w-5 h-5" /><span className="text-[10px] font-medium">Jobs</span></Link>
          <Link to="/cleaner/report" className="flex flex-col items-center gap-1 py-1 text-dark-400"><Flag className="w-5 h-5" /><span className="text-[10px] font-medium">Report</span></Link>
        </div>
      </nav>
    </div>
  );
}
