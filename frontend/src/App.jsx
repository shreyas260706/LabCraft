import { useState, useEffect } from 'react';
import './App.css';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import ResultPage from './pages/ResultPage';
import { preWarmBackend } from './services/api';

const HISTORY_KEY = 'labcraft_history';
const MAX_HISTORY = 10;

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [generationConfig, setGenerationConfig] = useState(null);
  const [experimentData, setExperimentData] = useState(null);
  const [pptData, setPptData] = useState(null);
  const [history, setHistory] = useState([]);

  // Pre-warm backend + load history on mount
  useEffect(() => {
    // Wake up Render backend silently (fire-and-forget)
    preWarmBackend();
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch { /* ignore corrupted data */ }
  }, []);

  // Persist history to localStorage
  const persistHistory = (items) => {
    setHistory(items);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
    } catch { /* storage full — silently fail */ }
  };

  const saveToHistory = (config, data) => {
    const entry = {
      id: Date.now(),
      subject: config.subject,
      topic: config.topic,
      experimentNo: config.experimentNo,
      course: config.course,
      mode: config.mode,
      timestamp: new Date().toISOString(),
      data, // full experiment/ppt result
    };

    setHistory(prev => {
      // Remove duplicate (same subject+topic+mode)
      const filtered = prev.filter(
        h => !(h.subject === entry.subject && h.topic === entry.topic && h.mode === entry.mode)
      );
      const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const clearHistory = () => {
    persistHistory([]);
  };

  const handleGenerate = (config) => {
    setGenerationConfig(config);
    setExperimentData(null);
    setPptData(null);
    setCurrentPage('result');
  };

  const handleLoadFromHistory = (entry) => {
    const config = {
      course: entry.course,
      subject: entry.subject,
      topic: entry.topic,
      mode: entry.mode,
      experimentNo: entry.experimentNo,
      options: {},
    };
    setGenerationConfig(config);
    if (entry.mode === 'experiment') {
      setExperimentData(entry.data);
      setPptData(null);
    } else {
      setPptData(entry.data);
      setExperimentData(null);
    }
    setCurrentPage('result');
  };

  const handleBack = () => {
    setCurrentPage('home');
    setExperimentData(null);
    setPptData(null);
    setGenerationConfig(null);
  };

  return (
    <div className="app">
      <Navbar onLogoClick={handleBack} />
      <main className="main-content">
        {currentPage === 'home' && (
          <HomePage
            onGenerate={handleGenerate}
            history={history}
            onLoadHistory={handleLoadFromHistory}
            onClearHistory={clearHistory}
          />
        )}
        {currentPage === 'result' && generationConfig && (
          <ResultPage
            config={generationConfig}
            experimentData={experimentData}
            setExperimentData={setExperimentData}
            pptData={pptData}
            setPptData={setPptData}
            onBack={handleBack}
            onSaveHistory={saveToHistory}
          />
        )}
      </main>
    </div>
  );
}

export default App;
