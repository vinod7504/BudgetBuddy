import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';

export default function BankLinkedRoute({ children }) {
  const [state, setState] = useState({
    loading: true,
    allowed: false
  });

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const status = await api.bankStatus();
        const complete = Boolean(status?.onboardingComplete);
        localStorage.setItem('bankOnboarded', complete ? 'true' : 'false');
        if (active) setState({ loading: false, allowed: complete });
      } catch {
        localStorage.setItem('bankOnboarded', 'false');
        if (active) setState({ loading: false, allowed: false });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (state.loading) {
    return (
      <div className="card" style={{ maxWidth: 560, margin: '24px auto' }}>
        <p>Checking linked bank status...</p>
      </div>
    );
  }

  if (!state.allowed) {
    return <Navigate to="/onboarding/bank" replace />;
  }

  return children;
}
