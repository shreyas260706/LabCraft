import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  generateExperiment,
  generatePPT,
  modifySection,
  downloadExperiment,
  downloadPPT,
} from '../services/api';
import RegenerationOverlay from '../components/RegenerationOverlay';
import { useSEO } from '../hooks/useSEO';

const SECTIONS = [
  { key: 'aim', title: 'AIM', icon: '🎯', placeholder: 'e.g. Make it more specific' },
  { key: 'theory', title: 'THEORY', icon: '📖', placeholder: 'e.g. Make it shorter / more detailed' },
  { key: 'source_code', title: 'SOURCE CODE', icon: '💻', placeholder: 'e.g. Add comments / Use Python instead' },
  { key: 'viva', title: 'VIVA VOCE', icon: '❓', placeholder: 'e.g. Add 3 more questions' },
  { key: 'output', title: 'OUTPUT', icon: '📤', placeholder: 'e.g. Show more test cases' },
];

const HISTORY_KEY = 'labcraft_history';
const MAX_HISTORY = 10;

function ResultViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [entry, setEntry] = useState(null);
  const [config, setConfig] = useState(null);
  const [experimentData, setExperimentData] = useState(null);
  const [pptData, setPptData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modifyingSection, setModifyingSection] = useState(null);
  const [modifyInputs, setModifyInputs] = useState({});
  const [openModify, setOpenModify] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [toast, setToast] = useState(null);

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenSuccess, setRegenSuccess] = useState(false);
  const [contentFadeIn, setContentFadeIn] = useState(false);

  const isExperiment = config?.mode === 'experiment';

  const handleBack = () => {
    if (window.history.length > 2) {
      // If they navigated here from within the app, native back works best 
      // (preserves the exact page they came from, including scroll position)
      navigate(-1);
    } else if (config?.mode === 'experiment') {
      navigate('/lab-generator');
    } else if (config?.mode === 'ppt') {
      navigate('/ppt-generator');
    } else {
      navigate('/');
    }
  };

  useSEO({
    title: config ? `${isExperiment ? 'Experiment' : 'PPT'} Result | LabCraft` : 'Result | LabCraft',
    description: 'View and edit your generated lab document.',
    url: `/result/${id}`,
  });

  // Load data from history based on ID
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        const history = JSON.parse(stored);
        const match = history.find(h => String(h.id) === String(id));
        if (match) {
          setEntry(match);

          // Reconstruct config from entry fields if config wasn't saved (older entries)
          const resolvedConfig = match.config || {
            subject: match.subject,
            topic: match.topic,
            experimentNo: match.experimentNo,
            course: match.course,
            mode: match.mode,
            options: {},
            studentDetails: null,
          };
          setConfig(resolvedConfig);

          const mode = resolvedConfig.mode || match.mode;
          if (mode === 'experiment') {
            setExperimentData(match.data);
            setPptData(null);
          } else {
            setPptData(match.data);
            setExperimentData(null);
          }
          setLoading(false);
          return;
        }
      }
    } catch {}

    // Not found
    setError('Result not found or has been deleted.');
    setLoading(false);
  }, [id]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleGenerate = async () => {
    if (!config) return;

    setIsRegenerating(true);
    setRegenSuccess(false);
    setError(null);

    try {
      let data;
      if (isExperiment) {
        data = await generateExperiment(
          config.subject,
          config.experimentNo,
          config.topic,
          config.options || {},
          true,
          config.studentDetails || null
        );
      } else {
        data = await generatePPT(
          config.subject,
          config.topic,
          config.options || {},
          true,
          config.studentDetails || null
        );
      }

      setRegenSuccess(true);
      showToast('Fresh variation generated ✨', 'success');

      // Create a NEW history entry to allow browser BACK functionality
      const entryId = Date.now().toString();
      const newEntry = {
        id: entryId,
        subject: config.subject,
        topic: config.topic,
        experimentNo: config.experimentNo,
        course: config.course,
        mode: config.mode,
        timestamp: new Date().toISOString(),
        config,
        data,
      };

      try {
        const stored = localStorage.getItem(HISTORY_KEY);
        const history = stored ? JSON.parse(stored) : [];
        const filtered = history.filter(h => !(h.subject === newEntry.subject && h.topic === newEntry.topic && h.mode === newEntry.mode));
        const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } catch {}

      setTimeout(() => {
        setIsRegenerating(false);
        setRegenSuccess(false);
        setContentFadeIn(true);
        // Navigate to new URL (push to history stack)
        navigate(`/result/${entryId}`);
        setTimeout(() => setContentFadeIn(false), 600);
      }, 800);

    } catch (err) {
      setIsRegenerating(false);
      setRegenSuccess(false);
      const msg = err.response?.data?.error || err.message || 'Regeneration failed';
      showToast(msg, 'error');
    }
  };

  const updateCurrentHistoryData = (newData) => {
    if (!entry) return;
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        const history = JSON.parse(stored);
        const idx = history.findIndex(h => h.id === entry.id);
        if (idx !== -1) {
          history[idx].data = newData;
          localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
          setEntry(history[idx]);
        }
      }
    } catch {}
  };

  const handleModifySection = async (sectionKey) => {
    const instruction = modifyInputs[sectionKey]?.trim();
    if (!instruction || !experimentData) return;

    setModifyingSection(sectionKey);
    try {
      const result = await modifySection(experimentData, sectionKey, instruction);
      const newData = { ...experimentData, [sectionKey]: result.content };
      setExperimentData(newData);
      updateCurrentHistoryData(newData);
      
      setModifyInputs(prev => ({ ...prev, [sectionKey]: '' }));
      setOpenModify(null);
      showToast(`${sectionKey.replace('_', ' ').toUpperCase()} updated successfully`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Modification failed';
      showToast(msg, 'error');
    } finally {
      setModifyingSection(null);
    }
  };

  const handleDownload = async (format) => {
    setDownloading(format);
    try {
      if (isExperiment) {
        await downloadExperiment(experimentData, format, config.studentDetails || null);
      } else {
        await downloadPPT(pptData);
      }
      showToast(`Downloaded as ${format.toUpperCase()}`, 'success');
    } catch (err) {
      let msg = 'Download failed';
      if (err.message) {
        msg = err.message;
      } else if (err.response?.data) {
        try {
          const text = typeof err.response.data === 'string'
            ? err.response.data
            : await err.response.data?.text?.();
          if (text) {
            const parsed = JSON.parse(text);
            msg = parsed.error || parsed.message || msg;
          }
        } catch {
          msg = err.response?.statusText || msg;
        }
      }
      showToast(msg, 'error');
    } finally {
      setDownloading(null);
    }
  };

  const formatCode = (code) => {
    if (!code) return '';
    let c = code.trim();
    if (c.startsWith('```')) {
      const lines = c.split('\n');
      lines.shift();
      if (lines.length && lines[lines.length - 1].trim() === '```') lines.pop();
      c = lines.join('\n');
    }
    if (!c.includes('\n') && (c.includes(';') || c.includes('{'))) {
      c = c.replaceAll(';', ';\n').replaceAll('{', '{\n').replaceAll('}', '\n}');
    }
    return c;
  };

  const detectLang = (code) => {
    if (!code) return '';
    const first = code.trim().split('\n')[0];
    if (first.startsWith('```')) {
      const lang = first.replace('```', '').trim();
      if (lang) return lang;
    }
    if (code.includes('#include')) return 'C/C++';
    if (code.includes('def ') || code.includes('import ')) return 'Python';
    if (code.includes('public class') || code.includes('System.out')) return 'Java';
    if (code.includes('SELECT') || code.includes('CREATE TABLE')) return 'SQL';
    return 'Code';
  };

  if (loading) {
    return <div className="result-page"><div className="loading-overlay"><div className="spinner"></div></div></div>;
  }

  if (error) {
    return (
      <div className="result-page">
        <div className="result-header" style={{ maxWidth: 900, margin: '0 auto' }}>
          <button className="back-button" onClick={handleBack}>← Back</button>
        </div>
        <div className="error-state-card">
          <div className="error-state-icon">⚠️</div>
          <h3 className="error-state-title">Not Found</h3>
          <p className="error-state-message">{error}</p>
          <div className="error-state-actions">
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/')}>Go to Home</button>
          </div>
        </div>
      </div>
    );
  }

  if (isExperiment && experimentData) {
    return (
      <div className="result-page" style={{ position: 'relative' }}>
        {isRegenerating && <RegenerationOverlay isExperiment={true} success={regenSuccess} />}

        <div className="result-header">
          <button className="back-button" onClick={handleBack}>← Back</button>
          <div className="result-meta">
            <h2>Experiment {experimentData.experiment_no || config.experimentNo}</h2>
            <p>{config.subject} • {config.course}</p>
          </div>
        </div>

        <div className={`experiment-content${contentFadeIn ? ' regen-content-reveal' : ''}`}>
          {SECTIONS.map((sec) => {
            // Only show sections that actually have content
            if (sec.key !== 'aim' && !experimentData[sec.key] && (!experimentData.viva || experimentData.viva.length === 0)) return null;

            return (
              <div className="section-card" key={sec.key}>
                <div className="section-header" onClick={() => setOpenModify(openModify === sec.key ? null : sec.key)}>
                  <div className="section-title-group">
                    <span className="section-icon">{sec.icon}</span>
                    <span className="section-title">{sec.title}</span>
                  </div>
                  <div className="section-actions">
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setOpenModify(openModify === sec.key ? null : sec.key); }}>
                      Modify
                    </button>
                  </div>
                </div>

                {modifyingSection === sec.key ? (
                  <div className="section-loading">
                    <div className="section-spinner"></div>
                    <span>Regenerating {sec.title.toLowerCase()}...</span>
                  </div>
                ) : (
                  <div className="section-body">
                    {sec.key === 'source_code' ? (
                      <div className="code-block">
                        <span className="code-lang-badge">{detectLang(experimentData.source_code)}</span>
                        <pre><code>{formatCode(experimentData.source_code)}</code></pre>
                      </div>
                    ) : sec.key === 'viva' ? (
                      <div className="viva-list">
                        {(experimentData.viva || []).map((qa, i) => (
                          <div key={i} className="viva-item">
                            <div className="viva-question"><span className="viva-q-num">Q{i + 1}</span><span>{qa.question}</span></div>
                            <div className="viva-answer"><span className="viva-a-label">A:</span><span>{qa.answer}</span></div>
                          </div>
                        ))}
                      </div>
                    ) : sec.key === 'output' ? (
                      <div className="code-block output-block">
                        <span className="code-lang-badge">Output</span>
                        <pre>{experimentData.output}</pre>
                      </div>
                    ) : (
                      <div className="section-text">{experimentData[sec.key]}</div>
                    )}
                  </div>
                )}

                {openModify === sec.key && (
                  <div className="modify-bar">
                    <input
                      className="modify-input"
                      placeholder={sec.placeholder}
                      value={modifyInputs[sec.key] || ''}
                      onChange={(e) => setModifyInputs(prev => ({ ...prev, [sec.key]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleModifySection(sec.key)}
                      disabled={modifyingSection === sec.key}
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => handleModifySection(sec.key)} disabled={!modifyInputs[sec.key]?.trim() || modifyingSection === sec.key}>
                      {modifyingSection === sec.key ? '...' : 'Apply'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="download-bar">
          <button className="btn btn-primary btn-sm" onClick={() => handleDownload('pdf')} disabled={downloading || isRegenerating}>
            {downloading === 'pdf' ? 'Downloading...' : 'Download PDF'}
          </button>
          <button className="btn btn-accent btn-sm" onClick={() => handleDownload('docx')} disabled={downloading || isRegenerating}>
            {downloading === 'docx' ? 'Downloading...' : 'Download DOCX'}
          </button>
          <button className={`btn btn-regenerate btn-sm${isRegenerating ? ' is-spinning' : ''}`} onClick={handleGenerate} disabled={isRegenerating}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>

        {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
      </div>
    );
  }

  if (!isExperiment && pptData) {
    return (
      <div className="result-page" style={{ position: 'relative' }}>
        {isRegenerating && <RegenerationOverlay isExperiment={false} success={regenSuccess} />}

        <div className="result-header">
          <button className="back-button" onClick={handleBack}>← Back</button>
          <div className="result-meta">
            <h2>{pptData.title}</h2>
            <p>{config.subject} • {pptData.slides?.length || 0} slides</p>
          </div>
        </div>

        <div className={`ppt-content${contentFadeIn ? ' regen-content-reveal' : ''}`}>
          <div className="slides-grid">
            {(pptData.slides || []).map((slide, i) => (
              <div className="slide-card" key={i} style={{ animationDelay: `${i * 60}ms` }}>
                <div className="slide-number">Slide {i + 1}</div>
                <div className="slide-heading">{slide.heading}</div>
                <ul className="slide-points">
                  {(slide.points || []).map((point, j) => <li key={j}>{point}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="download-bar">
          <button className="btn btn-primary btn-sm" onClick={() => handleDownload('pptx')} disabled={downloading || isRegenerating}>
            {downloading === 'pptx' ? 'Downloading...' : 'Download PPTX'}
          </button>
          <button className={`btn btn-regenerate btn-sm${isRegenerating ? ' is-spinning' : ''}`} onClick={handleGenerate} disabled={isRegenerating}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {isRegenerating ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>

        {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
      </div>
    );
  }

  return null;
}

export default ResultViewPage;
