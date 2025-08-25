import { useState } from "react";
import { api } from "../api.js";

const TYPES = ["Savings", "Food", "Utilities", "Rent", "Medicine"];

const NORMALIZE = {
  savings: "Savings",
  food: "Food",
  utilities: "Utilities",
  rent: "Rent",
  medicine: "Medicine",
};

export default function AddExpense() {
  const [form, setForm] = useState({
    name: "",
    type: "Food",
    amount: "",
    date: "",
    notes: "",
  });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    const name = form.name.trim();
    const amountNum = Number(form.amount);

    if (!name) return setErr("Name is required.");
    if (!Number.isFinite(amountNum) || amountNum <= 0)
      return setErr("Enter a valid amount.");

    const normalized =
      NORMALIZE[String(form.type).trim().toLowerCase()] ?? null;

    if (!normalized || !TYPES.includes(normalized)) {
      return setErr("Choose a valid type.");
    }

    const payload = {
      name,
      type: normalized,        
      category: normalized,    
      amount: amountNum,
      notes: form.notes.trim(),
    };
    if (form.date) {
      payload.date = form.date;
    }


    const res = await api.addExpense(payload);

    if (res?.error) {
      setErr(res.error);
      return;
    }

    setMsg("Expense added!");
    setForm({ name: "", type: "Food", amount: "", date: "", notes: "" });
  };

  return (
    <div className="grid" style={{ maxWidth: 640, margin: "20px auto" }}>
      <div className="card">
        <h2>Add Expenditure</h2>
        <form onSubmit={submit} className="grid">
          <input
            className="input"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Amount (₹)"
            type="number"
            min="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <input
            className="input"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <input
            className="input"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          {err && <div style={{ color: "#fca5a5" }}>{err}</div>}
          {msg && <div style={{ color: "#86efac" }}>{msg}</div>}
          <button type="submit">Save</button>
        </form>
      </div>
    </div>
  );
}

