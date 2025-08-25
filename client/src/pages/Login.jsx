import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const res = await api.login(form);
    if (res.error) {
      setError(res.error);
      return;
    }
    localStorage.setItem("token", res.token);
    localStorage.setItem("name", res.user?.name || "");
    localStorage.setItem("email", res.user?.email || "");
    navigate("/");
  };

  return (
    <div className="grid" style={{ maxWidth: 420, margin: "40px auto" }}>
      <div className="card">
        <h2>Login</h2>
        <form onSubmit={submit} className="grid">
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
          <p style={{ marginTop: 10 }}>
            <Link to="/forgot">Forgot password?</Link>
          </p>

          {error && <div style={{ color: "#fca5a5" }}>{error}</div>}
          <button type="submit">Login</button>
        </form>
        <p style={{ marginTop: 10 }}>
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
