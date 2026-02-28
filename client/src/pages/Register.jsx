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



import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";

const PASSWORD_RE = /^(?=.{8,})(?=.*\d)(?=.*[^A-Za-z0-9\s])[A-Z](?!.*[A-Z])[^\s]+$/;
const GMAIL_RE = /^[a-z0-9._%+-]+@gmail\.com$/i;

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaProof, setCaptchaProof] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const loadCaptcha = async () => {
    setCaptchaLoading(true);
    try {
      const res = await api.captcha();
      if (res?.error || !res?.captchaImage || !res?.captchaProof) {
        if (res?.status === 404) {
          setError("Captcha endpoint not found on backend. Restart/redeploy backend.");
        } else if (res?.status >= 500) {
          setError("Captcha service is down on backend. Please try again.");
        } else {
          setError(res?.error || "Unable to load captcha.");
        }
        setCaptchaImage("");
        setCaptchaProof("");
        return;
      }
      setError("");
      setCaptchaImage(res.captchaImage);
      setCaptchaProof(res.captchaProof);
      setCaptchaInput("");
    } catch {
      setError("Unable to load captcha.");
      setCaptchaImage("");
      setCaptchaProof("");
    } finally {
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setOk("");

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
    if (!captchaProof || !captchaImage) return setError("Captcha is unavailable. Please refresh captcha.");
    if (!captchaInput.trim()) return setError("Please enter captcha text.");

    setLoading(true);
    try {
      const res = await api.register({ name, email, password, captchaInput, captchaProof });
      if (res?.error) {
        const suffix = res.details || res.code ? ` (${res.details || res.code})` : "";
        setError(`${res.error}${suffix}`);
        await loadCaptcha();
        return;
      }
      setOk("Registered successfully! Redirecting to login…");
      setTimeout(() => navigate("/login"), 800);
    } catch (err) {
      console.error("Register request error:", err);
      const msg = String(err?.message || "");
      if (msg.toLowerCase().includes("captcha")) {
        setError(msg);
      } else {
        setError("Network/CORS error. Check console.");
      }
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

          <div className="grid" style={{ gap: 8 }}>
            <label htmlFor="captchaInput">Enter the text shown below</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {captchaImage ? (
                <img
                  src={captchaImage}
                  alt="Captcha"
                  style={{ border: "1px solid #bdd4ff", borderRadius: 8, height: 52, maxWidth: "100%" }}
                />
              ) : (
                <div className="helper-text">Captcha unavailable</div>
              )}
              <button type="button" onClick={loadCaptcha} disabled={captchaLoading || loading}>
                {captchaLoading ? "Loading..." : "Refresh"}
              </button>
            </div>
            <input
              id="captchaInput"
              className="input"
              placeholder="Type captcha text"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
            />
          </div>

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
