import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

// same rules as backend:
// start with ONE capital letter (and only that capital),
// include at least one number and one symbol,
// no spaces, min length 8
const PASSWORD_RE = /^(?=.{8,})(?=.*\d)(?=.*[^A-Za-z0-9\s])[A-Z](?!.*[A-Z])[^\s]+$/;

export default function ResetPassword() {
  const q = useQuery();
  const [email, setEmail] = useState(q.get("email")?.toLowerCase() || "");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // keep email from query if user navigated with ?email=
  useEffect(() => {
    const e = q.get("email");
    if (e && !email) setEmail(String(e).toLowerCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError(""); setOk(""); setLoading(true);

    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanOtp = String(otp || "").trim();

    if (!cleanEmail || !cleanOtp) {
      setLoading(false);
      return setError("Email and OTP are required.");
    }
    if (!/^\d{6}$/.test(cleanOtp)) {
      setLoading(false);
      return setError("OTP must be a 6-digit code.");
    }

    const res = await api.verifyResetOtp({ email: cleanEmail, otp: cleanOtp });
    setLoading(false);

    if (res?.error) return setError(res.error);
    if (!res?.resetToken) return setError("No reset token received. Please request OTP again.");

    setResetToken(res.resetToken);
    setStep(2);
  };

  const resetPwd = async (e) => {
    e.preventDefault();
    setError(""); setOk(""); setLoading(true);

    const pwd = String(newPassword || "").trim();
    if (!pwd) {
      setLoading(false);
      return setError("New password is required.");
    }
    if (!PASSWORD_RE.test(pwd)) {
      setLoading(false);
      return setError("Password must start with one capital letter, include a number & a symbol, have no spaces, and be at least 8 characters. Only the first letter can be uppercase.");
    }
    if (!resetToken) {
      setLoading(false);
      return setError("Missing or expired reset token. Please verify OTP again.");
    }

    const res = await api.resetPassword({ resetToken, newPassword: pwd });
    setLoading(false);

    if (res?.error) return setError(res.error);
    setOk(res?.message || "Password updated. You can log in now.");
    setTimeout(() => navigate("/login"), 1200);
  };

  return (
    <div className="grid" style={{ maxWidth: 420, margin: "40px auto" }}>
      <div className="card">
        <h2>Reset Password</h2>

        {step === 1 && (
          <form onSubmit={verifyOtp} className="grid">
            <input
              className="input"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              autoComplete="email"
              required
            />
            <input
              className="input"
              placeholder="6-digit OTP"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />

            {error && <div style={{ color: "#fca5a5" }}>{error}</div>}
            {ok && <div style={{ color: "#34d399" }}>{ok}</div>}

            <button type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={resetPwd} className="grid">
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="New password"
                type={showPwd ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                style={{ minWidth: 90 }}
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>

            <small style={{ color: "#9ca3af" }}>
              Must start with one capital letter, include a number & symbol, no spaces, min 8 chars.
            </small>

            {error && <div style={{ color: "#fca5a5" }}>{error}</div>}
            {ok && <div style={{ color: "#34d399" }}>{ok}</div>}

            <button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              style={{ marginTop: 8 }}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
