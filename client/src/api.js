// const BASE = import.meta.env.VITE_API_BASE || 'https://budgetbuddy-1-gp0s.onrender.com';

// function authHeader() {
//   const token = localStorage.getItem('token');
//   return token ? { Authorization: `Bearer ${token}` } : {};
// }

// export const api = {
//   async register(payload) {
//     const res = await fetch(`${BASE}/api/auth/register`, {
//       method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
//     });
//     return res.json();
//   },
//   async login(payload) {
//     const res = await fetch(`${BASE}/api/auth/login`, {
//       method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
//     });
//     return res.json();
//   },
//   async me() {
//     const res = await fetch(`${BASE}/api/auth/me`, { headers: { ...authHeader() } });
//     return res.json();
//   },
//   async addExpense(payload) {
//     const res = await fetch(`${BASE}/api/expenses`, {
//       method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(payload)
//     });
//     return res.json();
//   },
//   async updateExpense(id, payload) {
//     const res = await fetch(`${BASE}/api/expenses/${id}`, {
//       method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(payload)
//     });
//     return res.json();
//   },
//   async deleteExpense(id) {
//     const res = await fetch(`${BASE}/api/expenses/${id}`, { method: 'DELETE', headers: { ...authHeader() } });
//     return res.json();
//   },
//   async listByMonth(month, year) {
//     const url = new URL(`${BASE}/api/expenses`);
//     if (month && year) { url.searchParams.set('month', month); url.searchParams.set('year', year); }
//     const res = await fetch(url, { headers: { ...authHeader() } });
//     return res.json();
//   },
//   async summary(month, year) {
//     const url = new URL(`${BASE}/api/expenses/summary`);
//     url.searchParams.set('month', month);
//     url.searchParams.set('year', year);
//     const res = await fetch(url, { headers: { ...authHeader() } });
//     return res.json();
//   },
//   async prevMonthSummary() {
//     const res = await fetch(`${BASE}/api/expenses/summary/previous-month`, { headers: { ...authHeader() } });
//     return res.json();
//   }
// };



const BASE = import.meta.env.VITE_API_BASE || 'https://budgetbuddy-1-gp0s.onrender.com';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function jfetch(url, opts = {}) {
  const res = await fetch(url, opts);
  // keep behavior similar to your current code (always .json())
  // but guard against empty bodies on 204 etc.
  try { return await res.json(); } catch { return { ok: res.ok, status: res.status }; }
}

export const api = {
  // ---------- AUTH (existing) ----------
  async register(payload) {
    // legacy direct register (kept for compatibility)
    return jfetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async login(payload) {
    return jfetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async me() {
    return jfetch(`${BASE}/api/auth/me`, { headers: { ...authHeader() } });
  },

  // ---------- AUTH (new: OTP REGISTRATION) ----------
  async registerRequestOtp(payload /* { name, email, password } */) {
    return jfetch(`${BASE}/api/auth/register/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async registerVerify(payload /* { email, otp } */) {
    return jfetch(`${BASE}/api/auth/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  // ---------- AUTH (new: FORGOT PASSWORD FLOW) ----------
  async forgotPassword(payload /* { email } */) {
    return jfetch(`${BASE}/api/auth/password/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async verifyResetOtp(payload /* { email, otp } */) {
    return jfetch(`${BASE}/api/auth/password/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  async resetPassword(payload /* { resetToken, newPassword } */) {
    return jfetch(`${BASE}/api/auth/password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  // ---------- EXPENSES (existing) ----------
  async addExpense(payload) {
    return jfetch(`${BASE}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(payload)
    });
  },

  async updateExpense(id, payload) {
    return jfetch(`${BASE}/api/expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(payload)
    });
  },

  async deleteExpense(id) {
    return jfetch(`${BASE}/api/expenses/${id}`, {
      method: 'DELETE',
      headers: { ...authHeader() }
    });
  },

  async listByMonth(month, year) {
    const url = new URL(`${BASE}/api/expenses`);
    if (month && year) {
      url.searchParams.set('month', month);
      url.searchParams.set('year', year);
    }
    return jfetch(url, { headers: { ...authHeader() } });
  },

  async summary(month, year) {
    const url = new URL(`${BASE}/api/expenses/summary`);
    url.searchParams.set('month', month);
    url.searchParams.set('year', year);
    return jfetch(url, { headers: { ...authHeader() } });
  },

  async prevMonthSummary() {
    return jfetch(`${BASE}/api/expenses/summary/previous-month`, {
      headers: { ...authHeader() }
    });
  }
};
