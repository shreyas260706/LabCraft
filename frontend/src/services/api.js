/**
 * API Service — All backend communication for LabCraft
 */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000, // 2 min for AI generation
});

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
