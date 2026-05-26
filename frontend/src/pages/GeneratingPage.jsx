import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import GenerationLoadingView from '../components/GenerationLoadingView';
import { generateExperiment, generatePPT } from '../services/api';
import { useSEO } from '../hooks/useSEO';

const HISTORY_KEY = 'labcraft_history';
const MAX_HISTORY = 10;

function GeneratingPage() {
  useSEO({
    title: 'Generating... | LabCraft',
    description: 'AI is generating your document.',
    url: '/generating',
  });

  const location = useLocation();
  const navigate = useNavigate();
  const config = location.state?.config;
  const hasStarted = useRef(false);
  
  // Timer state
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isSlow, setIsSlow] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedMs(prev => {
        const next = prev + 200;
        if (next >= 30000) setIsSlow(true); // 30s
        if (next >= 90000) setShowRetry(true); // 90s
        return next;
      });
    }, 200);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!config || hasStarted.current) return;
    hasStarted.current = true;

    let isMounted = true;

    const startGeneration = async () => {
      try {
        const isExperiment = config.mode === 'experiment';
        let data;

        if (isExperiment) {
          data = await generateExperiment(
            config.subject,
            config.experimentNo,
            config.topic,
            config.options || {},
            false,
            config.studentDetails || null
          );
        } else {
          data = await generatePPT(
            config.subject,
            config.topic,
            config.options || {},
            false,
            config.studentDetails || null
          );
        }

        if (!isMounted) return;

        // Save to history
        const entryId = Date.now().toString();
        const entry = {
          id: entryId,
          subject: config.subject,
          topic: config.topic,
          experimentNo: config.experimentNo,
          course: config.course,
          mode: config.mode,
          timestamp: new Date().toISOString(),
          config, // save full config for regenerations
          data,
        };

        try {
          const stored = localStorage.getItem(HISTORY_KEY);
          const history = stored ? JSON.parse(stored) : [];
          // Remove duplicates
          const filtered = history.filter(
            h => !(h.subject === entry.subject && h.topic === entry.topic && h.mode === entry.mode)
          );
          const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        } catch {}

        // Small delay so the "almost there" animation finishes if it was super fast
        setTimeout(() => {
          if (isMounted) navigate(`/result/${entryId}`);
        }, 800);

      } catch (err) {
        if (!isMounted) return;
        // If it fails, navigate back to the generator with an error state
        console.error("Generation failed:", err);
        navigate(config.mode === 'experiment' ? '/lab-generator' : '/ppt-generator', { 
          state: { error: 'Generation failed. Please try again.' },
          replace: true 
        });
      }
    };

    startGeneration();

    return () => { isMounted = false; };
  }, [config, navigate]);

  // If directly navigated here without config in state, redirect to home
  if (!config) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="home-page" style={{ minHeight: 'calc(100vh - 70px)' }}>
      <GenerationLoadingView 
        isExperiment={config.mode === 'experiment'} 
        elapsedMs={elapsedMs}
        isSlow={isSlow}
      />
      {showRetry && (
        <div className="gen-retry-bar">
          <span>This is taking longer than expected.</span>
          <button className="btn btn-ghost btn-sm" onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      )}
    </div>
  );
}

export default GeneratingPage;
