/**
 * API Service — All backend communication for LabCraft
 * Includes pre-warm, local cache, and timeout handling
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000, // 2 min for AI generation
});

// ─── Pre-warm Backend ──────────────────────────────────────
// Wakes up Render's cold-start backend silently on app load

export const preWarmBackend = () => {
  fetch(`${API_BASE}/health`, { method: 'GET', mode: 'cors' }).catch(() => {});
};

// ─── Local Cache (localStorage) ────────────────────────────
// Provides instant feel for repeated requests

const CACHE_PREFIX = 'labcraft_cache_';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in ms
const MAX_CACHE_ENTRIES = 20;

function _normalizeCacheKey(subject, topic, options = {}) {
  const s = (subject || '').trim().toLowerCase();
  const t = (topic || '').trim().toLowerCase();
  const activeOpts = Object.keys(options)
    .filter(k => options[k])
    .sort()
    .join('_');
  return `${CACHE_PREFIX}${s}_${t}_${activeOpts || 'default'}`;
}

function _evictOldestCache() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const entry = JSON.parse(localStorage.getItem(key));
          keys.push({ key, timestamp: entry?.timestamp || 0 });
        } catch { keys.push({ key, timestamp: 0 }); }
      }
    }
    // Sort oldest first, remove excess
    keys.sort((a, b) => a.timestamp - b.timestamp);
    while (keys.length >= MAX_CACHE_ENTRIES) {
      const oldest = keys.shift();
      localStorage.removeItem(oldest.key);
    }
  } catch { /* storage access error — ignore */ }
}

export const localCache = {
  get(subject, topic, options = {}) {
    try {
      const key = _normalizeCacheKey(subject, topic, options);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (Date.now() - entry.timestamp > CACHE_TTL) {
        localStorage.removeItem(key);
        return null;
      }
      return entry.data;
    } catch { return null; }
  },

  set(subject, topic, options = {}, data) {
    try {
      const key = _normalizeCacheKey(subject, topic, options);
      _evictOldestCache();
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch { /* storage full — silently fail */ }
  },

  getPPT(subject, topic) {
    try {
      const key = `${CACHE_PREFIX}ppt_${(subject || '').trim().toLowerCase()}_${(topic || '').trim().toLowerCase()}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (Date.now() - entry.timestamp > CACHE_TTL) {
        localStorage.removeItem(key);
        return null;
      }
      return entry.data;
    } catch { return null; }
  },

  setPPT(subject, topic, data) {
    try {
      const key = `${CACHE_PREFIX}ppt_${(subject || '').trim().toLowerCase()}_${(topic || '').trim().toLowerCase()}`;
      _evictOldestCache();
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch { /* storage full — silently fail */ }
  },
};

// ─── Courses ───────────────────────────────────────────────
export const getCourses = async () => {
  const { data } = await api.get('/courses');
  return data;
};

// ─── Experiment ────────────────────────────────────────────
export const generateExperiment = async (subject, experimentNo, topic, options = {}) => {
  const { data } = await api.post('/generate-experiment', {
    subject,
    experiment_no: experimentNo,
    topic,
    options,
  });
  return data;
};

export const modifySection = async (experiment, section, instruction) => {
  const { data } = await api.post('/modify-section', {
    experiment,
    section,
    instruction,
  });
  return data;
};

// ─── PPT ───────────────────────────────────────────────────
export const generatePPT = async (subject, topic, options = {}) => {
  const { data } = await api.post('/generate-ppt', { subject, topic, options });
  return data;
};

// ─── Downloads ─────────────────────────────────────────────
export const downloadExperiment = async (experiment, format) => {
  const response = await api.post('/download-experiment',
    { experiment, format },
    { responseType: 'blob' }
  );

  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  link.download = `Experiment_${experiment.experiment_no}.${ext}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const downloadPPT = async (pptData) => {
  const response = await api.post('/download-ppt',
    { ppt_data: pptData },
    { responseType: 'blob' }
  );

  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  const title = pptData.title || 'Presentation';
  link.download = `${title.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 50)}.pptx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export default api;
