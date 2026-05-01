/**
 * HomePage — Premium hero section + Generator card + History
 */
import { useState, useEffect } from 'react';
import { getCourses } from '../services/api';

function HomePage({ onGenerate, history = [], onLoadHistory, onClearHistory }) {
  const [coursesData, setCoursesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Time-ago formatter
  const timeAgo = (isoStr) => {
    const diff = Date.now() - new Date(isoStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  // Form state
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [mode, setMode] = useState(''); // 'experiment' or 'ppt'
  const [experimentNo, setExperimentNo] = useState('');
  const [topic, setTopic] = useState('');

  // Generation options (toggles)
  const [options, setOptions] = useState({
    detailed_theory: false,
    extra_viva: false,
    code_explanation: false,
    compact: false,
    include_theory: true,
    include_code: true,
    include_viva: true,
    include_output: true,
  });
  const [activePreset, setActivePreset] = useState(null);

  // Derived data
  const course = coursesData?.courses?.find(c => c.name === selectedCourse);
  const branches = course?.branches || [];
  const semesters = course?.semesters || [];
  const semester = semesters.find(s => String(s.number) === selectedSemester);
  const subjects = semester?.subjects || [];

  // Compute which step is active
  const step = selectedSubject ? (mode ? 3 : 2) : (selectedCourse ? 1 : 0);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCourses();
      setCoursesData(data);
    } catch (err) {
      setError('Failed to load courses. Make sure the backend is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  // Reset downstream selections when upstream changes
  const handleCourseChange = (val) => {
    setSelectedCourse(val);
    setSelectedBranch('');
    setSelectedSemester('');
    setSelectedSubject('');
    setMode('');
    setTopic('');
  };

  const handleBranchChange = (val) => {
    setSelectedBranch(val);
    setSelectedSemester('');
    setSelectedSubject('');
    setMode('');
    setTopic('');
  };

  const handleSemesterChange = (val) => {
    setSelectedSemester(val);
    setSelectedSubject('');
    setMode('');
    setTopic('');
  };

  const handleSubjectChange = (val) => {
    setSelectedSubject(val);
    setMode('');
    setTopic('');
  };

  const canGenerate = selectedSubject && mode && topic.trim() &&
    (mode === 'ppt' || (mode === 'experiment' && experimentNo));

  const handleSubmit = () => {
    if (!canGenerate) return;
    onGenerate({
      course: selectedCourse,
      semester: selectedSemester,
      subject: selectedSubject,
      mode,
      experimentNo: mode === 'experiment' ? parseInt(experimentNo) : null,
      topic: topic.trim(),
      options: mode === 'experiment' ? { ...options } : {},
    });
  };

  // Scroll to generator
  const scrollToGenerator = () => {
    const el = document.getElementById('generator-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Dependency map: section toggle → enhancement toggle(s) it controls
  const DEPENDENCY_MAP = {
    include_theory: ['detailed_theory'],
    include_viva: ['extra_viva'],
    include_code: ['code_explanation'],
    include_output: ['compact'],
  };

  const toggleOption = (key) => {
    setActivePreset(null); // manual change clears preset selection
    setOptions(prev => {
      const newVal = !prev[key];
      const next = { ...prev, [key]: newVal };

      // If turning OFF a section toggle, also turn OFF all its dependent enhancements
      if (!newVal && DEPENDENCY_MAP[key]) {
        DEPENDENCY_MAP[key].forEach(dep => { next[dep] = false; });
      }

      return next;
    });
  };

  // Check if an enhancement toggle should be disabled
  const isToggleDisabled = (key) => {
    if (key === 'detailed_theory') return !options.include_theory;
    if (key === 'extra_viva') return !options.include_viva;
    if (key === 'code_explanation') return !options.include_code;
    if (key === 'compact') return !options.include_output;
    return false;
  };

  const TOGGLE_OPTIONS = [
    { key: 'detailed_theory', label: 'Detailed Theory', icon: '📖' },
    { key: 'extra_viva', label: 'More Viva Qs', icon: '❓' },
    { key: 'code_explanation', label: 'Code Explanation', icon: '💡' },
    { key: 'compact', label: 'Compact Output', icon: '📐' },
  ];

  const SECTION_TOGGLES = [
    { key: 'include_theory', label: 'Include Theory', icon: '📝' },
    { key: 'include_code', label: 'Include Code', icon: '💻' },
    { key: 'include_viva', label: 'Include Viva', icon: '🎤' },
    { key: 'include_output', label: 'Include Output', icon: '📤' },
  ];

  // ─── Presets ──────────────────────────────────────────────
  const PRESETS = [
    {
      key: 'exam',
      label: '🎯 Exam Mode',
      values: { detailed_theory: false, extra_viva: false, code_explanation: false, compact: true },
    },
    {
      key: 'assignment',
      label: '📓 Assignment',
      values: { detailed_theory: true, extra_viva: true, code_explanation: true, compact: false },
    },
    {
      key: 'viva',
      label: '🎤 Viva Prep',
      values: { detailed_theory: false, extra_viva: true, code_explanation: false, compact: true },
    },
    {
      key: 'code',
      label: '💻 Code Focus',
      values: { detailed_theory: false, extra_viva: false, code_explanation: true, compact: true },
    },
  ];

  const applyPreset = (preset) => {
    setActivePreset(preset.key);
    setOptions(prev => {
      const next = { ...prev };
      // Apply preset values, but respect section toggle dependencies
      for (const [k, v] of Object.entries(preset.values)) {
        // Only enable an enhancement if its parent section is ON
        if (v === true) {
          if (k === 'detailed_theory' && !prev.include_theory) continue;
          if (k === 'extra_viva' && !prev.include_viva) continue;
          if (k === 'code_explanation' && !prev.include_code) continue;
          if (k === 'compact' && !prev.include_output) continue;
        }
        next[k] = v;
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="home-page">
        <div className="loading-overlay">
          <div className="spinner"></div>
          <div className="loading-text">Loading LabCraft...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      {/* ─── Hero Section ──────────────────────────────────── */}
      <section className="hero-section" id="hero">
        <div className="hero-grid-bg"></div>
        {/* Floating glow orbs */}
        <div className="hero-glow hero-glow-purple"></div>
        <div className="hero-glow hero-glow-blue"></div>
        <div className="hero-glow hero-glow-center"></div>

        <div className="hero-badge">
          <span className="hero-badge-dot"></span>
          <span>Powered by Gemini AI</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{opacity: 0.5}}>
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>

        <h1 className="hero-title">
          All Study Tools.
          <br />
          <span className="hero-title-gradient">One Platform.</span>
        </h1>

        <p className="hero-description">
          Lab experiments, source code, presentations — generated in seconds.
          <br />
          Pick your subject. Get exam-ready output. Download instantly.
        </p>

        <div className="hero-cta-row">
          <button className="btn btn-primary btn-lg hero-cta-primary" onClick={scrollToGenerator}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Start Generating
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
          <button className="btn btn-outline-glow btn-lg hero-cta-secondary" onClick={scrollToGenerator}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
            </svg>
            See How It Works
          </button>
        </div>

        {/* Feature Pills */}
        <div className="hero-features">
          <div className="hero-feature-pill">
            <span className="hero-pill-icon">⚡</span>
            <span>Instant Generation</span>
          </div>
          <div className="hero-feature-pill">
            <span className="hero-pill-icon">📄</span>
            <span>PDF & DOCX Export</span>
          </div>
          <div className="hero-feature-pill">
            <span className="hero-pill-icon">🎯</span>
            <span>Exam-Ready Format</span>
          </div>
          <div className="hero-feature-pill">
            <span className="hero-pill-icon">🔁</span>
            <span>AI Regeneration</span>
          </div>
        </div>

        {/* Trust indicators */}
        <div className="hero-trust">
          <div className="hero-trust-avatars">
            <div className="hero-avatar" style={{background: 'linear-gradient(135deg, #7C3AED, #06B6D4)'}}>S</div>
            <div className="hero-avatar" style={{background: 'linear-gradient(135deg, #06B6D4, #34D399)'}}>A</div>
            <div className="hero-avatar" style={{background: 'linear-gradient(135deg, #8B5CF6, #EC4899)'}}>R</div>
            <div className="hero-avatar" style={{background: 'linear-gradient(135deg, #F59E0B, #EF4444)'}}>M</div>
          </div>
          <div className="hero-trust-text">
            <span className="hero-trust-highlight">500+ students</span> already generating lab files
          </div>
        </div>
      </section>

      {/* ─── Tools Section ──────────────────────────────────── */}
      <section className="tools-section">
        <div className="tools-header">
          <span className="tools-badge badge badge-primary">Features</span>
          <h2 className="tools-heading">
            Everything You Need,{' '}
            <span className="gradient-text">In One Place</span>
          </h2>
          <p className="tools-subheading">
            LabCraft handles the heavy lifting — from theory to code to downloads.
          </p>
        </div>

        <div className="tools-grid">
          <div className="tool-card">
            <div className="tool-icon-wrap tool-icon-purple">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3h6v11l-3 3-3-3V3z"/><path d="M6 21h12"/><path d="M6 21l3-3"/><path d="M18 21l-3-3"/>
              </svg>
            </div>
            <h3 className="tool-title">Lab Experiments</h3>
            <p className="tool-desc">Generate complete lab files with AIM, theory, code, viva, and output — formatted exactly how your university expects.</p>
          </div>

          <div className="tool-card">
            <div className="tool-icon-wrap tool-icon-blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>
              </svg>
            </div>
            <h3 className="tool-title">Presentations</h3>
            <p className="tool-desc">Create structured slide decks on any topic. AI generates headings and bullet points, ready to download as PPTX.</p>
          </div>

          <div className="tool-card">
            <div className="tool-icon-wrap tool-icon-green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
            </div>
            <h3 className="tool-title">Source Code</h3>
            <p className="tool-desc">Clean, working source code in any language — with optional explanations and comments for better understanding.</p>
          </div>

          <div className="tool-card">
            <div className="tool-icon-wrap tool-icon-orange">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
              </svg>
            </div>
            <h3 className="tool-title">Viva Questions</h3>
            <p className="tool-desc">AI-generated Q&A sets to help you prepare for viva voce. Covers key concepts and common examiner questions.</p>
          </div>

          <div className="tool-card">
            <div className="tool-icon-wrap tool-icon-pink">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <h3 className="tool-title">Multi-Format Export</h3>
            <p className="tool-desc">Download your work as PDF, DOCX, or PPTX. Print-ready formatting that looks professional every time.</p>
          </div>

          <div className="tool-card">
            <div className="tool-icon-wrap tool-icon-cyan">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </div>
            <h3 className="tool-title">Section Editing</h3>
            <p className="tool-desc">Don't like a section? Modify any part individually with custom instructions — AI regenerates just that section.</p>
          </div>
        </div>
      </section>

      {/* ─── Benefits Section ───────────────────────────────── */}
      <section className="benefits-section">
        <div className="benefits-header">
          <span className="benefits-badge badge badge-accent">Why LabCraft?</span>
          <h2 className="benefits-heading">
            Built for Students Who{' '}
            <span className="gradient-text">Value Their Time</span>
          </h2>
        </div>

        <div className="benefits-grid">
          <div className="benefit-card">
            <div className="benefit-number">01</div>
            <div className="benefit-content">
              <h3 className="benefit-title">Save Hours, Not Minutes</h3>
              <p className="benefit-desc">Stop spending 2–3 hours formatting lab files manually. LabCraft generates a complete, submission-ready experiment in under 30 seconds.</p>
            </div>
            <div className="benefit-accent benefit-accent-purple"></div>
          </div>

          <div className="benefit-card">
            <div className="benefit-number">02</div>
            <div className="benefit-content">
              <h3 className="benefit-title">University-Grade Quality</h3>
              <p className="benefit-desc">Output follows the exact format your university expects — structured AIM, theory, code with comments, and properly numbered viva questions.</p>
            </div>
            <div className="benefit-accent benefit-accent-blue"></div>
          </div>

          <div className="benefit-card">
            <div className="benefit-number">03</div>
            <div className="benefit-content">
              <h3 className="benefit-title">AI That Understands Context</h3>
              <p className="benefit-desc">Powered by Gemini AI, LabCraft understands your subject matter deeply — generating accurate theory, working code, and relevant viva answers.</p>
            </div>
            <div className="benefit-accent benefit-accent-green"></div>
          </div>

          <div className="benefit-card">
            <div className="benefit-number">04</div>
            <div className="benefit-content">
              <h3 className="benefit-title">Iterate Until Perfect</h3>
              <p className="benefit-desc">Not happy with a section? Modify any part individually with plain English instructions. Regenerate only what you need — keep the rest intact.</p>
            </div>
            <div className="benefit-accent benefit-accent-cyan"></div>
          </div>
        </div>
      </section>

      {/* ─── Steps Indicator ────────────────────────────────── */}
      <div className="steps-bar" id="generator-section">
        <div className="step-item">
          <div className={`step-number ${step >= 1 ? 'completed' : 'active'}`}>1</div>
          <span className="step-label">Select Course</span>
        </div>
        <div className="step-connector"></div>
        <div className="step-item">
          <div className={`step-number ${step >= 2 ? 'completed' : step >= 1 ? 'active' : 'inactive'}`}>2</div>
          <span className="step-label">Choose Subject</span>
        </div>
        <div className="step-connector"></div>
        <div className="step-item">
          <div className={`step-number ${step >= 3 ? 'completed' : step >= 2 ? 'active' : 'inactive'}`}>3</div>
          <span className="step-label">Generate</span>
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ maxWidth: 720, marginBottom: 24 }}>
          <span>⚠️</span>
          <span>{error}</span>
          <button onClick={loadCourses}>Retry</button>
        </div>
      )}

      {/* ─── Generator Card ─────────────────────────────────── */}
      <div className="generator-card glass-card">
        <div className="card-header">
          <div className="card-icon">🧪</div>
          <div className="card-header-text">
            <h2>Configure Generation</h2>
            <p>Fill in the details below to get started</p>
          </div>
        </div>

        <div className="form-grid">
          {/* Course + Branch Row */}
          <div className="form-row">
            <div className="form-group">
              <label className="label">Course</label>
              <select
                className="select"
                value={selectedCourse}
                onChange={(e) => handleCourseChange(e.target.value)}
              >
                <option value="">Select Course</option>
                {coursesData?.courses?.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Branch</label>
              <select
                className="select"
                value={selectedBranch}
                onChange={(e) => handleBranchChange(e.target.value)}
                disabled={!selectedCourse}
              >
                <option value="">Select Branch</option>
                {branches.map(b => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Semester + Subject Row */}
          <div className="form-row">
            <div className="form-group">
              <label className="label">Semester</label>
              <select
                className="select"
                value={selectedSemester}
                onChange={(e) => handleSemesterChange(e.target.value)}
                disabled={!selectedBranch}
              >
                <option value="">Select Semester</option>
                {semesters.map(s => (
                  <option key={s.number} value={String(s.number)}>
                    Semester {s.number}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Subject</label>
              <select
                className="select"
                value={selectedSubject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                disabled={!selectedSemester}
              >
                <option value="">Select Subject</option>
                {subjects.map(s => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mode Selection */}
          {selectedSubject && (
            <div className="mode-section">
              <label className="label">What do you want to generate?</label>
              <div className="mode-grid">
                <div
                  className={`mode-card experiment ${mode === 'experiment' ? 'selected' : ''}`}
                  onClick={() => setMode('experiment')}
                >
                  <span className="mode-icon">📝</span>
                  <div className="mode-title">Lab Experiment</div>
                  <div className="mode-desc">AIM, Theory, Code, Viva, Output</div>
                </div>
                <div
                  className={`mode-card ppt ${mode === 'ppt' ? 'selected' : ''}`}
                  onClick={() => setMode('ppt')}
                >
                  <span className="mode-icon">📊</span>
                  <div className="mode-title">Presentation</div>
                  <div className="mode-desc">Slide-based PPT content</div>
                </div>
              </div>
            </div>
          )}

          {/* Experiment details */}
          {mode === 'experiment' && (
            <div className="form-row">
              <div className="form-group">
                <label className="label">Experiment Number</label>
                <input
                  type="number"
                  className="input"
                  placeholder="e.g. 5"
                  min="1"
                  value={experimentNo}
                  onChange={(e) => setExperimentNo(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="label">Topic / Title</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Implementation of Binary Search Tree"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* PPT details */}
          {mode === 'ppt' && (
            <div className="form-group">
              <label className="label">Presentation Topic</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Machine Learning Algorithms"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
          )}

          {/* Generation Options (toggles) */}
          {mode === 'experiment' && (
            <div className="options-section">
              {/* Preset pills */}
              <label className="label">Quick Presets</label>
              <div className="preset-bar">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    className={`preset-pill ${activePreset === p.key ? 'active' : ''}`}
                    onClick={() => applyPreset(p)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <label className="label options-label-divider">Content Options</label>
              <div className="options-grid">
                {TOGGLE_OPTIONS.map((opt) => {
                  const disabled = isToggleDisabled(opt.key);
                  return (
                    <div
                      key={opt.key}
                      className={`toggle-item ${options[opt.key] ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                      onClick={() => !disabled && toggleOption(opt.key)}
                    >
                      <span className="toggle-icon">{opt.icon}</span>
                      <span className="toggle-label">{opt.label}</span>
                      <div className={`toggle-switch ${options[opt.key] ? 'on' : ''}`}>
                        <div className="toggle-knob" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <label className="label options-label-divider">Include Sections</label>
              <div className="options-grid">
                {SECTION_TOGGLES.map((opt) => (
                  <div
                    key={opt.key}
                    className={`toggle-item ${options[opt.key] ? 'active' : ''}`}
                    onClick={() => toggleOption(opt.key)}
                  >
                    <span className="toggle-icon">{opt.icon}</span>
                    <span className="toggle-label">{opt.label}</span>
                    <div className={`toggle-switch ${options[opt.key] ? 'on' : ''}`}>
                      <div className="toggle-knob" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate Button */}
          {mode && (
            <div className="generate-btn-wrapper">
              <button
                className="btn btn-primary btn-generate"
                disabled={!canGenerate}
                onClick={handleSubmit}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Generate
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Recent History ──────────────────────────────────── */}
      {history.length > 0 && (
        <div className="history-section slide-up">
          <div className="history-header">
            <h3 className="history-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Recent Work
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={onClearHistory}>
              Clear All
            </button>
          </div>
          <div className="history-list">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="history-item"
                onClick={() => onLoadHistory(entry)}
              >
                <div className="history-item-icon">
                  {entry.mode === 'experiment' ? '🧪' : '📊'}
                </div>
                <div className="history-item-info">
                  <span className="history-item-topic">{entry.topic}</span>
                  <span className="history-item-meta">
                    {entry.subject}
                    {entry.experimentNo ? ` • Exp ${entry.experimentNo}` : ''}
                  </span>
                </div>
                <span className="history-item-time">{timeAgo(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
