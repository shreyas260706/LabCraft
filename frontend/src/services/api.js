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
  remove(subject, topic, options = {}) {
    try {
      localStorage.removeItem(_normalizeCacheKey(subject, topic, options));
    } catch { /* ignore */ }
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
  removePPT(subject, topic) {
    try {
      localStorage.removeItem(`${CACHE_PREFIX}ppt_${(subject || '').trim().toLowerCase()}_${(topic || '').trim().toLowerCase()}`);
    } catch { /* ignore */ }
  },
};

// ─── Courses ───────────────────────────────────────────────
export const getCourses = async () => {
  const { data } = await api.get('/courses');
  return data;
};

// ─── Experiment ────────────────────────────────────────────
export const generateExperiment = async (subject, experimentNo, topic, options = {}, forceRefresh = false, studentDetails = null) => {
  const { data } = await api.post('/generate-experiment', {
    subject,
    experiment_no: experimentNo,
    topic,
    options,
    force_refresh: forceRefresh,
    student_details: studentDetails,
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
export const generatePPT = async (subject, topic, options = {}, forceRefresh = false, studentDetails = null) => {
  const { data } = await api.post('/generate-ppt', { 
    subject, 
    topic, 
    options,
    force_refresh: forceRefresh,
    student_details: studentDetails,
  });
  return data;
};

// ─── Downloads ─────────────────────────────────────────────
export const downloadExperiment = async (experiment, format, studentDetails = null) => {
  const response = await api.post('/download-experiment',
    { experiment, format, student_details: studentDetails },
    { responseType: 'blob' }
  );

  // Detect if server returned a JSON error inside the blob
  const blob = response.data;
  if (blob.type && blob.type.includes('application/json')) {
    const text = await blob.text();
    try {
      const errData = JSON.parse(text);
      throw new Error(errData.error || errData.message || 'Server returned an error');
    } catch (e) {
      if (e.message !== 'Server returned an error' && e instanceof SyntaxError) {
        throw new Error('Download failed: unexpected response from server');
      }
      throw e;
    }
  }

  // Validate blob is not empty
  if (!blob || blob.size === 0) {
    throw new Error('Download failed: received empty file');
  }

  // Extract filename from Content-Disposition header if available
  const ext = format === 'pdf' ? 'pdf' : 'docx';
  let filename = `Experiment_${experiment.experiment_no}.${ext}`;
  const disposition = response.headers?.['content-disposition'];
  if (disposition) {
    const match = disposition.match(/filename[^;=\n]*=(['"]?)([^'";\n]*)\1/);
    if (match && match[2]) filename = match[2];
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
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
