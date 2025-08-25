import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

const GMAIL_RE = /^[a-z0-9._%+-]+@gmail\.com$/i;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) return setError("Email is required.");
    if (!GMAIL_RE.test(cleanEmail)) {
      return setError("Email must be a valid @gmail.com address.");
    }

    setLoading(true);
    try {
      const res = await api.forgotPassword({ email: cleanEmail });
      if (res?.error) {
        // backend now returns helpful message in dev if email send failed
        setError(res.error);
        return;
      }
      setMsg("If the email exists, an OTP has been sent.");
      // small delay so the user sees the message before redirect
      setTimeout(() => {
        navigate(`/reset?email=${encodeURIComponent(cleanEmail)}`);
      }, 600);
    } catch (err) {
      console.error("Forgot password request failed:", err);
      setError("Network/CORS error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid" style={{ maxWidth: 420, margin: "40px auto" }}>
      <div className="card">
        <h2>Forgot Password</h2>
        <form onSubmit={submit} className="grid">
          <input
            className="input"
            placeholder="Your email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {error && <div style={{ color: "#fca5a5" }}>{error}</div>}
          {msg && <div style={{ color: "#34d399" }}>{msg}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </form>
      </div>
    </div>
  );
}
