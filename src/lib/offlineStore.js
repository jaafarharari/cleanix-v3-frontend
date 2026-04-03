/**
 * offlineStore.js
 * 
 * Caches API data locally so the app works without internet.
 * When online, syncs pending changes back to the server.
 * 
 * Uses localStorage as the storage backend (works in both
 * web and Capacitor). For Capacitor, you could swap this
 * to @capacitor/preferences for native storage.
 */

const CACHE_PREFIX = 'cleanops_cache_';
const QUEUE_KEY = 'cleanops_sync_queue';

// ── Cache management ───────────────────────────────────────

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    return { data, timestamp };
  } catch {
    return null;
  }
}

export function cacheSet(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch (e) {
    console.warn('Cache write failed:', e);
  }
}

export function cacheClear(key) {
  localStorage.removeItem(CACHE_PREFIX + key);
}

// ── Offline queue ──────────────────────────────────────────
// Stores pending mutations (create, update, delete) to sync later

export function getQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToQueue(action) {
  const queue = getQueue();
  queue.push({
    ...action,
    id: Date.now() + '_' + Math.random().toString(36).slice(2),
    queued_at: new Date().toISOString(),
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function removeFromQueue(actionId) {
  const queue = getQueue().filter(a => a.id !== actionId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

// ── Network status ─────────────────────────────────────────

export function isOnline() {
  return navigator.onLine;
}

export function onNetworkChange(callback) {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
  return () => {
    window.removeEventListener('online', () => callback(true));
    window.removeEventListener('offline', () => callback(false));
  };
}
