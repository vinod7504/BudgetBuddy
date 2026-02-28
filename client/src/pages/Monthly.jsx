import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { ResponsiveContainer, PieChart, Pie, Tooltip, Legend, Cell } from 'recharts';

const COLORS = ['#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
const DEFAULT_TYPES = ['Savings', 'Food', 'Utilities', 'Rent', 'Medicine'];
const PAGE_SIZE = 15;

function normalizeCategory(value) {
  const cleaned = String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 48);

  if (!cleaned) return '';
  return cleaned
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function Monthly() {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1)); // 1-12
  const [year, setYear] = useState(String(now.getFullYear()));
  const [summary, setSummary] = useState({ total: 0, byType: [] });
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_TYPES);
  const [meta, setMeta] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: PAGE_SIZE,
    hasPrev: false,
    hasNext: false
  });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', type: 'Food', amount: 0, date: '', notes: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const years = useMemo(() => {
    const y0 = now.getFullYear();
    return Array.from({ length: 6 }, (_, i) => String(y0 - i));
  }, [now]);
  const pieData = useMemo(
    () => (summary.byType || []).filter((item) => Number(item.total) > 0),
    [summary.byType]
  );

  const loadData = async ({ m = month, y = year, p = meta.page, q = query } = {}) => {
    setErr('');
    setLoading(true);
    try {
      const [s, l, c] = await Promise.all([
        api.summary(m, y),
        api.listByMonth(m, y, { page: p, limit: PAGE_SIZE, q, sortBy: 'date', sortOrder: 'desc' }),
        api.expenseCategories()
      ]);

      setSummary(s?.error ? { total: 0, byType: [] } : s);
      if (Array.isArray(c?.categories) && c.categories.length > 0) {
        setCategories(c.categories);
      }

      if (l?.error) {
        setErr(l.error);
        setItems([]);
        setMeta({ page: 1, pages: 1, total: 0, limit: PAGE_SIZE, hasPrev: false, hasNext: false });
      } else {
        setItems(l?.items || []);
        setMeta({
          page: Number(l?.page || p || 1),
          pages: Number(l?.pages || 1),
          total: Number(l?.total || 0),
          limit: Number(l?.limit || PAGE_SIZE),
          hasPrev: Boolean(l?.hasPrev),
          hasNext: Boolean(l?.hasNext)
        });
      }
      setEditingId(null);
    } catch {
      setErr('Failed to fetch monthly data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData({ p: 1, q: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runView = async () => {
    const nextQuery = queryInput.trim();
    setQuery(nextQuery);
    await loadData({ m: month, y: year, p: 1, q: nextQuery });
  };

  const goPage = async (nextPage) => {
    await loadData({ p: nextPage });
  };

  const startEdit = (it) => {
    setEditingId(it._id);
    setEditForm({
      name: it.name,
      type: it.type,
      amount: it.amount,
      date: new Date(it.date).toISOString().slice(0, 10),
      notes: it.notes || ''
    });
  };

  const saveEdit = async (id) => {
    setErr('');
    setMsg('');
    const category = normalizeCategory(editForm.type);
    if (!category) {
      setErr('Category cannot be empty.');
      return;
    }

    const res = await api.updateExpense(id, { ...editForm, type: category, amount: Number(editForm.amount) });
    if (res.error) {
      setErr(res.error);
      return;
    }
    if (!categories.includes(category)) {
      setCategories((prev) => [...prev, category]);
    }
    setMsg('Updated successfully');
    await loadData();
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const del = async (id) => {
    if (!confirm('Delete this expense?')) return;
    setErr('');
    setMsg('');
    const res = await api.deleteExpense(id);
    if (res.error) {
      setErr(res.error);
      return;
    }

    const targetPage = items.length === 1 && meta.page > 1 ? meta.page - 1 : meta.page;
    setMsg('Deleted');
    await loadData({ p: targetPage });
  };

  const escapeCsv = (val) => {
    const str = String(val ?? '');
    return `"${str.replace(/"/g, '""')}"`;
  };

  const exportCsv = () => {
    if (items.length === 0) {
      setErr('No items to export on this page.');
      return;
    }
    const header = ['Date', 'Name', 'Type', 'Amount', 'Notes'];
    const rows = items.map((it) => [
      new Date(it.date).toLocaleDateString('en-IN'),
      it.name,
      it.type,
      it.amount,
      it.notes || ''
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${year}-${month}-page-${meta.page}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid" style={{ gap: 24 }}>
      <div className="card">
        <h2>Monthly Expenditure</h2>
        <div className="grid grid-2">
          <div>
            <label>Month</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Year</label>
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button onClick={runView} disabled={loading}>
            {loading ? 'Loading...' : 'View'}
          </button>
          <input
            className="input"
            style={{ width: 'min(100%, 260px)' }}
            placeholder="Search name/type/notes"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
          />
          <button onClick={runView} disabled={loading}>
            Search
          </button>
          <button
            onClick={async () => {
              setQueryInput('');
              setQuery('');
              await loadData({ p: 1, q: '' });
            }}
            disabled={loading}
          >
            Clear
          </button>
        </div>

        <p style={{ marginTop: 8 }}>
          Total: <strong>₹ {summary.total?.toLocaleString('en-IN')}</strong>
        </p>
        <div style={{ height: 320 }}>
          {pieData.length > 0 ? (
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="total"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  label={false}
                  labelLine={false}
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, _n, p) => [`₹ ${v}`, p.payload.type]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
              <p className="helper-text">No non-zero category data for selected month.</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h3>
            Items ({items.length}/{meta.total})
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="helper-text">Page {meta.page} of {meta.pages}</span>
            <button onClick={() => goPage(meta.page - 1)} disabled={!meta.hasPrev || loading}>
              Prev
            </button>
            <button onClick={() => goPage(meta.page + 1)} disabled={!meta.hasNext || loading}>
              Next
            </button>
            <button onClick={exportCsv}>Export CSV</button>
          </div>
        </div>

        <div>
          {err && <span style={{ color: '#dc2626' }}>{err}</span>} {msg && <span style={{ color: '#059669' }}>{msg}</span>}
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
                    <input className="input" type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
                  ) : (
                    new Date(it.date).toLocaleDateString('en-IN')
                  )}
                </td>
                <td>
                  {editingId === it._id ? (
                    <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  ) : (
                    it.name
                  )}
                </td>
                <td>
                  {editingId === it._id ? (
                    <input
                      className="input"
                      list="expense-categories"
                      value={editForm.type}
                      onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    />
                  ) : (
                    it.type
                  )}
                </td>
                <td>
                  {editingId === it._id ? (
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={editForm.amount}
                      onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                    />
                  ) : (
                    it.amount
                  )}
                </td>
                <td>
                  {editingId === it._id ? (
                    <input className="input" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
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
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan="6" style={{ color: '#64748b', textAlign: 'center', padding: 16 }}>
                  No data
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan="6" style={{ color: '#334155', textAlign: 'center', padding: 16 }}>
                  Loading...
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <datalist id="expense-categories">
          {categories.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
