/**
 * HowItWorksModal — Immersive step-by-step walkthrough of LabCraft
 * Premium onboarding experience with realistic UI mockups and smooth transitions
 */
import { useState, useEffect, useCallback } from 'react';

const STEPS = [
  {
    id: 1,
    badge: 'Step 1',
    title: 'Choose Your Subject',
    description: 'Select your course, branch, semester, and subject from the dropdown menus. LabCraft supports all major Indian university curricula.',
    highlight: 'Takes just 5 seconds',
  },
  {
    id: 2,
    badge: 'Step 2',
    title: 'Enter Experiment Topic',
    description: 'Type any experiment topic like Binary Search, Stack, Queue, Linked List, or any other topic from your syllabus.',
    highlight: 'Works for any programming topic',
  },
  {
    id: 3,
    badge: 'Step 3',
    title: 'AI Generates Everything',
    description: 'LabCraft\'s AI engine generates a complete lab file — Theory in structured bullet points, clean source code, viva Q&A, and sample output.',
    highlight: 'Powered by Gemini AI',
  },
  {
    id: 4,
    badge: 'Step 4',
    title: 'Preview & Edit',
    description: 'Review the generated content with a live preview. Not satisfied with any section? Click "Modify" and tell the AI what to change.',
    highlight: 'Full control over every section',
  },
  {
    id: 5,
    badge: 'Step 5',
    title: 'Download Instantly',
    description: 'Download your lab file as a professionally formatted PDF or DOCX. Print-ready with proper headings, code blocks, and page numbers.',
    highlight: 'Submission-ready in seconds',
  },
];

// ─── Realistic UI Mock Components ─────────────────────────

function MockFormScreen({ isActive }) {
  return (
    <div className={`hiw-mock hiw-mock-form ${isActive ? 'active' : ''}`}>
      <div className="hiw-mock-titlebar">
        <div className="hiw-mock-dots">
          <span style={{ background: '#FF5F57' }}></span>
          <span style={{ background: '#FEBC2E' }}></span>
          <span style={{ background: '#28C840' }}></span>
        </div>
        <span className="hiw-mock-url">labcraft.app</span>
      </div>
      <div className="hiw-mock-body">
        <div className="hiw-mock-card">
          <div className="hiw-mock-card-header">
            <span className="hiw-mock-emoji">🧪</span>
            <div>
              <div className="hiw-mock-card-title">Configure Generation</div>
              <div className="hiw-mock-card-sub">Fill in the details below</div>
            </div>
          </div>
          <div className="hiw-mock-fields">
            <div className="hiw-mock-row">
              <div className="hiw-mock-field">
                <div className="hiw-mock-label">Course</div>
                <div className="hiw-mock-select hiw-glow-pulse">
                  <span>B.Tech</span>
                  <span className="hiw-mock-chevron">▾</span>
                </div>
              </div>
              <div className="hiw-mock-field">
                <div className="hiw-mock-label">Branch</div>
                <div className="hiw-mock-select">
                  <span>CSE</span>
                  <span className="hiw-mock-chevron">▾</span>
                </div>
              </div>
            </div>
            <div className="hiw-mock-row">
              <div className="hiw-mock-field">
                <div className="hiw-mock-label">Semester</div>
                <div className="hiw-mock-select">
                  <span>Semester 3</span>
                  <span className="hiw-mock-chevron">▾</span>
                </div>
              </div>
              <div className="hiw-mock-field">
                <div className="hiw-mock-label">Subject</div>
                <div className="hiw-mock-select hiw-glow-pulse">
                  <span>Data Structures</span>
                  <span className="hiw-mock-chevron">▾</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockTopicScreen({ isActive }) {
  return (
    <div className={`hiw-mock hiw-mock-topic ${isActive ? 'active' : ''}`}>
      <div className="hiw-mock-titlebar">
        <div className="hiw-mock-dots">
          <span style={{ background: '#FF5F57' }}></span>
          <span style={{ background: '#FEBC2E' }}></span>
          <span style={{ background: '#28C840' }}></span>
        </div>
        <span className="hiw-mock-url">labcraft.app</span>
      </div>
      <div className="hiw-mock-body">
        <div className="hiw-mock-card">
          <div className="hiw-mock-mode-row">
            <div className="hiw-mock-mode-card hiw-mock-mode-active">
              <span>📝</span>
              <div className="hiw-mock-mode-label">Lab Experiment</div>
            </div>
            <div className="hiw-mock-mode-card">
              <span>📊</span>
              <div className="hiw-mock-mode-label">Presentation</div>
            </div>
          </div>
          <div className="hiw-mock-fields" style={{ marginTop: 12 }}>
            <div className="hiw-mock-row">
              <div className="hiw-mock-field">
                <div className="hiw-mock-label">Experiment No.</div>
                <div className="hiw-mock-input">5</div>
              </div>
              <div className="hiw-mock-field">
                <div className="hiw-mock-label">Topic / Title</div>
                <div className="hiw-mock-input hiw-mock-typing">
                  <span className="hiw-typing-text">Binary Search Tree</span>
                  <span className="hiw-typing-cursor"></span>
                </div>
              </div>
            </div>
          </div>
          <div className="hiw-mock-generate-btn">
            <span>⚡</span> Generate
          </div>
        </div>
      </div>
    </div>
  );
}

function MockLoadingScreen({ isActive }) {
  return (
    <div className={`hiw-mock hiw-mock-loading ${isActive ? 'active' : ''}`}>
      <div className="hiw-mock-titlebar">
        <div className="hiw-mock-dots">
          <span style={{ background: '#FF5F57' }}></span>
          <span style={{ background: '#FEBC2E' }}></span>
          <span style={{ background: '#28C840' }}></span>
        </div>
        <span className="hiw-mock-url">labcraft.app</span>
      </div>
      <div className="hiw-mock-body hiw-mock-body-center">
        {/* Mini flask animation */}
        <div className="hiw-mini-flask">
          <svg viewBox="0 0 60 80" fill="none" width="48" height="64">
            <path d="M22 8 L22 28 L8 62 C6 67 10 72 16 72 L44 72 C50 72 54 67 52 62 L38 28 L38 8"
              stroke="url(#hiwFlaskG)" strokeWidth="2" strokeLinecap="round" fill="none" />
            <line x1="18" y1="8" x2="42" y2="8" stroke="url(#hiwFlaskG)" strokeWidth="2.5" strokeLinecap="round" />
            <defs>
              <linearGradient id="hiwFlaskG" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A78BFA" />
                <stop offset="100%" stopColor="#22D3EE" />
              </linearGradient>
              <clipPath id="hiwFlaskClip">
                <path d="M23 28 L10 62 C8 67 11 71 16 71 L44 71 C49 71 52 67 50 62 L37 28 Z" />
              </clipPath>
            </defs>
            <g clipPath="url(#hiwFlaskClip)">
              <rect className="hiw-flask-liquid" x="5" y="38" width="50" height="40" fill="url(#hiwFlaskG)" opacity="0.5" />
            </g>
            {[0, 1, 2].map(i => (
              <circle key={i} className="hiw-flask-bubble" cx={22 + i * 8} cy="62" r={1.5 + i * 0.5}
                fill="rgba(255,255,255,0.5)" style={{ animationDelay: `${i * 0.7}s` }} />
            ))}
          </svg>
        </div>
        <div className="hiw-mock-loading-text">Generating structured experiment...</div>
        <div className="hiw-mock-loading-timer">00:12</div>
        <div className="hiw-mock-loading-steps">
          <div className="hiw-mock-step-done"><span>✓</span> AI initialized</div>
          <div className="hiw-mock-step-done"><span>✓</span> Generating theory</div>
          <div className="hiw-mock-step-active"><span className="hiw-mini-spinner"></span> Creating source code</div>
          <div className="hiw-mock-step-pending">Building document</div>
        </div>
      </div>
    </div>
  );
}

function MockPreviewScreen({ isActive }) {
  return (
    <div className={`hiw-mock hiw-mock-preview ${isActive ? 'active' : ''}`}>
      <div className="hiw-mock-titlebar">
        <div className="hiw-mock-dots">
          <span style={{ background: '#FF5F57' }}></span>
          <span style={{ background: '#FEBC2E' }}></span>
          <span style={{ background: '#28C840' }}></span>
        </div>
        <span className="hiw-mock-url">labcraft.app/result</span>
      </div>
      <div className="hiw-mock-body">
        {/* Theory section */}
        <div className="hiw-mock-section">
          <div className="hiw-mock-section-header">
            <span>📖</span><span>THEORY</span>
            <span className="hiw-mock-modify-btn">Modify</span>
          </div>
          <div className="hiw-mock-section-body">
            <div className="hiw-mock-text-line" style={{ width: '100%' }}></div>
            <div className="hiw-mock-text-line" style={{ width: '88%' }}></div>
            <div className="hiw-mock-text-line" style={{ width: '94%' }}></div>
            <div className="hiw-mock-text-line" style={{ width: '72%' }}></div>
          </div>
        </div>
        {/* Code section */}
        <div className="hiw-mock-section">
          <div className="hiw-mock-section-header">
            <span>💻</span><span>SOURCE CODE</span>
            <span className="hiw-mock-lang-badge">C/C++</span>
          </div>
          <div className="hiw-mock-code-body">
            <div className="hiw-mock-code-line"><span className="hiw-c-kw">#include</span> &lt;stdio.h&gt;</div>
            <div className="hiw-mock-code-line"><span className="hiw-c-kw">int</span> <span className="hiw-c-fn">main</span>() {'{'}</div>
            <div className="hiw-mock-code-line">    <span className="hiw-c-fn">printf</span>(<span className="hiw-c-str">"Hello"</span>);</div>
            <div className="hiw-mock-code-line">    <span className="hiw-c-kw">return</span> 0;</div>
            <div className="hiw-mock-code-line">{'}'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockDownloadScreen({ isActive }) {
  return (
    <div className={`hiw-mock hiw-mock-download ${isActive ? 'active' : ''}`}>
      <div className="hiw-mock-titlebar">
        <div className="hiw-mock-dots">
          <span style={{ background: '#FF5F57' }}></span>
          <span style={{ background: '#FEBC2E' }}></span>
          <span style={{ background: '#28C840' }}></span>
        </div>
        <span className="hiw-mock-url">labcraft.app/result</span>
      </div>
      <div className="hiw-mock-body">
        <div className="hiw-mock-section">
          <div className="hiw-mock-section-header">
            <span>❓</span><span>VIVA VOCE</span>
          </div>
          <div className="hiw-mock-section-body">
            <div className="hiw-mock-viva-item">
              <div><strong>Q1.</strong> What is a BST?</div>
              <div className="hiw-mock-viva-ans"><strong>Ans.</strong> A binary tree where left &lt; root &lt; right.</div>
            </div>
            <div className="hiw-mock-viva-item">
              <div><strong>Q2.</strong> Time complexity of search?</div>
              <div className="hiw-mock-viva-ans"><strong>Ans.</strong> O(log n) average, O(n) worst case.</div>
            </div>
          </div>
        </div>
        {/* Download bar */}
        <div className="hiw-mock-download-bar">
          <div className="hiw-mock-dl-btn hiw-mock-dl-pdf hiw-glow-pulse">
            <span>📄</span> Download PDF
          </div>
          <div className="hiw-mock-dl-btn hiw-mock-dl-docx">
            <span>📝</span> Download DOCX
          </div>
          <div className="hiw-mock-dl-btn hiw-mock-dl-regen">
            ↻ Regenerate
          </div>
        </div>
      </div>
    </div>
  );
}

const MOCK_SCREENS = [MockFormScreen, MockTopicScreen, MockLoadingScreen, MockPreviewScreen, MockDownloadScreen];

// ─── Main Modal Component ─────────────────────────────────

function HowItWorksModal({ isOpen, onClose, onStartGenerating }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Handle open/close animation
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => setIsVisible(true));
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const goTo = useCallback((index) => {
    if (isAnimating || index === currentStep) return;
    setIsAnimating(true);
    setCurrentStep(index);
    setTimeout(() => setIsAnimating(false), 400);
  }, [isAnimating, currentStep]);

  const next = useCallback(() => {
    if (currentStep < STEPS.length - 1) goTo(currentStep + 1);
  }, [currentStep, goTo]);

  const prev = useCallback(() => {
    if (currentStep > 0) goTo(currentStep - 1);
  }, [currentStep, goTo]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, next, prev, onClose]);

  if (!isOpen) return null;

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;
  const MockScreen = MOCK_SCREENS[currentStep];

  return (
    <div className={`hiw-overlay ${isVisible ? 'visible' : ''}`} onClick={onClose}>
      <div className="hiw-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="hiw-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Progress bar */}
        <div className="hiw-progress-bar">
          <div className="hiw-progress-fill" style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}></div>
        </div>

        {/* Content layout */}
        <div className="hiw-content">
          {/* Left — Mock UI */}
          <div className="hiw-mock-panel">
            <div className="hiw-mock-glow"></div>
            {MOCK_SCREENS.map((Screen, i) => (
              <Screen key={i} isActive={i === currentStep} />
            ))}
          </div>

          {/* Right — Text */}
          <div className="hiw-text-panel">
            <div className="hiw-step-badge">{step.badge}</div>
            <h2 className="hiw-step-title" key={`title-${currentStep}`}>{step.title}</h2>
            <p className="hiw-step-desc" key={`desc-${currentStep}`}>{step.description}</p>
            <div className="hiw-step-highlight" key={`hl-${currentStep}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              {step.highlight}
            </div>

            {/* Step dots */}
            <div className="hiw-dots">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  className={`hiw-dot ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''}`}
                  onClick={() => goTo(i)}
                  aria-label={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            {/* Nav buttons */}
            <div className="hiw-nav">
              <button className="btn btn-ghost btn-sm" onClick={prev} disabled={currentStep === 0}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              {isLastStep ? (
                <button className="btn btn-primary btn-sm hiw-cta-glow" onClick={() => { onClose(); onStartGenerating?.(); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Start Generating
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={next}>
                  Next
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>

            {/* Keyboard hint */}
            <div className="hiw-keyboard-hint">
              Use <kbd>←</kbd> <kbd>→</kbd> arrow keys · <kbd>Esc</kbd> to close
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HowItWorksModal;
