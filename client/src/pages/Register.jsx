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
import { useRef, useState } from "react";
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
  const captchaRef = useRef(null);
  const navigate = useNavigate();
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setOk("");

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (!name || !email || !password) return setError("All fields are required.");
    if (!GMAIL_RE.test(email)) return setError("Email must be a valid @gmail.com address.");
    if (!PASSWORD_RE.test(password)) {
      return setError("Password must start with one capital letter, include a number & symbol, contain no spaces, only the first letter uppercase, and be at least 8 characters.");
    }

    const captchaToken = await captchaRef.current.executeAsync();
    captchaRef.current.reset();

    setLoading(true);
    const res = await api.register({ name, email, password, captchaToken });
    setLoading(false);

    if (res?.error) return setError(res.error);
    setOk("Registered successfully! Redirecting to login…");
    setTimeout(() => navigate("/login"), 800);
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

          <ReCAPTCHA
            sitekey={siteKey}
            size="invisible"
            ref={captchaRef}
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
