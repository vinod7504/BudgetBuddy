import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";

function useQuery() {
  const { search } = useLocation();
  return new URLSearchParams(search);
}

export default function ResetPassword() {
  const q = useQuery();
  const [email, setEmail] = useState(q.get("email") || "");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (q.get("email") && !email) setEmail(q.get("email"));
  }, []);

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError(""); setOk("");
    const res = await api.verifyResetOtp({ email, otp });
    if (res.error) return setError(res.error);
    setResetToken(res.resetToken);
    setStep(2);
  };

  const resetPwd = async (e) => {
    e.preventDefault();
    setError(""); setOk("");
    const res = await api.resetPassword({ resetToken, newPassword });
    if (res.error) return setError(res.error);
    setOk("Password updated. You can login now.");
    setTimeout(()=> navigate("/login"), 1200);
  };

  return (
    <div className="grid" style={{ maxWidth: 420, margin: "40px auto" }}>
      <div className="card">
        <h2>Reset Password</h2>

        {step === 1 && (
          <form onSubmit={verifyOtp} className="grid">
            <input className="input" placeholder="Email" type="email"
              value={email} onChange={(e)=>setEmail(e.target.value)} />
            <input className="input" placeholder="6-digit OTP"
              value={otp} onChange={(e)=>setOtp(e.target.value)} />
            {error && <div style={{ color:"#fca5a5" }}>{error}</div>}
            <button type="submit">Verify OTP</button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={resetPwd} className="grid">
            <input className="input" placeholder="New password" type="password"
              value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} />
            {error && <div style={{ color:"#fca5a5" }}>{error}</div>}
            {ok && <div style={{ color:"#34d399" }}>{ok}</div>}
            <button type="submit">Update Password</button>
          </form>
        )}
      </div>
    </div>
  );
}
