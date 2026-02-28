import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(-10);
  if (digits.length < 10) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

function readable(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatApiError(res, fallback) {
  if (!res?.error) return '';
  const code = res?.code ? ` [${res.code}]` : '';
  const upstreamMsg = readable(res?.details?.upstreamMessage);
  const upstream = upstreamMsg ? ` (${upstreamMsg})` : '';
  const status = res?.details?.upstreamStatus ? ` {HTTP ${res.details.upstreamStatus}}` : '';
  const route = res?.details?.url ? ` <${res.details.url}>` : '';
  return `${res.error}${code}${status}${upstream}${route}` || fallback;
}

export default function BankOnboarding() {
  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
  const [phone, setPhone] = useState('');
  const [banks, setBanks] = useState([]);
  const [provider, setProvider] = useState('');
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [linking, setLinking] = useState(false);
  const [savingActive, setSavingActive] = useState(false);
  const navigate = useNavigate();

  const cleanPhone = useMemo(() => String(phone || '').replace(/\D/g, '').slice(-10), [phone]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const status = await api.bankStatus();
        if (!active) return;

        if (status?.error) {
          const msg =
            status.error === 'Missing token' || status.error === 'Invalid or expired token'
              ? 'Session expired. Please login again.'
              : `Unable to fetch bank onboarding status: ${status.error}`;
          setError(msg);
          return;
        }

        const complete = Boolean(status?.onboardingComplete);
        const linked = Array.isArray(status?.linkedBanks) ? status.linkedBanks : [];
        const activeCode = status?.activeBank?.code || linked[0]?.code || '';

        setOnboardingComplete(complete);
        localStorage.setItem('bankOnboarded', complete ? 'true' : 'false');

        if (status?.phone) setPhone(status.phone);
        if (linked.length > 0) {
          setBanks(linked);
          setSelectedBankCode(activeCode);
          setConsent(Boolean(status?.bankConsentAt));
        }
        if (complete && linked.length > 0) {
          setOk('Bank is already linked. You can switch active bank or link another account.');
        }
      } catch {
        if (active) setError(`Cannot reach backend API at ${apiBase}. Start backend server and try again.`);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const fetchOptions = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');

    if (!/^\d{10}$/.test(cleanPhone)) {
      setError('Enter a valid 10 digit mobile number.');
      return;
    }

    setLoadingOptions(true);
    try {
      const res = await api.bankOptions(cleanPhone);
      if (res?.error) {
        setError(formatApiError(res, 'Unable to fetch linked banks.'));
        return;
      }

      setProvider(res?.provider || '');
      setBanks(res?.banks || []);
      if ((res?.banks || []).length > 0) {
        setSelectedBankCode(res.banks[0].code);
        setOk('Select one bank and give permission to continue.');
      } else {
        setError('No linked banks found for this number.');
      }
    } catch {
      setError('Unable to connect to bank lookup service.');
    } finally {
      setLoadingOptions(false);
    }
  };

  const linkBank = async () => {
    setError('');
    setOk('');

    if (!/^\d{10}$/.test(cleanPhone)) {
      setError('Enter a valid 10 digit mobile number.');
      return;
    }
    if (!selectedBankCode) {
      setError('Select a bank to continue.');
      return;
    }
    if (!consent) {
      setError('Please allow permission to fetch bank transactions.');
      return;
    }

    setLinking(true);
    try {
      const res = await api.linkBank({
        phone: cleanPhone,
        bankCode: selectedBankCode,
        permissionGranted: consent
      });

      if (res?.error) {
        setError(formatApiError(res, 'Unable to link selected bank.'));
        return;
      }

      setOnboardingComplete(true);
      localStorage.setItem('bankOnboarded', 'true');
      if (Array.isArray(res?.linkedBanks) && res.linkedBanks.length > 0) {
        setBanks(res.linkedBanks);
      }
      setOk('Bank linked successfully. Opening dashboard...');
      setTimeout(() => navigate('/', { replace: true }), 700);
    } catch {
      setError('Unable to link bank right now.');
    } finally {
      setLinking(false);
    }
  };

  const saveActiveBank = async () => {
    setError('');
    setOk('');

    if (!selectedBankCode) {
      setError('Select a linked bank first.');
      return;
    }

    setSavingActive(true);
    try {
      const res = await api.setActiveBank(selectedBankCode);
      if (res?.error) {
        setError(formatApiError(res, 'Unable to update active bank.'));
        return;
      }

      if (Array.isArray(res?.linkedBanks)) {
        setBanks(res.linkedBanks);
      }
      setOnboardingComplete(true);
      localStorage.setItem('bankOnboarded', 'true');
      setOk('Active bank updated successfully.');
    } catch {
      setError('Unable to set active bank right now.');
    } finally {
      setSavingActive(false);
    }
  };

  return (
    <div className="grid" style={{ maxWidth: 780, margin: '20px auto', gap: 20 }}>
      <div className="card onboarding-card">
        <h2>Connect / Manage Bank</h2>
        <p className="helper-text">
          Use your mobile number to discover linked banks and grant permission for transaction analytics. If already
          linked, you can switch your active bank from this page.
        </p>

        <form className="grid" onSubmit={fetchOptions} style={{ gap: 12 }}>
          <label htmlFor="mobile">Mobile Number</label>
          <input
            id="mobile"
            className="input"
            type="tel"
            inputMode="numeric"
            placeholder="10 digit number"
            value={formatPhone(phone)}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button type="submit" disabled={loadingOptions}>
            {loadingOptions ? 'Checking linked banks...' : 'Find linked banks'}
          </button>
        </form>

        {provider && <p className="helper-text">Data source: {provider}</p>}
        {error && <div className="error-text">{error}</div>}
        {ok && <div className="success-text">{ok}</div>}
      </div>

      {banks.length > 0 && (
        <div className="card">
          <h3>Banks linked with {formatPhone(cleanPhone || phone)}</h3>
          <div className="bank-options">
            {banks.map((bank) => (
              <label key={bank.code} className="bank-option">
                <input
                  type="radio"
                  name="bankCode"
                  value={bank.code}
                  checked={selectedBankCode === bank.code}
                  onChange={() => setSelectedBankCode(bank.code)}
                />
                <div>
                  <strong>{bank.name}</strong>
                  <div className="helper-text">Account: {bank.accountMask}</div>
                  {onboardingComplete && selectedBankCode === bank.code && (
                    <div className="helper-text">Active bank</div>
                  )}
                </div>
              </label>
            ))}
          </div>

          <label className="permission-box">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              I give permission to securely read transaction summaries from the selected bank for analytics on this
              dashboard.
            </span>
          </label>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={linkBank} disabled={linking}>
              {linking ? 'Linking bank...' : onboardingComplete ? 'Link selected bank again' : 'Link bank and continue'}
            </button>
            <button onClick={saveActiveBank} disabled={savingActive || !onboardingComplete}>
              {savingActive ? 'Saving...' : 'Set as active bank'}
            </button>
            <button onClick={() => navigate('/')}>
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
