import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearSession } from '../lib/session.js';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const loggedIn = !!localStorage.getItem('token');
  const name = localStorage.getItem('name');
  const bankOnboarded = localStorage.getItem('bankOnboarded') === 'true';

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, loggedIn]);

  const logout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <header className="nav-shell">
      <div className="nav container">
        <Link to="/" className="brand-link">
          <img src="/budget_buddy.png" alt="Budget Buddy" className="brand-logo" />
          <span className="brand-text">Budget Buddy</span>
        </Link>

        <button
          className="nav-toggle"
          type="button"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          Menu
        </button>

        <div className={`nav-right ${mobileOpen ? 'open' : ''}`}>
          {loggedIn ? (
            <>
              <Link to="/add">Add</Link>
              <Link to="/monthly">Monthly</Link>
              <Link to="/onboarding/bank">{bankOnboarded ? 'Bank Linked' : 'Connect Bank'}</Link>
              <span className="badge">{name || 'User'}</span>
              <button onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
