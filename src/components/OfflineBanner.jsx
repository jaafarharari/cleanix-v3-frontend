import { useState, useEffect } from 'react';
import { WifiOff, Wifi, Loader2 } from 'lucide-react';
import { isOnline, onNetworkChange } from '@/lib/offlineStore';
import api from '@/api/apiClient';

export default function OfflineBanner() {
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const unsub = onNetworkChange(async (status) => {
      setOnline(status);
      if (status) {
        setJustReconnected(true);
        setSyncing(true);
        await api.syncOfflineQueue();
        setSyncing(false);
        setTimeout(() => setJustReconnected(false), 3000);
      }
    });
    return unsub;
  }, []);

  if (online && !justReconnected) return null;

  if (online && justReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-success/90 text-white text-center py-2 text-sm font-medium flex items-center justify-center gap-2 animate-slide-up">
        {syncing ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Syncing offline changes...</>
        ) : (
          <><Wifi className="w-4 h-4" /> Back online — all changes synced</>
        )}
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning/90 text-white text-center py-2 text-sm font-medium flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4" /> You're offline — changes will sync when reconnected
    </div>
  );
}
