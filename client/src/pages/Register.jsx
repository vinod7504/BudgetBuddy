// import { useState } from "react";
// import { Link, useNavigate } from "react-router-dom";
// import { api } from "../api.js";

// export default function Register() {
//   const [form, setForm] = useState({ name: "", email: "", password: "" });
//   const [error, setError] = useState("");
//   const navigate = useNavigate();

//   const submit = async (e) => {
//     e.preventDefault();
//     setError("");
//     const res = await api.register(form);
//     if (res.error) {
//       setError(res.error);
//       return;
//     }
//     navigate("/login");
//   };

//   return (
//     <div className="grid" style={{ maxWidth: 420, margin: "40px auto" }}>
//       <div className="card">
//         <h2>Register</h2>
//         <form onSubmit={submit} className="grid">
//           <input
//             className="input"
//             placeholder="Name"
//             value={form.name}
//             onChange={(e) => setForm({ ...form, name: e.target.value })}
//           />
//           <input
//             className="input"
//             placeholder="Email"
//             type="email"
//             value={form.email}
//             onChange={(e) => setForm({ ...form, email: e.target.value })}
//           />
//           <input
//             className="input"
//             placeholder="Password"
//             type="password"
//             value={form.password}
//             onChange={(e) => setForm({ ...form, password: e.target.value })}
//           />
//           {error && <div style={{ color: "#fca5a5" }}>{error}</div>}
//           <button type="submit">Create Account</button>
//         </form>
//         <p style={{ marginTop: 10 }}>
//           Already have an account? <Link to="/login">Login</Link>
//         </p>
//       </div>
//     </div>
//   );
// }




// Changed

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import { api } from "../api.js";

const PASSWORD_RE = /^(?=.{8,})(?=.*\d)(?=.*[^A-Za-z0-9\s])[A-Z](?!.*[A-Z])[^\s]+$/;
const GMAIL_RE = /^[a-z0-9._%+-]+@gmail\.com$/i;

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const captchaRef = useRef(null);
  const navigate = useNavigate();
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  useEffect(() => {
    // basic visibility / diagnostics
    if (!siteKey) {
      setError("Captcha not configured: missing VITE_RECAPTCHA_SITE_KEY in client .env");
    }
  }, [siteKey]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (!name || !email || !password) return setError("All fields are required.");
    if (!GMAIL_RE.test(email)) return setError("Email must be a valid @gmail.com address.");
    if (!PASSWORD_RE.test(password)) {
      return setError(
        "Password must start with one capital letter, include a number & symbol, contain no spaces, only the first letter uppercase, and be at least 8 characters."
      );
    }

    if (!siteKey) {
      return setError("Captcha not configured. Please contact support.");
    }

    if (!captchaRef.current || !widgetReady) {
      return setError("Captcha not ready. Please wait a second and try again.");
    }

    let captchaToken = "";
    try {
      captchaToken = await captchaRef.current.executeAsync();
      captchaRef.current.reset();
    } catch (err) {
      console.error("Captcha execute failed:", err);
      return setError("Captcha failed. Please reload the page and try again.");
    }

    setLoading(true);
    try {
      const res = await api.register({ name, email, password, captchaToken });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOk("Registered successfully! Redirecting to login…");
      setTimeout(() => navigate("/login"), 800);
    } catch (err) {
      console.error("Register request error:", err);
      setError("Network/CORS error. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid" style={{ maxWidth: 420, margin: "40px auto" }}>
      <div className="card">
        <h2>Register</h2>
        <form onSubmit={submit} className="grid">
          <input
            className="input"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="input"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="input"
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          {/* reCAPTCHA (invisible). Will render even if siteKey is empty, but we gate onSubmit */}
          <ReCAPTCHA
            sitekey={siteKey || "invalid-site-key-placeholder"}
            size="invisible"
            ref={captchaRef}
            // onChange fires when a token is generated (invisible mode)
            onErrored={() => setError("Captcha error. Reload and try again.")}
            onExpired={() => setError("Captcha expired. Please submit again.")}
            onLoad={() => setWidgetReady(true)}
          />

          {error && <div style={{ color: "#fca5a5" }}>{error}</div>}
          {ok && <div style={{ color: "#34d399" }}>{ok}</div>}
          <button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create Account"}
          </button>
        </form>

        <p style={{ marginTop: 10 }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
