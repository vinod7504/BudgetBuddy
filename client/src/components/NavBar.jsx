import { Link, useNavigate } from 'react-router-dom';
import { IoBook } from 'react-icons/io5';
import { clearSession } from '../lib/session.js';

export default function NavBar() {
  const navigate = useNavigate();
  const loggedIn = !!localStorage.getItem('token');
  const name = localStorage.getItem('name');
  const bankOnboarded = localStorage.getItem('bankOnboarded') === 'true';

  const logout = () => {
    clearSession();
    navigate('/login');
  };

  return (
    <header className="nav-shell">
      <div className="nav container">
        <Link to="/" className="brand-link">
          <IoBook /> Budget Buddy
        </Link>

        <div className="nav-right">
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
