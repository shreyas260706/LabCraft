/**
 * Navbar — IPUSpace platform navigation with constellation mark
 */

import { Link } from 'react-router-dom';

function Navbar() {
  return (
    <nav className="navbar" id="navbar">
      <Link to="/" className="navbar-brand" style={{ textDecoration: 'none' }}>
        {/* Constellation / Orbit mark — platform logo */}
        <div className="navbar-logo-container">
          <svg width="30" height="30" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="navBrandG" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#00E5FF"/>
                <stop offset="50%" stopColor="#7B61FF"/>
                <stop offset="100%" stopColor="#E040FB"/>
              </linearGradient>
            </defs>
            {/* Outer orbit ring */}
            <ellipse cx="32" cy="32" rx="28" ry="28" stroke="url(#navBrandG)" strokeWidth="1.5" fill="none" opacity="0.4"/>
            {/* Inner orbit ring */}
            <ellipse cx="32" cy="32" rx="18" ry="18" stroke="url(#navBrandG)" strokeWidth="1.2" fill="none" opacity="0.25"/>
            {/* Core node */}
            <circle cx="32" cy="32" r="5" fill="url(#navBrandG)" opacity="0.9"/>
            <circle cx="32" cy="32" r="3" fill="#00E5FF"/>
            {/* Satellite nodes on orbits */}
            <circle cx="52" cy="18" r="3.5" fill="#00E5FF" opacity="0.9"/>
            <circle cx="12" cy="42" r="3" fill="#7B61FF" opacity="0.8"/>
            <circle cx="48" cy="52" r="2.5" fill="#E040FB" opacity="0.7"/>
            {/* Connection lines from core to satellites */}
            <line x1="35" y1="29" x2="49" y2="20" stroke="url(#navBrandG)" strokeWidth="0.8" opacity="0.3"/>
            <line x1="29" y1="34" x2="14" y2="41" stroke="url(#navBrandG)" strokeWidth="0.8" opacity="0.25"/>
            <line x1="35" y1="35" x2="46" y2="50" stroke="url(#navBrandG)" strokeWidth="0.8" opacity="0.2"/>
          </svg>
        </div>
        <div className="navbar-brand-text">
          <span className="navbar-title">
            <span className="navbar-title-ipu">IPU</span>
            <span className="navbar-title-space">Space</span>
          </span>
          <span className="navbar-subtitle">Academic Operating System</span>
        </div>
      </Link>
      <div className="navbar-right">
        <div className="navbar-status">
          <span className="navbar-status-dot"></span>
          <span>Platform Active</span>
        </div>
        <a
          href="https://github.com/shreyas260706/LabCraft"
          target="_blank"
          rel="noopener noreferrer"
          className="navbar-github-link"
          title="Star on GitHub"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          <span>Star</span>
        </a>
      </div>
    </nav>
  );
}

export default Navbar;
