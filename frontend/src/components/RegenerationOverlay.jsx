import { useState, useEffect, useMemo } from 'react';

const AI_MESSAGES = [
  'Analyzing experiment structure...',
  'Regenerating theory section...',
  'Optimizing source code formatting...',
  'Generating fresh viva questions...',
  'Formatting academic PDF layout...',
  'Finalizing variation...',
];

const PPT_MESSAGES = [
  'Analyzing slide structure...',
  'Generating fresh slide content...',
  'Formatting bullet points...',
  'Optimizing presentation flow...',
  'Finalizing variation...',
];

function RegenerationOverlay({ isExperiment = true, success = false }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [messageFade, setMessageFade] = useState(true);
  const messages = isExperiment ? AI_MESSAGES : PPT_MESSAGES;

  // Rotate messages every 2.5s with crossfade
  useEffect(() => {
    if (success) return; // Stop rotating on success
    const interval = setInterval(() => {
      setMessageFade(false);
      setTimeout(() => {
        setMessageIndex(prev => Math.min(prev + 1, messages.length - 1));
        setMessageFade(true);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, [messages.length, success]);

  // Floating particles
  const particles = useMemo(() =>
    Array.from({ length: 15 }, (_, i) => ({
      id: i,
      size: 2 + Math.random() * 5,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 4,
    })), []);

  return (
    <div className={`regen-overlay ${success ? 'regen-success' : ''}`}>
      {/* Animated Background Mesh */}
      <div className="regen-bg-mesh"></div>

      {/* Floating particles */}
      <div className="regen-particles">
        {particles.map(p => (
          <div
            key={p.id}
            className="regen-particle"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.x}%`,
              top: `${p.y}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      <div className="regen-content-box">
        {success ? (
          <div className="regen-success-content fade-in">
            <div className="regen-success-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h3 className="gradient-text">Fresh variation generated ✨</h3>
          </div>
        ) : (
          <>
            {/* Holographic Scanner */}
            <div className="regen-scanner-container">
              <div className="regen-scanner-ring ring-1"></div>
              <div className="regen-scanner-ring ring-2"></div>
              <div className="regen-scanner-ring ring-3"></div>
              
              <div className="regen-scanner-core">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="regen-core-icon">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </div>
              <div className="regen-scan-line"></div>
            </div>

            {/* Terminal Style Output */}
            <div className="regen-terminal">
              <div className="regen-terminal-header">
                <span className="dot dot-red"></span>
                <span className="dot dot-yellow"></span>
                <span className="dot dot-green"></span>
                <span className="terminal-title">LabCraft AI Engine</span>
              </div>
              <div className="regen-terminal-body">
                <div className="terminal-log dimmed"> {'>'} System initiated...</div>
                <div className="terminal-log dimmed"> {'>'} Bypassing cache layers...</div>
                <div className={`terminal-log active ${messageFade ? 'visible' : 'hidden'}`}>
                  <span className="cursor-blink">{'> '}</span>
                  {messages[messageIndex]}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default RegenerationOverlay;
