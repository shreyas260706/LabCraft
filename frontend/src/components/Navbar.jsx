/**
 * Navbar — Top navigation bar with branding
 */
import labcraftLogo from '../assets/labcraft-logo.png';

function Navbar({ onLogoClick }) {
  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={onLogoClick}>
        <div className="navbar-logo-container">
          <img src={labcraftLogo} alt="LabCraft Logo" className="navbar-logo-img" />
        </div>
        <div>
          <div className="navbar-title">LabCraft</div>
          <div className="navbar-subtitle">Craft your lab experiments effortlessly</div>
        </div>
      </div>
      <div className="navbar-tagline">
        <span>⚡</span>
        <span>Lab Generator</span>
      </div>
    </nav>
  );
}

export default Navbar;
