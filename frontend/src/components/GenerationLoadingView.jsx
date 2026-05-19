/**
 * GenerationLoadingView — Premium Laboratory Flask Loading Experience
 * Animated SVG flask with bubbling liquid, floating particles, progress ring,
 * rotating messages, step tracker, and elapsed timer
 */
import { useState, useEffect, useMemo } from 'react';

const AI_MESSAGES = [
  'Initializing AI engine...',
  'Preparing experiment structure...',
  'Generating theory...',
  'Compiling source code...',
  'Building final PDF...',
  'Almost there...',
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

  // Progress ring calculation (360-degree ring based on step completion)
  const maxDuration = steps[steps.length - 1].duration;
  const progressPercent = Math.min(elapsedMs / maxDuration, 0.95);
  const circumference = 2 * Math.PI * 72;
  const strokeDashoffset = circumference * (1 - progressPercent);

  // Generate random bubble delays once
  const bubbles = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      cx: 18 + Math.random() * 24,
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 2,
      r: 1 + Math.random() * 2.5,
    })), []);

  // Floating particles
  const particles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      size: 2 + Math.random() * 4,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 6,
      duration: 4 + Math.random() * 4,
    })), []);

  return (
    <div className="gen-loading-view">
      {/* Ambient gradient background */}
      <div className="gen-loading-bg"></div>

      {/* Floating particles */}
      <div className="gen-particles">
        {particles.map(p => (
          <div
            key={p.id}
            className="gen-particle"
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

      {/* Flask + Progress Ring container */}
      <div className="gen-flask-container">
        {/* SVG Progress Ring */}
        <svg className="gen-progress-ring" viewBox="0 0 160 160">
          {/* Track */}
          <circle
            cx="80" cy="80" r="72"
            fill="none"
            stroke="rgba(124,58,237,0.1)"
            strokeWidth="3"
          />
          {/* Progress */}
          <circle
            className="gen-progress-ring-fill"
            cx="80" cy="80" r="72"
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 80 80)"
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="50%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#22D3EE" />
            </linearGradient>
          </defs>
        </svg>

        {/* Flask SVG */}
        <svg className="gen-flask-svg" viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Flask body outline */}
          <path
            className="gen-flask-outline"
            d="M22 8 L22 28 L8 62 C6 67 10 72 16 72 L44 72 C50 72 54 67 52 62 L38 28 L38 8"
            stroke="url(#flaskStroke)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Flask neck top */}
          <line x1="18" y1="8" x2="42" y2="8" stroke="url(#flaskStroke)" strokeWidth="2.5" strokeLinecap="round" />
          {/* Flask rim */}
          <line x1="20" y1="5" x2="40" y2="5" stroke="rgba(167,139,250,0.6)" strokeWidth="1.5" strokeLinecap="round" />

          {/* Liquid fill with animation (clipped to flask shape) */}
          <defs>
            <clipPath id="flaskClip">
              <path d="M23 28 L10 62 C8 67 11 71 16 71 L44 71 C49 71 52 67 50 62 L37 28 Z" />
            </clipPath>
            <linearGradient id="liquidGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7C3AED">
                <animate attributeName="stop-color" values="#7C3AED;#6D28D9;#8B5CF6;#7C3AED" dur="4s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#06B6D4">
                <animate attributeName="stop-color" values="#06B6D4;#22D3EE;#0891B2;#06B6D4" dur="4s" repeatCount="indefinite" />
              </stop>
            </linearGradient>
            <linearGradient id="flaskStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#22D3EE" />
            </linearGradient>
          </defs>

          {/* Liquid body */}
          <g clipPath="url(#flaskClip)">
            <rect
              className="gen-liquid"
              x="5" y="30" width="50" height="50"
              fill="url(#liquidGradient)"
              opacity="0.7"
            />
            {/* Liquid wave */}
            <path className="gen-liquid-wave" d="M5 38 Q15 34 25 38 Q35 42 45 38 L55 38 L55 80 L5 80 Z" fill="url(#liquidGradient)" opacity="0.4" />
            <path className="gen-liquid-wave-2" d="M5 40 Q18 36 30 40 Q42 44 55 40 L55 80 L5 80 Z" fill="rgba(124,58,237,0.25)" />
          </g>

          {/* Bubbles inside the flask */}
          <g clipPath="url(#flaskClip)">
            {bubbles.map(b => (
              <circle
                key={b.id}
                className="gen-bubble"
                cx={b.cx}
                cy="65"
                r={b.r}
                fill="rgba(255,255,255,0.4)"
                style={{
                  animationDelay: `${b.delay}s`,
                  animationDuration: `${b.duration}s`,
                }}
              />
            ))}
          </g>

          {/* Flask glow (inner) */}
          <ellipse
            cx="30" cy="58"
            rx="12" ry="8"
            fill="rgba(124,58,237,0.15)"
            className="gen-flask-glow"
          />
        </svg>
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
    </div>
  );
}

export default GenerationLoadingView;
