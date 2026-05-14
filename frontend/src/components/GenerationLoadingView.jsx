/**
 * GenerationLoadingView — Premium AI-style loading experience
 * Rotating messages, animated progress steps, skeleton preview, elapsed timer
 */
import { useState, useEffect, useRef } from 'react';

const AI_MESSAGES = [
  'Initializing AI engine...',
  'Preparing generation pipeline...',
  'Connecting to compute node...',
  'Generating structured experiment...',
  'Formatting source code...',
  'Building final document...',
];

const PPT_MESSAGES = [
  'Initializing AI engine...',
  'Analyzing topic structure...',
  'Generating slide content...',
  'Formatting bullet points...',
  'Polishing presentation...',
  'Finalizing slides...',
];

const EXPERIMENT_STEPS = [
  { label: 'AI initialized', duration: 4000 },
  { label: 'Generating theory', duration: 8000 },
  { label: 'Creating source code', duration: 14000 },
  { label: 'Formatting experiment', duration: 20000 },
  { label: 'Building document', duration: 26000 },
];

const PPT_STEPS = [
  { label: 'AI initialized', duration: 3000 },
  { label: 'Analyzing topic', duration: 7000 },
  { label: 'Generating slides', duration: 13000 },
  { label: 'Formatting content', duration: 18000 },
  { label: 'Finalizing presentation', duration: 22000 },
];

function GenerationLoadingView({ isExperiment = true, elapsedMs = 0, isSlow = false }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [messageFade, setMessageFade] = useState(true);
  const messages = isExperiment ? AI_MESSAGES : PPT_MESSAGES;
  const steps = isExperiment ? EXPERIMENT_STEPS : PPT_STEPS;

  // Rotate messages every 3s with crossfade
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageFade(false);
      setTimeout(() => {
        setMessageIndex(prev => (prev + 1) % messages.length);
        setMessageFade(true);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, [messages.length]);

  // Format elapsed time
  const elapsed = Math.floor(elapsedMs / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className="gen-loading-view">
      {/* Ambient glow */}
      <div className="gen-loading-glow"></div>

      {/* AI Orb animation */}
      <div className="gen-orb-container">
        <div className="gen-orb">
          <div className="gen-orb-ring gen-orb-ring-1"></div>
          <div className="gen-orb-ring gen-orb-ring-2"></div>
          <div className="gen-orb-ring gen-orb-ring-3"></div>
          <div className="gen-orb-core"></div>
        </div>
      </div>

      {/* Rotating message */}
      <div className={`gen-message ${messageFade ? 'visible' : 'hidden'}`}>
        {messages[messageIndex]}
      </div>

      {/* Elapsed timer */}
      <div className="gen-timer">{timeStr}</div>

      {/* Slow warning */}
      {isSlow && (
        <div className="gen-slow-warning">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>AI engine taking longer than usual... hang tight!</span>
        </div>
      )}

      {/* Progress Steps */}
      <div className="gen-progress">
        {steps.map((step, i) => {
          const completed = elapsedMs >= step.duration;
          const isActive = !completed && (i === 0 || elapsedMs >= steps[i - 1].duration);

          return (
            <div
              key={i}
              className={`gen-step ${completed ? 'completed' : ''} ${isActive ? 'active' : ''}`}
            >
              <div className="gen-step-indicator">
                {completed ? (
                  <svg className="gen-step-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : isActive ? (
                  <div className="gen-step-spinner"></div>
                ) : (
                  <div className="gen-step-dot"></div>
                )}
              </div>
              <span className="gen-step-label">{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Skeleton Preview */}
      <div className="gen-skeleton-preview">
        <div className="gen-skeleton-doc">
          {/* Document header */}
          <div className="gen-skeleton-doc-header">
            <div className="skeleton gen-sk-line" style={{ width: '40%', height: 14 }}></div>
            <div className="skeleton gen-sk-line" style={{ width: '25%', height: 10 }}></div>
          </div>
          {/* Title */}
          <div className="gen-skeleton-doc-title">
            <div className="skeleton gen-sk-line" style={{ width: '60%', height: 18 }}></div>
          </div>
          {/* Text lines */}
          <div className="gen-skeleton-doc-body">
            <div className="skeleton gen-sk-line" style={{ width: '100%', height: 10 }}></div>
            <div className="skeleton gen-sk-line" style={{ width: '92%', height: 10 }}></div>
            <div className="skeleton gen-sk-line" style={{ width: '85%', height: 10 }}></div>
            <div className="skeleton gen-sk-line" style={{ width: '96%', height: 10 }}></div>
          </div>
          {/* Code block */}
          <div className="gen-skeleton-code-block">
            <div className="skeleton gen-sk-line" style={{ width: '30%', height: 8 }}></div>
            <div className="skeleton gen-sk-line" style={{ width: '70%', height: 8 }}></div>
            <div className="skeleton gen-sk-line" style={{ width: '55%', height: 8 }}></div>
            <div className="skeleton gen-sk-line" style={{ width: '80%', height: 8 }}></div>
            <div className="skeleton gen-sk-line" style={{ width: '45%', height: 8 }}></div>
          </div>
          {/* More text */}
          <div className="gen-skeleton-doc-body">
            <div className="skeleton gen-sk-line" style={{ width: '88%', height: 10 }}></div>
            <div className="skeleton gen-sk-line" style={{ width: '75%', height: 10 }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GenerationLoadingView;
