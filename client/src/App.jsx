import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Register from './pages/Register.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import AddExpense from './pages/AddExpense.jsx';
import Monthly from './pages/Monthly.jsx';
import BankOnboarding from './pages/BankOnboarding.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import { clearSession } from './lib/session.js';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export default function App() {
  const navigate = useNavigate();
  const loggedIn = !!localStorage.getItem('token');

  useEffect(() => {
    if (!loggedIn) return undefined;

    let timerId;

    const handleInactivityLogout = () => {
      clearSession();
      navigate('/login', { replace: true, state: { reason: 'inactive' } });
    };

    const resetTimer = () => {
      clearTimeout(timerId);
      timerId = setTimeout(handleInactivityLogout, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });

    document.addEventListener('visibilitychange', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timerId);
      events.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
      document.removeEventListener('visibilitychange', resetTimer);
    };
  }, [loggedIn, navigate]);

  return (
    <>
      <NavBar />
      <div className="container">
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/reset" element={<ResetPassword />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add"
            element={
              <ProtectedRoute>
                <AddExpense />
              </ProtectedRoute>
            }
          />
          <Route
            path="/monthly"
            element={
              <ProtectedRoute>
                <Monthly />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding/bank"
            element={
              <ProtectedRoute>
                <BankOnboarding />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to={loggedIn ? '/' : '/login'} />} />
        </Routes>
      </div>
    </>
  );
}
