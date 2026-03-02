import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

const DEFAULT_TYPES = ["Savings", "Food", "Utilities", "Rent", "Medicine"];
const CUSTOM_MARKER = "__custom__";

function normalizeCategory(value) {
  const cleaned = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 48);

  if (!cleaned) return "";
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function AddExpense() {
  const [form, setForm] = useState({
    name: "",
    type: "Food",
    amount: "",
    date: "",
    notes: "",
  });
  const [customType, setCustomType] = useState("");
  const [categories, setCategories] = useState(DEFAULT_TYPES);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await api.expenseCategories();
      if (Array.isArray(res?.categories) && res.categories.length > 0) {
        setCategories(res.categories);
      }
    })();
  }, []);

  const selectedType = useMemo(() => {
    if (form.type !== CUSTOM_MARKER) return form.type;
    return normalizeCategory(customType);
  }, [form.type, customType]);

  const addCategory = async () => {
    setMsg("");
    setErr("");
    const category = normalizeCategory(customType);
    if (!category) {
      setErr("Enter a category name.");
      return;
    }

    setSavingCategory(true);
    try {
      const res = await api.addExpenseCategory(category);
      if (res?.error) {
        setErr(res.error);
        return;
      }

      if (Array.isArray(res?.categories) && res.categories.length > 0) {
        setCategories(res.categories);
      } else if (!categories.includes(category)) {
        setCategories((prev) => [...prev, category]);
      }

      setForm((prev) => ({ ...prev, type: category }));
      setCustomType("");
      setMsg(`Category "${category}" added.`);
    } catch {
      setErr("Failed to add category. Please try again.");
    } finally {
      setSavingCategory(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    const name = form.name.trim();
    const amountNum = Number(form.amount);
    const category = normalizeCategory(selectedType);

    if (!name) return setErr("Name is required.");
    if (!category) return setErr("Choose or enter a category.");
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return setErr("Enter a valid amount.");
    }

    const payload = {
      name,
      type: category,
      amount: amountNum,
      notes: form.notes.trim(),
    };
    if (form.date) payload.date = form.date;

    const res = await api.addExpense(payload);
    if (res?.error) {
      setErr(res.error);
      return;
    }

    setMsg("Expense added!");
    setForm({ name: "", type: "Food", amount: "", date: "", notes: "" });
    setCustomType("");

    if (!categories.includes(category)) {
      setCategories((prev) => [...prev, category]);
    }
  };

  return (
    <div className="grid" style={{ maxWidth: 680, margin: "20px auto" }}>
      <div className="card">
        <h2>Add Expenditure</h2>
        <form onSubmit={submit} className="grid">
          <input
            className="input"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <div className="grid" style={{ gap: 8 }}>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {categories.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value={CUSTOM_MARKER}>+ Add New Category</option>
            </select>
            {form.type === CUSTOM_MARKER && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="input"
                  style={{ flex: "1 1 280px" }}
                  placeholder="Enter new category (e.g. Travel, Shopping)"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                />
                <button type="button" onClick={addCategory} disabled={savingCategory}>
                  {savingCategory ? "Adding..." : "Add Category"}
                </button>
              </div>
            )}
          </div>

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
