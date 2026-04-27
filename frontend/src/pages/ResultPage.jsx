/**
 * ResultPage — Displays generated experiment or PPT with section editing and downloads
 */
import { useState, useEffect } from 'react';
import {
  generateExperiment,
  generatePPT,
  modifySection,
  downloadExperiment,
  downloadPPT,
} from '../services/api';

// ─── Section config ──────────────────────────────────────
const SECTIONS = [
  { key: 'aim', title: 'AIM', icon: '🎯', placeholder: 'e.g. Make it more specific' },
  { key: 'theory', title: 'THEORY', icon: '📖', placeholder: 'e.g. Make it shorter / more detailed' },
  { key: 'source_code', title: 'SOURCE CODE', icon: '💻', placeholder: 'e.g. Add comments / Use Python instead' },
  { key: 'viva', title: 'VIVA VOCE', icon: '❓', placeholder: 'e.g. Add 3 more questions' },
  { key: 'output', title: 'OUTPUT', icon: '📤', placeholder: 'e.g. Show more test cases' },
];

function ResultPage({ config, experimentData, setExperimentData, pptData, setPptData, onBack, onSaveHistory }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modifyingSection, setModifyingSection] = useState(null);
  const [modifyInputs, setModifyInputs] = useState({});
  const [openModify, setOpenModify] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [toast, setToast] = useState(null);

  const isExperiment = config.mode === 'experiment';

  // Generate on mount
  useEffect(() => {
    if (isExperiment && !experimentData) {
      handleGenerate();
    } else if (!isExperiment && !pptData) {
      handleGenerate();
    }
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isExperiment) {
        const data = await generateExperiment(config.subject, config.experimentNo, config.topic, config.options || {});
        setExperimentData(data);
        onSaveHistory?.(config, data);
      } else {
        const data = await generatePPT(config.subject, config.topic, config.options || {});
        setPptData(data);
        onSaveHistory?.(config, data);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Generation failed';
      setError(msg);
    } finally {
      setLoading(false);
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
      showToast(`Downloaded as ${format.toUpperCase()}`);
    } catch (err) {
      showToast('Download failed', 'error');
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
  if (loading) {
    return (
      <div className="result-page">
        <div className="loading-overlay">
          <div className="spinner"></div>
          <div className="loading-text">
            {isExperiment ? '🧪 Generating Experiment...' : '📊 Generating Presentation...'}
          </div>
          <div className="loading-subtext">
            This may take 10-20 seconds. Crafting your content.
          </div>
        </div>
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
        <div className="error-banner" style={{ maxWidth: 900, margin: '0 auto' }}>
          <span>⚠️</span>
          <span>{error}</span>
          <button onClick={handleGenerate}>Retry</button>
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
                      <pre>{formatCode(experimentData.source_code)}</pre>
                    </div>
                  ) : sec.key === 'viva' ? (
                    <div className="viva-list">
                      {(experimentData.viva || []).map((qa, i) => (
                        <div key={i} className="viva-item" style={{ marginBottom: '16px' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#e0e0e0' }}>
                            Q{i + 1}: {qa.question}
                          </div>
                          <div style={{ color: '#a0a0a0' }}>
                            A: {qa.answer}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : sec.key === 'output' ? (
                    <div className="code-block">
                      <span className="code-lang-badge">Output</span>
                      <pre>{experimentData.output}</pre>
                    </div>
                  ) : (
                    <div className="section-text">{experimentData[sec.key]}</div>
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
            onClick={handleGenerate}
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
            onClick={handleGenerate}
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
