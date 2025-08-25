// import { useEffect, useMemo, useState } from "react";
// import { api } from "../api.js";
// import {
//   ResponsiveContainer,
//   PieChart,
//   Pie,
//   Tooltip,
//   Legend,
//   Cell,
// } from "recharts";

// const COLORS = ["#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];
// const LABELS = {
//   savings: "Savings",
//   food: "Food",
//   utilities: "Utilities",
//   rent: "Rent",
//   medicine: "Medicine",
// };

// export default function Monthly() {
//   const now = new Date();
//   const [month, setMonth] = useState(String(now.getMonth() + 1)); // 1-12
//   const [year, setYear] = useState(String(now.getFullYear()));
//   const [summary, setSummary] = useState({ total: 0, byType: [] });
//   const [items, setItems] = useState([]);

//   const years = useMemo(() => {
//     const y0 = now.getFullYear();
//     return Array.from({ length: 6 }, (_, i) => String(y0 - i));
//   }, [now]);
//   const refresh = async (m = month, y = year) => {
//     const s = await api.summary(m, y);
//     const l = await api.listByMonth(m, y);
//     setSummary(s?.error ? { total: 0, byType: [] } : s);
//     setItems(l?.items || []);
//   };
//   useEffect(() => {
//     refresh();
//   }, []);

//   return (
//     <div className="grid" style={{ gap: 24 }}>
//       <div className="card">
//         <h2>Monthly Expenditure</h2>
//         <div className="grid grid-2">
//           <div>
//             <label>Month</label>
//             <select value={month} onChange={(e) => setMonth(e.target.value)}>
//               {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
//                 <option key={m} value={m}>
//                   {m}
//                 </option>
//               ))}
//             </select>
//           </div>
//           <div>
//             <label>Year</label>
//             <select value={year} onChange={(e) => setYear(e.target.value)}>
//               {years.map((y) => (
//                 <option key={y} value={y}>
//                   {y}
//                 </option>
//               ))}
//             </select>
//           </div>
//         </div>
//         <button style={{ marginTop: 12 }} onClick={() => refresh(month, year)}>
//           View
//         </button>
//         <p style={{ marginTop: 8 }}>
//           Total: <strong>₹ {summary.total?.toLocaleString("en-IN")}</strong>
//         </p>
//         <div style={{ height: 320 }}>
//           <ResponsiveContainer>
//             <PieChart>
//               <Pie
//                 data={summary.byType || []}
//                 dataKey="total"
//                 nameKey="type"
//                 cx="50%"
//                 cy="50%"
//                 outerRadius={110}
//                 label={(e) => LABELS[e.type] || e.type}
//               >
//                 {(summary.byType || []).map((_, idx) => (
//                   <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
//                 ))}
//               </Pie>
//               <Tooltip
//                 formatter={(v, n, p) => [
//                   `₹ ${v}`,
//                   LABELS[p.payload.type] || p.payload.type,
//                 ]}
//               />
//               <Legend formatter={(v) => LABELS[v] || v} />
//             </PieChart>
//           </ResponsiveContainer>
//         </div>
//       </div>
//       <div className="card">
//         <h3>Items ({items.length})</h3>
//         <table className="table">
//           <thead>
//             <tr>
//               <th>Date</th>
//               <th>Name</th>
//               <th>Type</th>
//               <th>Amount (₹)</th>
//               <th>Notes</th>
//             </tr>
//           </thead>
//           <tbody>
//             {items.map((it) => (
//               <tr key={it._id}>
//                 <td>{new Date(it.date).toLocaleDateString("en-IN")}</td>
//                 <td>{it.name}</td>
//                 <td>{it.type}</td>
//                 <td>{it.amount}</td>
//                 <td>{it.notes || "-"}</td>
//               </tr>
//             ))}
//             {items.length === 0 && (
//               <tr>
//                 <td
//                   colSpan="5"
//                   style={{ color: "#a1a1aa", textAlign: "center", padding: 16 }}
//                 >
//                   No data
//                 </td>
//               </tr>
//             )}
//           </tbody>
//         </table>
//       </div>
//     </div>
//   );
// }



import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { ResponsiveContainer, PieChart, Pie, Tooltip, Legend, Cell } from 'recharts';

const COLORS = ['#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
const LABELS = { savings: 'Savings', food: 'Food', utilities: 'Utilities', rent: 'Rent', medicine: 'Medicine' };

export default function Monthly() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1)); // 1-12
  const [year, setYear] = useState(String(now.getFullYear()));
  const [summary, setSummary] = useState({ total: 0, byType: [] });
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', type: 'food', amount: 0, date: '', notes: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const years = useMemo(() => {
    const y0 = now.getFullYear();
    return Array.from({ length: 6 }, (_, i) => String(y0 - i));
  }, [now]);

  const refresh = async (m = month, y = year) => {
    const s = await api.summary(m, y);
    const l = await api.listByMonth(m, y);
    setSummary(s?.error ? { total: 0, byType: [] } : s);
    setItems(l?.items || []);
    setEditingId(null);
  };

  useEffect(() => { refresh(); }, []);

  const startEdit = (it) => {
    setEditingId(it._id);
    setEditForm({
      name: it.name,
      type: it.type,
      amount: it.amount,
      date: new Date(it.date).toISOString().slice(0,10),
      notes: it.notes || ''
    });
  };

  const saveEdit = async (id) => {
    setErr(''); setMsg('');
    const res = await api.updateExpense(id, { ...editForm, amount: Number(editForm.amount) });
    if (res.error) { setErr(res.error); return; }
    setMsg('Updated successfully');
    await refresh(month, year);
  };

  const cancelEdit = () => { setEditingId(null); };

  const del = async (id) => {
    if (!confirm('Delete this expense?')) return;
    setErr(''); setMsg('');
    const res = await api.deleteExpense(id);
    if (res.error) { setErr(res.error); return; }
    setMsg('Deleted');
    await refresh(month, year);
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="card">
        <h2>Monthly Expenditure</h2>
        <div className="grid grid-2">
          <div>
            <label>Month</label>
            <select value={month} onChange={e => setMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label>Year</label>
            <select value={year} onChange={e => setYear(e.target.value)}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <button style={{ marginTop: 12 }} onClick={() => refresh(month, year)}>View</button>
        <p style={{ marginTop: 8 }}>Total: <strong>₹ {summary.total?.toLocaleString('en-IN')}</strong></p>
        <div style={{ height: 320 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={summary.byType || []} dataKey="total" nameKey="type" cx="50%" cy="50%" outerRadius={110} label={(e) => LABELS[e.type] || e.type}>
                {(summary.byType || []).map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n, p) => [`₹ ${v}`, LABELS[p.payload.type] || p.payload.type]} />
              <Legend formatter={(v) => LABELS[v] || v} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3>Items ({items.length})</h3>
          <div>{err && <span style={{ color:'#fca5a5' }}>{err}</span>} {msg && <span style={{ color:'#86efac' }}>{msg}</span>}</div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Type</th>
              <th>Amount (₹)</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it._id}>
                <td>
                  {editingId === it._id ? (
                    <input className="input" type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
                  ) : (
                    new Date(it.date).toLocaleDateString('en-IN')
                  )}
                </td>
                <td>
                  {editingId === it._id ? (
                    <input className="input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                  ) : (
                    it.name
                  )}
                </td>
                <td>
                  {editingId === it._id ? (
                    <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
                      {Object.keys(LABELS).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    it.type
                  )}
                </td>
                <td>
                  {editingId === it._id ? (
                    <input className="input" type="number" min="0" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} />
                  ) : (
                    it.amount
                  )}
                </td>
                <td>
                  {editingId === it._id ? (
                    <input className="input" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                  ) : (
                    it.notes || '-'
                  )}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {editingId === it._id ? (
                    <>
                      <button onClick={() => saveEdit(it._id)}>Save</button>{' '}
                      <button onClick={cancelEdit}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(it)}>Edit</button>{' '}
                      <button onClick={() => del(it._id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan="6" style={{ color: '#a1a1aa', textAlign: 'center', padding: 16 }}>No data</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
