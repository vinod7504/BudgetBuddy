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



import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function Register() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const requestOtp = async (e) => {
    e.preventDefault();
    setError("");
    const res = await api.registerRequestOtp(form);
    if (res.error) return setError(res.error);
    setStep(2);
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    const res = await api.registerVerify({ email: form.email, otp });
    if (res.error) return setError(res.error);
    navigate("/login");
  };

  return (
    <div className="grid" style={{ maxWidth: 420, margin: "40px auto" }}>
      <div className="card">
        <h2>Register</h2>

        {step === 1 && (
          <form onSubmit={requestOtp} className="grid">
            <input className="input" placeholder="Name"
              value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})}/>
            <input className="input" placeholder="Email" type="email"
              value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})}/>
            <input className="input" placeholder="Password" type="password"
              value={form.password} onChange={(e)=>setForm({...form, password:e.target.value})}/>
            {error && <div style={{ color: "#fca5a5" }}>{error}</div>}
            <button type="submit">Send OTP</button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={verifyOtp} className="grid">
            <p>We sent an OTP to <b>{form.email}</b>. Enter it below:</p>
            <input className="input" placeholder="6-digit OTP"
              value={otp} onChange={(e)=>setOtp(e.target.value)} />
            {error && <div style={{ color: "#fca5a5" }}>{error}</div>}
            <button type="submit">Verify & Create Account</button>
            <button type="button" onClick={()=>setStep(1)} style={{ marginTop: 8 }}>Back</button>
          </form>
        )}

        <p style={{ marginTop: 10 }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
