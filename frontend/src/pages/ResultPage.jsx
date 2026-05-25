/**
 * ResultPage — Displays generated experiment or PPT with section editing and downloads
 * Includes premium loading experience, local cache, timeout/retry UX, and polished display
 */
import { useState, useEffect, useRef } from 'react';
import {
  generateExperiment,
  generatePPT,
  modifySection,
  downloadExperiment,
  downloadPPT,
  localCache,
} from '../services/api';
import GenerationLoadingView from '../components/GenerationLoadingView';

// ─── Section config ──────────────────────────────────────
const SECTIONS = [
  { key: 'aim', title: 'AIM', icon: '🎯', placeholder: 'e.g. Make it more specific' },
  { key: 'theory', title: 'THEORY', icon: '📖', placeholder: 'e.g. Make it shorter / more detailed' },
  { key: 'source_code', title: 'SOURCE CODE', icon: '💻', placeholder: 'e.g. Add comments / Use Python instead' },
  { key: 'viva', title: 'VIVA VOCE', icon: '❓', placeholder: 'e.g. Add 3 more questions' },
  { key: 'output', title: 'OUTPUT', icon: '📤', placeholder: 'e.g. Show more test cases' },
];

// Timeout thresholds
const SLOW_THRESHOLD_MS = 30000;  // 30s — show "taking longer" warning
const RETRY_THRESHOLD_MS = 90000; // 90s — show retry button

function ResultPage({ config, experimentData, setExperimentData, pptData, setPptData, onBack, onSaveHistory }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modifyingSection, setModifyingSection] = useState(null);
  const [modifyInputs, setModifyInputs] = useState({});
  const [openModify, setOpenModify] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [toast, setToast] = useState(null);

  // Loading UX state
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isSlow, setIsSlow] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  const isExperiment = config.mode === 'experiment';

  // Generate on mount (with local cache check)
  useEffect(() => {
    if (isExperiment && !experimentData) {
      // Check local cache first
      const cached = localCache.get(config.subject, config.topic, config.options || {});
      if (cached) {
        // Instantly show cached content
        const cacheResult = {
          ...cached,
          experiment_no: config.experimentNo,
          subject: config.subject,
          topic: config.topic,
        };
        setExperimentData(cacheResult);
        onSaveHistory?.(config, cacheResult);
        // Silently refresh in background
        handleGenerate(true);
      } else {
        handleGenerate();
      }
    } else if (!isExperiment && !pptData) {
      const cached = localCache.getPPT(config.subject, config.topic);
      if (cached) {
        setPptData(cached);
        onSaveHistory?.(config, cached);
        handleGenerate(true);
      } else {
        handleGenerate();
      }
    }
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (loading) {
      setElapsedMs(0);
      setIsSlow(false);
      setShowRetry(false);
      timerRef.current = setInterval(() => {
        setElapsedMs(prev => {
          const next = prev + 200;
          if (next >= SLOW_THRESHOLD_MS) setIsSlow(true);
          if (next >= RETRY_THRESHOLD_MS) setShowRetry(true);
          return next;
        });
      }, 200);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedMs(0);
      setIsSlow(false);
      setShowRetry(false);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleGenerate = async (isBackgroundRefresh = false, forceRefresh = false) => {
    if (!isBackgroundRefresh) {
      setLoading(true);
      setError(null);
    }

    if (forceRefresh) {
      if (isExperiment) {
        localCache.remove(config.subject, config.topic, config.options || {});
      } else {
        localCache.removePPT(config.subject, config.topic);
      }
    }

    try {
      if (isExperiment) {
        const data = await generateExperiment(config.subject, config.experimentNo, config.topic, config.options || {}, forceRefresh);
        setExperimentData(data);
        // Save to local cache
        localCache.set(config.subject, config.topic, config.options || {}, data);
        if (!isBackgroundRefresh) onSaveHistory?.(config, data);
      } else {
        const data = await generatePPT(config.subject, config.topic, config.options || {}, forceRefresh);
        setPptData(data);
        localCache.setPPT(config.subject, config.topic, data);
        if (!isBackgroundRefresh) onSaveHistory?.(config, data);
      }
    } catch (err) {
      if (!isBackgroundRefresh) {
        const msg = err.response?.data?.error || err.message || 'Generation failed';
        setError(msg);
      }
    } finally {
      if (!isBackgroundRefresh) setLoading(false);
    }
  };

  const handleModifySection = async (sectionKey) => {
    const instruction = modifyInputs[sectionKey]?.trim();
    if (!instruction || !experimentData) return;

    setModifyingSection(sectionKey);
    try {
      const result = await modifySection(experimentData, sectionKey, instruction);
      // Update ONLY the modified section
      setExperimentData(prev => ({
        ...prev,
        [sectionKey]: result.content,
      }));
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
        await downloadExperiment(experimentData, format);
      } else {
        await downloadPPT(pptData);
      }
      showToast(`Downloaded as ${format.toUpperCase()}`, 'success');
    } catch (err) {
      // Extract the most specific error message available
      let msg = 'Download failed';
      if (err.message) {
        msg = err.message;
      } else if (err.response?.data) {
        // If the error response has data (could be blob or JSON)
        try {
          const text = typeof err.response.data === 'string'
            ? err.response.data
            : await err.response.data?.text?.();
          if (text) {
            const parsed = JSON.parse(text);
            msg = parsed.error || parsed.message || msg;
          }
        } catch {
          // Fallback — just use the status text
          msg = err.response?.statusText || msg;
        }
      }
      showToast(msg, 'error');
    } finally {
      setDownloading(null);
    }
  };

  // Strip markdown code fences for display
  const formatCode = (code) => {
    if (!code) return '';
    let c = code.trim();
    if (c.startsWith('```')) {
      const lines = c.split('\n');
      lines.shift();
      if (lines.length && lines[lines.length - 1].trim() === '```') lines.pop();
      c = lines.join('\n');
    }
    
    // Detect if code is received as a single long line and reformat
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

  // ─── Loading State ──────────────────────────────────────
  if (loading && !experimentData && !pptData) {
    return (
      <div className="result-page">
        <div className="result-header" style={{ maxWidth: 900, margin: '0 auto' }}>
          <button className="back-button" onClick={onBack}>← Back to Home</button>
          <div className="result-meta">
            <h2>{isExperiment ? `Experiment ${config.experimentNo}` : config.topic}</h2>
            <p>{config.subject} • {config.course}</p>
          </div>
        </div>

        <GenerationLoadingView
          isExperiment={isExperiment}
          elapsedMs={elapsedMs}
          isSlow={isSlow}
        />

        {showRetry && (
          <div className="gen-retry-bar">
            <span>This is taking longer than expected.</span>
            <button className="btn btn-ghost btn-sm" onClick={() => handleGenerate(false, true)}>
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────
  if (error && !experimentData && !pptData) {
    return (
      <div className="result-page">
        <div className="result-header" style={{ maxWidth: 900, margin: '0 auto' }}>
          <button className="back-button" onClick={onBack}>← Back</button>
        </div>
        <div className="error-state-card">
          <div className="error-state-icon">⚠️</div>
          <h3 className="error-state-title">Generation Failed</h3>
          <p className="error-state-message">{error}</p>
          <div className="error-state-actions">
            <button className="btn btn-primary btn-sm" onClick={() => handleGenerate(false, true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Try Again
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onBack}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Experiment View ────────────────────────────────────
  if (isExperiment && experimentData) {
    return (
      <div className="result-page">
        {/* Header */}
        <div className="result-header">
          <button className="back-button" onClick={onBack}>← Back to Home</button>
          <div className="result-meta">
            <h2>Experiment {experimentData.experiment_no}</h2>
            <p>{config.subject} • {config.course}</p>
          </div>
        </div>

        {error && (
          <div className="error-banner" style={{ maxWidth: 900, margin: '0 auto 16px' }}>
            <span>⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {/* Sections */}
        <div className="experiment-content">
          {SECTIONS.map((sec) => (
            <div className="section-card" key={sec.key}>
              {/* Header */}
              <div className="section-header" onClick={() => setOpenModify(openModify === sec.key ? null : sec.key)}>
                <div className="section-title-group">
                  <span className="section-icon">{sec.icon}</span>
                  <span className="section-title">{sec.title}</span>
                </div>
                <div className="section-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenModify(openModify === sec.key ? null : sec.key);
                    }}
                  >
                    Modify
                  </button>
                </div>
              </div>

              {/* Body */}
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
                          <div className="viva-question">
                            <span className="viva-q-num">Q{i + 1}</span>
                            <span>{qa.question}</span>
                          </div>
                          <div className="viva-answer">
                            <span className="viva-a-label">A:</span>
                            <span>{qa.answer}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : sec.key === 'output' ? (
                    <div className="code-block output-block">
                      <span className="code-lang-badge">Output</span>
                      <pre>{experimentData.output}</pre>
                    </div>
                  ) : (
                    <div className="section-text">
                      {experimentData[sec.key]}
                    </div>
                  )}
                </div>
              )}

              {/* Modify bar */}
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
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleModifySection(sec.key)}
                    disabled={!modifyInputs[sec.key]?.trim() || modifyingSection === sec.key}
                  >
                    {modifyingSection === sec.key ? '...' : 'Apply'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Download Bar */}
        <div className="download-bar">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleDownload('pdf')}
            disabled={downloading}
          >
            {downloading === 'pdf' ? 'Downloading...' : 'Download PDF'}
          </button>
          <button
            className="btn btn-accent btn-sm"
            onClick={() => handleDownload('docx')}
            disabled={downloading}
          >
            {downloading === 'docx' ? 'Downloading...' : 'Download DOCX'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => handleGenerate()}
            disabled={loading}
          >
            Regenerate
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`toast ${toast.type}`}>{toast.message}</div>
        )}
      </div>
    );
  }

  // ─── PPT View ───────────────────────────────────────────
  if (!isExperiment && pptData) {
    return (
      <div className="result-page">
        <div className="result-header">
          <button className="back-button" onClick={onBack}>← Back to Home</button>
          <div className="result-meta">
            <h2>{pptData.title}</h2>
            <p>{config.subject} • {pptData.slides?.length || 0} slides</p>
          </div>
        </div>

        <div className="ppt-content">
          <div className="slides-grid">
            {(pptData.slides || []).map((slide, i) => (
              <div className="slide-card" key={i} style={{ animationDelay: `${i * 60}ms` }}>
                <div className="slide-number">Slide {i + 1}</div>
                <div className="slide-heading">{slide.heading}</div>
                <ul className="slide-points">
                  {(slide.points || []).map((point, j) => (
                    <li key={j}>{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="download-bar">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleDownload('pptx')}
            disabled={downloading}
          >
            {downloading === 'pptx' ? 'Downloading...' : 'Download PPTX'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => handleGenerate()}
            disabled={loading}
          >
            Regenerate
          </button>
        </div>

        {toast && (
          <div className={`toast ${toast.type}`}>{toast.message}</div>
        )}
      </div>
    );
  }

  return null;
}

export default ResultPage;
