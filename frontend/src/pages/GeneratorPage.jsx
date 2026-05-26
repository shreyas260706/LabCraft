import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCourses } from '../services/api';
import { useSEO } from '../hooks/useSEO';

const STORAGE_KEY = 'labcraft_generator_draft';

function GeneratorPage({ defaultMode = 'experiment' }) {
  useSEO({
    title: defaultMode === 'experiment' ? 'Lab Generator | LabCraft' : 'PPT Generator | LabCraft',
    description: `Configure and generate your ${defaultMode === 'experiment' ? 'lab experiment' : 'presentation'} instantly.`,
    url: `/${defaultMode === 'experiment' ? 'lab' : 'ppt'}-generator`,
  });

  const navigate = useNavigate();
  const location = useLocation();

  const [coursesData, setCoursesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [mode, setMode] = useState(defaultMode);
  const [experimentNo, setExperimentNo] = useState('');
  const [topic, setTopic] = useState('');

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

  const [studentDetails, setStudentDetails] = useState({
    enabled: false,
    name: '',
    rollNumber: '',
    remember: false,
  });

  // Keep mode in sync with route if it changes
  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode, location.pathname]);

  // Load courses and draft state on mount
  useEffect(() => {
    loadCourses();

    // 1. Load global student details (if remember was checked previously)
    try {
      const globalStudent = localStorage.getItem('labcraft_student');
      if (globalStudent) {
        const parsed = JSON.parse(globalStudent);
        if (parsed.name) {
          setStudentDetails(prev => ({
            ...prev,
            enabled: true,
            name: parsed.name || '',
            rollNumber: parsed.rollNumber || '',
            remember: true,
          }));
        }
      }
    } catch {}

    // 2. Load draft state from sessionStorage
    try {
      const draft = sessionStorage.getItem(STORAGE_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.selectedCourse) setSelectedCourse(parsed.selectedCourse);
        if (parsed.selectedBranch) setSelectedBranch(parsed.selectedBranch);
        if (parsed.selectedSemester) setSelectedSemester(parsed.selectedSemester);
        if (parsed.selectedSubject) setSelectedSubject(parsed.selectedSubject);
        if (parsed.experimentNo) setExperimentNo(parsed.experimentNo);
        if (parsed.topic) setTopic(parsed.topic);
        if (parsed.options) setOptions(parsed.options);
        if (parsed.activePreset) setActivePreset(parsed.activePreset);
        
        // Merge draft student details if they exist and are different from global
        if (parsed.studentDetails) {
          setStudentDetails(prev => ({ ...prev, ...parsed.studentDetails }));
        }
      }
    } catch {}
  }, []);

  // Save draft state to sessionStorage whenever it changes
  useEffect(() => {
    const draft = {
      selectedCourse, selectedBranch, selectedSemester, selectedSubject,
      experimentNo, topic, options, activePreset, studentDetails
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [selectedCourse, selectedBranch, selectedSemester, selectedSubject, experimentNo, topic, options, activePreset, studentDetails]);


  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCourses();
      setCoursesData(data);
    } catch (err) {
      setError('Failed to load courses. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const course = coursesData?.courses?.find(c => c.name === selectedCourse);
  const branches = course?.branches || [];
  const semesters = course?.semesters || [];
  const semester = semesters.find(s => String(s.number) === selectedSemester);
  const subjects = semester?.subjects || [];

  const step = selectedSubject ? 3 : (selectedCourse ? 1 : 0);

  const handleCourseChange = (val) => {
    setSelectedCourse(val);
    setSelectedBranch('');
    setSelectedSemester('');
    setSelectedSubject('');
    setTopic('');
  };
  const handleBranchChange = (val) => {
    setSelectedBranch(val);
    setSelectedSemester('');
    setSelectedSubject('');
    setTopic('');
  };
  const handleSemesterChange = (val) => {
    setSelectedSemester(val);
    setSelectedSubject('');
    setTopic('');
  };
  const handleSubjectChange = (val) => {
    setSelectedSubject(val);
    setTopic('');
  };

  const canGenerate = selectedSubject && mode && topic.trim() &&
    (mode === 'ppt' || (mode === 'experiment' && experimentNo));

  const handleSubmit = () => {
    if (!canGenerate) return;

    if (studentDetails.enabled && studentDetails.remember && studentDetails.name) {
      try {
        localStorage.setItem('labcraft_student', JSON.stringify({
          name: studentDetails.name,
          rollNumber: studentDetails.rollNumber,
        }));
      } catch {}
    } else if (!studentDetails.remember) {
      try { localStorage.removeItem('labcraft_student'); } catch {}
    }

    const config = {
      course: selectedCourse,
      semester: selectedSemester,
      subject: selectedSubject,
      mode,
      experimentNo: mode === 'experiment' ? parseInt(experimentNo) : null,
      topic: topic.trim(),
      options: mode === 'experiment' ? { ...options } : {},
      studentDetails: studentDetails.enabled && studentDetails.name
        ? { name: studentDetails.name, rollNumber: studentDetails.rollNumber }
        : null,
    };

    // Navigate to generation page with state
    navigate('/generating', { state: { config } });
  };

  const DEPENDENCY_MAP = {
    include_theory: ['detailed_theory'],
    include_viva: ['extra_viva'],
    include_code: ['code_explanation'],
    include_output: ['compact'],
  };

  const toggleOption = (key) => {
    setActivePreset(null);
    setOptions(prev => {
      const newVal = !prev[key];
      const next = { ...prev, [key]: newVal };
      if (!newVal && DEPENDENCY_MAP[key]) {
        DEPENDENCY_MAP[key].forEach(dep => { next[dep] = false; });
      }
      return next;
    });
  };

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

  const PRESETS = [
    { key: 'exam', label: '🎯 Exam Mode', values: { detailed_theory: false, extra_viva: false, code_explanation: false, compact: true } },
    { key: 'assignment', label: '📓 Assignment', values: { detailed_theory: true, extra_viva: true, code_explanation: true, compact: false } },
    { key: 'viva', label: '🎤 Viva Prep', values: { detailed_theory: false, extra_viva: true, code_explanation: false, compact: true } },
    { key: 'code', label: '💻 Code Focus', values: { detailed_theory: false, extra_viva: false, code_explanation: true, compact: true } },
  ];

  const applyPreset = (preset) => {
    setActivePreset(preset.key);
    setOptions(prev => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(preset.values)) {
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
      <div className="home-page" style={{ minHeight: 'calc(100vh - 70px)' }}>
        <div className="loading-overlay">
          <div className="spinner"></div>
          <div className="loading-text">Loading LabCraft...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page" style={{ paddingTop: '40px', minHeight: 'calc(100vh - 70px)' }}>
      {/* ─── Steps Indicator ────────────────────────────────── */}
      <div className="steps-bar" style={{ marginTop: 0 }}>
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
        <div className="error-banner" style={{ maxWidth: 720, marginBottom: 24, margin: '0 auto' }}>
          <span>⚠️</span>
          <span>{error}</span>
          <button onClick={loadCourses}>Retry</button>
        </div>
      )}

      {/* ─── Generator Card ─────────────────────────────────── */}
      <div className="generator-card glass-card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div className="card-icon">{mode === 'experiment' ? '🧪' : '📊'}</div>
          <div className="card-header-text">
            <h2>{mode === 'experiment' ? 'Lab Experiment Generator' : 'PPT Generator'}</h2>
            <p>Fill in the details below to get started</p>
          </div>
        </div>

        <div className="form-grid">
          <div className="form-row">
            <div className="form-group">
              <label className="label">Course</label>
              <select className="select" value={selectedCourse} onChange={(e) => handleCourseChange(e.target.value)}>
                <option value="">Select Course</option>
                {coursesData?.courses?.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Branch</label>
              <select className="select" value={selectedBranch} onChange={(e) => handleBranchChange(e.target.value)} disabled={!selectedCourse}>
                <option value="">Select Branch</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="label">Semester</label>
              <select className="select" value={selectedSemester} onChange={(e) => handleSemesterChange(e.target.value)} disabled={!selectedBranch}>
                <option value="">Select Semester</option>
                {semesters.map(s => <option key={s.number} value={String(s.number)}>Semester {s.number}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Subject</label>
              <select className="select" value={selectedSubject} onChange={(e) => handleSubjectChange(e.target.value)} disabled={!selectedSemester}>
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {selectedSubject && mode === 'experiment' && (
            <div className="form-row">
              <div className="form-group">
                <label className="label">Experiment Number</label>
                <input type="number" className="input" placeholder="e.g. 5" min="1" value={experimentNo} onChange={(e) => setExperimentNo(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Topic / Title</label>
                <input type="text" className="input" placeholder="e.g. Implementation of Binary Search Tree" value={topic} onChange={(e) => setTopic(e.target.value)} />
              </div>
            </div>
          )}

          {selectedSubject && mode === 'ppt' && (
            <div className="form-group">
              <label className="label">Presentation Topic</label>
              <input type="text" className="input" placeholder="e.g. Machine Learning Algorithms" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
          )}

          {selectedSubject && mode === 'experiment' && (
            <div className="options-section">
              <label className="label">Quick Presets</label>
              <div className="preset-bar">
                {PRESETS.map((p) => (
                  <button key={p.key} className={`preset-pill ${activePreset === p.key ? 'active' : ''}`} onClick={() => applyPreset(p)}>
                    {p.label}
                  </button>
                ))}
              </div>

              <label className="label options-label-divider">Content Options</label>
              <div className="options-grid">
                {TOGGLE_OPTIONS.map((opt) => {
                  const disabled = isToggleDisabled(opt.key);
                  return (
                    <div key={opt.key} className={`toggle-item ${options[opt.key] ? 'active' : ''} ${disabled ? 'disabled' : ''}`} onClick={() => !disabled && toggleOption(opt.key)}>
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
                  <div key={opt.key} className={`toggle-item ${options[opt.key] ? 'active' : ''}`} onClick={() => toggleOption(opt.key)}>
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

          {selectedSubject && (
            <div className="student-details-card">
              <div className={`toggle-item ${studentDetails.enabled ? 'active' : ''}`} onClick={() => setStudentDetails(prev => ({ ...prev, enabled: !prev.enabled }))}>
                <span className="toggle-icon">🎓</span>
                <span className="toggle-label">Include Student Details</span>
                <div className={`toggle-switch ${studentDetails.enabled ? 'on' : ''}`}>
                  <div className="toggle-knob" />
                </div>
              </div>
              {studentDetails.enabled && (
                <div className="student-inputs">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="label">Student Name</label>
                      <input type="text" className="input" placeholder="e.g. Rahul Sharma" value={studentDetails.name} onChange={(e) => setStudentDetails(prev => ({ ...prev, name: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="label">Roll Number</label>
                      <input type="text" className="input" placeholder="e.g. 05290302023" value={studentDetails.rollNumber} onChange={(e) => setStudentDetails(prev => ({ ...prev, rollNumber: e.target.value }))} />
                    </div>
                  </div>
                  <label className="remember-checkbox">
                    <input type="checkbox" checked={studentDetails.remember} onChange={(e) => setStudentDetails(prev => ({ ...prev, remember: e.target.checked }))} />
                    <span>Remember my details</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {selectedSubject && (
            <div className="generate-btn-wrapper">
              <button className="btn btn-primary btn-generate" disabled={!canGenerate} onClick={handleSubmit}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Generate
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GeneratorPage;
