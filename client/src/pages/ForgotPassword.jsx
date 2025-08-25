import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setMsg("");
    const res = await api.forgotPassword({ email });
    if (res.error) return setError(res.error);
    setMsg("If the email exists, an OTP has been sent.");
    // redirect to the OTP page with email in state/query
    navigate(`/reset?email=${encodeURIComponent(email)}`);
  };

  return (
    <div className="grid" style={{ maxWidth: 420, margin: "40px auto" }}>
      <div className="card">
        <h2>Forgot Password</h2>
        <form onSubmit={submit} className="grid">
          <input className="input" placeholder="Your email" type="email"
            value={email} onChange={(e)=>setEmail(e.target.value)} />
          {error && <div style={{ color:"#fca5a5" }}>{error}</div>}
          {msg && <div style={{ color:"#34d399" }}>{msg}</div>}
          <button type="submit">Send OTP</button>
        </form>
      </div>
    </div>
  );
}
