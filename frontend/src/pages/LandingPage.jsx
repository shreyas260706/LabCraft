import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HowItWorksModal from '../components/HowItWorksModal';
import { useSEO } from '../hooks/useSEO';

const HISTORY_KEY = 'labcraft_history';

function LandingPage() {
  useSEO({
    title: 'LabCraft - AI Lab File Generator',
    description: 'Generate AI-powered BTech lab files, source code, viva questions, and presentations instantly.',
    url: '/',
  });

  const navigate = useNavigate();
  const [isHiwOpen, setIsHiwOpen] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch { /* ignore corrupted data */ }
  }, []);

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify([]));
    } catch {}
  };

  const handleLoadHistory = (entry) => {
    navigate(`/result/${entry.id}`);
  };

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

  return (
    <div className="home-page">
      {/* ─── Hero Section ──────────────────────────────────── */}
      <section className="hero-section" id="hero">
        <div className="hero-grid-bg"></div>
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
          <button className="btn btn-primary btn-lg hero-cta-primary" onClick={() => navigate('/lab-generator')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            Lab Generator
          </button>
          <button className="btn btn-outline-glow btn-lg hero-cta-secondary" onClick={() => navigate('/ppt-generator')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>
            </svg>
            PPT Generator
          </button>
          <button className="btn btn-ghost btn-lg hero-cta-tertiary" onClick={() => setIsHiwOpen(true)} style={{ marginLeft: '12px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>
            </svg>
            How It Works
          </button>
        </div>

        <div className="hero-features">
          <div className="hero-feature-pill"><span className="hero-pill-icon">⚡</span><span>Instant Generation</span></div>
          <div className="hero-feature-pill"><span className="hero-pill-icon">📄</span><span>PDF & DOCX Export</span></div>
          <div className="hero-feature-pill"><span className="hero-pill-icon">🎯</span><span>Exam-Ready Format</span></div>
          <div className="hero-feature-pill"><span className="hero-pill-icon">🔁</span><span>AI Regeneration</span></div>
        </div>

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
          <h2 className="tools-heading">Everything You Need, <span className="gradient-text">In One Place</span></h2>
          <p className="tools-subheading">LabCraft handles the heavy lifting — from theory to code to downloads.</p>
        </div>
        <div className="tools-grid">
          <div className="tool-card">
            <div className="tool-icon-wrap tool-icon-purple">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6v11l-3 3-3-3V3z"/><path d="M6 21h12"/><path d="M6 21l3-3"/><path d="M18 21l-3-3"/></svg>
            </div>
            <h3 className="tool-title">Lab Experiments</h3>
            <p className="tool-desc">Generate complete lab files with AIM, theory, code, viva, and output — formatted exactly how your university expects.</p>
          </div>
          <div className="tool-card">
            <div className="tool-icon-wrap tool-icon-blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
            </div>
            <h3 className="tool-title">Presentations</h3>
            <p className="tool-desc">Create structured slide decks on any topic. AI generates headings and bullet points, ready to download as PPTX.</p>
          </div>
          <div className="tool-card">
            <div className="tool-icon-wrap tool-icon-green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            </div>
            <h3 className="tool-title">Source Code</h3>
            <p className="tool-desc">Clean, working source code in any language — with optional explanations and comments for better understanding.</p>
          </div>
          <div className="tool-card">
            <div className="tool-icon-wrap tool-icon-orange">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
            </div>
            <h3 className="tool-title">Viva Questions</h3>
            <p className="tool-desc">AI-generated Q&A sets to help you prepare for viva voce. Covers key concepts and common examiner questions.</p>
          </div>
          <div className="tool-card">
            <div className="tool-icon-wrap tool-icon-pink">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <h3 className="tool-title">Multi-Format Export</h3>
            <p className="tool-desc">Download your work as PDF, DOCX, or PPTX. Print-ready formatting that looks professional every time.</p>
          </div>
          <div className="tool-card">
            <div className="tool-icon-wrap tool-icon-cyan">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
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
          <h2 className="benefits-heading">Built for Students Who <span className="gradient-text">Value Their Time</span></h2>
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

      {/* ─── Recent History ──────────────────────────────────── */}
      {history.length > 0 && (
        <div className="history-section slide-up">
          <div className="history-header">
            <h3 className="history-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Recent Work
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={clearHistory}>Clear All</button>
          </div>
          <div className="history-list">
            {history.map((entry) => (
              <div key={entry.id} className="history-item" onClick={() => handleLoadHistory(entry)}>
                <div className="history-item-icon">{entry.mode === 'experiment' ? '🧪' : '📊'}</div>
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

      {/* How It Works Modal */}
      <HowItWorksModal
        isOpen={isHiwOpen}
        onClose={() => setIsHiwOpen(false)}
        onStartGenerating={() => navigate('/lab-generator')}
      />
    </div>
  );
}

export default LandingPage;
