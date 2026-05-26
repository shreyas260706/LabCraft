import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import GeneratorPage from './pages/GeneratorPage';
import GeneratingPage from './pages/GeneratingPage';
import ResultViewPage from './pages/ResultViewPage';
import { preWarmBackend } from './services/api';

function App() {
  // Pre-warm backend on mount
  useEffect(() => {
    preWarmBackend();
  }, []);

  return (
    <BrowserRouter>
      <div className="app">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/lab-generator" element={<GeneratorPage defaultMode="experiment" />} />
            <Route path="/ppt-generator" element={<GeneratorPage defaultMode="ppt" />} />
            <Route path="/generating" element={<GeneratingPage />} />
            <Route path="/result/:id" element={<ResultViewPage />} />
            {/* Fallback to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
