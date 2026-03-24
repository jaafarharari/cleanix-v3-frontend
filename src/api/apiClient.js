import { createClient } from '@supabase/supabase-js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function getToken() { return localStorage.getItem('cleanix_access_token'); }
export function setToken(token) { localStorage.setItem('cleanix_access_token', token); }
export function clearToken() { localStorage.removeItem('cleanix_access_token'); localStorage.removeItem('cleanix_refresh_token'); }

function headers() {
  const h = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, { headers: headers(), ...options });
  const json = await res.json();
  if (!res.ok) throw { status: res.status, message: json.error || 'Request failed', data: json };
  return json;
}

const entityMap = {
  Job: '/api/jobs',
  Property: '/api/properties',
  User: '/api/users',
  MaintenanceIssue: '/api/maintenance-issues',
  CleanerAvailability: '/api/cleaner-availability',
};

function createEntityClient(entityName) {
  const basePath = entityMap[entityName];
  if (!basePath) throw new Error(`Unknown entity: ${entityName}`);
  return {
    async list(orderBy, limit) {
      const params = new URLSearchParams();
      if (orderBy) params.set('order', orderBy);
      if (limit) params.set('limit', String(limit));
      const qs = params.toString();
      return apiFetch(`${basePath}${qs ? '?' + qs : ''}`);
    },
    async filter(filters) {
      return apiFetch(`${basePath}/filter`, { method: 'POST', body: JSON.stringify(filters) });
    },
    async create(data) {
      return apiFetch(basePath, { method: 'POST', body: JSON.stringify(data) });
    },
    async update(id, data) {
      return apiFetch(`${basePath}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async delete(id) {
      return apiFetch(`${basePath}/${id}`, { method: 'DELETE' });
    },
    subscribe(callback) {
      let lastData = null;
      const poll = async () => {
        try {
          const data = await apiFetch(basePath);
          if (lastData !== null) {
            const oldIds = new Set(lastData.map(r => r.id));
            const newIds = new Set(data.map(r => r.id));
            for (const record of data) {
              if (!oldIds.has(record.id)) callback({ type: 'create', id: record.id, data: record });
              else { const old = lastData.find(r => r.id === record.id); if (JSON.stringify(old) !== JSON.stringify(record)) callback({ type: 'update', id: record.id, data: record }); }
            }
            for (const old of lastData) { if (!newIds.has(old.id)) callback({ type: 'delete', id: old.id }); }
          }
          lastData = data;
        } catch (e) { console.error('Poll error:', e); }
      };
      poll();
      const interval = setInterval(poll, 10000);
      return () => clearInterval(interval);
    },
  };
}

const entitiesProxy = new Proxy({}, { get(_, name) { return createEntityClient(name); } });

const auth = {
  async me() { return apiFetch('/api/auth/me'); },
  logout() { clearToken(); window.location.href = '/login'; },
};

const users = {
  async inviteUser(email, role, full_name) {
    return apiFetch('/api/auth/invite', { method: 'POST', body: JSON.stringify({ email, role, full_name }) });
  },
};

const pms = {
  async uplisting(apiKey, path, method = 'GET', body = null) {
    const result = await apiFetch('/api/pms/uplisting', { method: 'POST', body: JSON.stringify({ apiKey, path, method, body }) });
    return result.data;
  },
  async smoobu(apiKey, path, method = 'GET', body = null) {
    const result = await apiFetch('/api/pms/smoobu', { method: 'POST', body: JSON.stringify({ apiKey, path, method, body }) });
    return result.data;
  },
};

const functions = {
  async invoke(name, payload) {
    if (name === 'uplistingProxy') {
      const result = await apiFetch('/api/pms/uplisting', { method: 'POST', body: JSON.stringify(payload) });
      return { data: result };
    }
    throw new Error(`Unknown function: ${name}`);
  },
};

const integrations = {
  Core: {
    async UploadFile({ file }) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_URL}/api/upload`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      return json;
    },
  },
};

const notifications = {
  async getVapidKey() { return apiFetch('/api/notifications/vapid-key'); },
  async subscribe(subscription) { return apiFetch('/api/notifications/subscribe', { method: 'POST', body: JSON.stringify({ subscription }) }); },
  async unsubscribe() { return apiFetch('/api/notifications/unsubscribe', { method: 'POST' }); },
  async send(emails, title, body, url) { return apiFetch('/api/notifications/send', { method: 'POST', body: JSON.stringify({ emails, title, body, url }) }); },
};

const api = { entities: entitiesProxy, auth, users, pms, functions, integrations, notifications };
export default api;
