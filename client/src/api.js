const BASE = import.meta.env.VITE_API_BASE || 'https://budgetbuddy-1-gp0s.onrender.com';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  async register(payload) {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    return res.json();
  },
  async login(payload) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    return res.json();
  },
  async me() {
    const res = await fetch(`${BASE}/api/auth/me`, { headers: { ...authHeader() } });
    return res.json();
  },
  async addExpense(payload) {
    const res = await fetch(`${BASE}/api/expenses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(payload)
    });
    return res.json();
  },
  async updateExpense(id, payload) {
    const res = await fetch(`${BASE}/api/expenses/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(payload)
    });
    return res.json();
  },
  async deleteExpense(id) {
    const res = await fetch(`${BASE}/api/expenses/${id}`, { method: 'DELETE', headers: { ...authHeader() } });
    return res.json();
  },
  async listByMonth(month, year) {
    const url = new URL(`${BASE}/api/expenses`);
    if (month && year) { url.searchParams.set('month', month); url.searchParams.set('year', year); }
    const res = await fetch(url, { headers: { ...authHeader() } });
    return res.json();
  },
  async summary(month, year) {
    const url = new URL(`${BASE}/api/expenses/summary`);
    url.searchParams.set('month', month);
    url.searchParams.set('year', year);
    const res = await fetch(url, { headers: { ...authHeader() } });
    return res.json();
  },
  async prevMonthSummary() {
    const res = await fetch(`${BASE}/api/expenses/summary/previous-month`, { headers: { ...authHeader() } });
    return res.json();
  }
};
