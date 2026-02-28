import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Legend,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { api } from '../api.js';

const CHART_COLORS = ['#155dfc', '#3b82f6', '#0ea5e9', '#0284c7', '#38bdf8', '#1d4ed8'];
const LABELS = {
  savings: 'Savings',
  food: 'Food',
  utilities: 'Utilities',
  rent: 'Rent',
  medicine: 'Medicine'
};

function labelForType(value) {
  const key = String(value || '').toLowerCase();
  return LABELS[key] || value;
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export default function Home() {
  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
  const [prevData, setPrevData] = useState({ month: 0, year: 0, total: 0, byType: [] });
  const [currData, setCurrData] = useState({ month: 0, year: 0, total: 0, byType: [] });
  const [insights, setInsights] = useState(null);
  const [insightsError, setInsightsError] = useState('');
  const [bankState, setBankState] = useState({
    loading: true,
    complete: false,
    activeBank: null,
    linkedBanks: [],
    error: ''
  });
  const [bankAnalysis, setBankAnalysis] = useState(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [budget, setBudget] = useState(0);
  const [budgetMsg, setBudgetMsg] = useState('');

  const currentPieData = useMemo(
    () => (currData.byType || []).filter((item) => Number(item.total) > 0),
    [currData.byType]
  );
  const previousPieData = useMemo(
    () => (prevData.byType || []).filter((item) => Number(item.total) > 0),
    [prevData.byType]
  );

  const budgetStorageKey = useMemo(() => {
    if (!currData.month || !currData.year) return '';
    const email = localStorage.getItem('email') || 'user';
    return `budget:${email}:${currData.year}-${currData.month}`;
  }, [currData.month, currData.year]);

  const currentSpend = Number(currData.total || 0);
  const budgetUsedPct = budget > 0 ? round2((currentSpend / budget) * 100) : 0;
  const budgetRemaining = budget > 0 ? round2(Math.max(0, budget - currentSpend)) : 0;
  const projectedMonthEnd = Number(insights?.totals?.projectedMonthEnd || 0);
  const projectedGap = budget > 0 ? round2(projectedMonthEnd - budget) : 0;

  useEffect(() => {
    if (!budgetStorageKey) return;

    const saved = Number(localStorage.getItem(budgetStorageKey) || 0);
    if (Number.isFinite(saved) && saved > 0) {
      setBudget(saved);
      setBudgetInput(String(saved));
    } else {
      setBudget(0);
      setBudgetInput('');
    }
    setBudgetMsg('');
  }, [budgetStorageKey]);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const [prev, curr, ins] = await Promise.all([
          api.prevMonthSummary(),
          api.summary(month, year),
          api.insights(month, year, 6)
        ]);

        setPrevData(prev?.error ? { month: 0, year: 0, total: 0, byType: [] } : prev);
        setCurrData(curr?.error ? { month, year, total: 0, byType: [] } : { ...curr, month, year });

        if (ins?.error) {
          setInsights(null);
          setInsightsError(ins.error);
        } else {
          setInsights(ins);
          setInsightsError('');
        }

        try {
          const status = await api.bankStatus();
          if (status?.error) {
            localStorage.setItem('bankOnboarded', 'false');
            setBankState({
              loading: false,
              complete: false,
              activeBank: null,
              linkedBanks: [],
              error: status.error === 'Missing token' || status.error === 'Invalid or expired token'
                ? 'Session expired. Please login again.'
                : status.error
            });
            return;
          }
          const complete = Boolean(status?.onboardingComplete);
          localStorage.setItem('bankOnboarded', complete ? 'true' : 'false');

          setBankState({
            loading: false,
            complete,
            activeBank: status?.activeBank || null,
            linkedBanks: status?.linkedBanks || [],
            error: ''
          });

          if (complete) {
            const bankInsights = await api.bankAnalysis(month, year);
            if (!bankInsights?.error) {
              setBankAnalysis(bankInsights);
            }
          }
        } catch {
          localStorage.setItem('bankOnboarded', 'false');
          setBankState({
            loading: false,
            complete: false,
            activeBank: null,
            linkedBanks: [],
            error: `Cannot reach backend API at ${apiBase}.`
          });
        }
      } catch (err) {
        console.error('Home load error:', err);
        setInsightsError('Unable to load snapshot/trend. Check backend API connection.');
      }
    })();
  }, []);

  const saveBudget = () => {
    if (!budgetStorageKey) return;

    const value = Number(budgetInput);
    if (!Number.isFinite(value) || value <= 0) {
      localStorage.removeItem(budgetStorageKey);
      setBudget(0);
      setBudgetInput('');
      setBudgetMsg('Budget cleared for this month.');
      return;
    }

    localStorage.setItem(budgetStorageKey, String(round2(value)));
    setBudget(round2(value));
    setBudgetInput(String(round2(value)));
    setBudgetMsg('Budget saved.');
  };

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2>Monthly Budget Planner</h2>
          <span className="helper-text">
            {currData.month}/{currData.year}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            style={{ width: 'min(100%, 240px)' }}
            type="number"
            min="0"
            placeholder="Set monthly budget"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
          />
          <button onClick={saveBudget}>Save Budget</button>
          <button
            onClick={() => {
              if (budgetStorageKey) localStorage.removeItem(budgetStorageKey);
              setBudget(0);
              setBudgetInput('');
              setBudgetMsg('Budget cleared for this month.');
            }}
          >
            Clear
          </button>
        </div>

        {budget > 0 ? (
          <>
            <p>
              Spent: <strong>INR {currentSpend.toLocaleString('en-IN')}</strong> | Remaining:{' '}
              <strong>INR {budgetRemaining.toLocaleString('en-IN')}</strong>
            </p>
            <div className="progress-track">
              <div
                className={`progress-fill ${budgetUsedPct > 100 ? 'over' : ''}`}
                style={{ width: `${Math.min(100, budgetUsedPct)}%` }}
              />
            </div>
            <p className="helper-text">Used {budgetUsedPct}% of budget</p>
            {projectedMonthEnd > 0 && (
              <p className={projectedGap > 0 ? 'error-text' : 'success-text'}>
                Projected month-end spend: INR {projectedMonthEnd.toLocaleString('en-IN')}
                {projectedGap > 0
                  ? ` (over budget by INR ${projectedGap.toLocaleString('en-IN')})`
                  : ` (within budget by INR ${Math.abs(projectedGap).toLocaleString('en-IN')})`}
              </p>
            )}
          </>
        ) : (
          <p className="helper-text">Set a budget to track overspending and monthly targets.</p>
        )}

        {budgetMsg && <p className="helper-text">{budgetMsg}</p>}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2>Bank Connection</h2>
          <Link to="/onboarding/bank">Connect / Manage</Link>
        </div>

        {bankState.loading ? (
          <p className="helper-text">Checking bank connection...</p>
        ) : bankState.complete ? (
          <>
            <p>
              Active bank: <strong>{bankState.activeBank?.name || 'Linked Bank'}</strong>{' '}
              {bankState.activeBank?.accountMask ? `(${bankState.activeBank.accountMask})` : ''}
            </p>
            <p className="helper-text">Linked bank accounts: {bankState.linkedBanks.length}</p>
            {bankAnalysis?.totals && (
              <p>
                Bank spend this month: <strong>INR {Number(bankAnalysis.totals.spend || 0).toLocaleString('en-IN')}</strong>
              </p>
            )}
            {bankAnalysis?.insights?.[0] && <p className="helper-text">{bankAnalysis.insights[0]}</p>}
          </>
        ) : (
          <>
            <p className="helper-text">{bankState.error || 'No bank connected yet.'}</p>
            <p className="helper-text">Connect a bank to unlock aggregator-based transaction insights.</p>
          </>
        )}
      </div>

      {insights && (
        <div className="grid grid-2">
          <div className="card">
            <h2>Smart Snapshot</h2>
            <div className="grid grid-2" style={{ gap: 10 }}>
              <div className="card" style={{ padding: 12 }}>
                <div className="helper-text">Avg / Day</div>
                <strong>INR {insights.totals?.averageDaily?.toLocaleString('en-IN')}</strong>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <div className="helper-text">Avg / Transaction</div>
                <strong>INR {insights.totals?.averageTransaction?.toLocaleString('en-IN')}</strong>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <div className="helper-text">Projected Month End</div>
                <strong>INR {insights.totals?.projectedMonthEnd?.toLocaleString('en-IN')}</strong>
              </div>
              <div className="card" style={{ padding: 12 }}>
                <div className="helper-text">Top Category</div>
                <strong>
                  {insights.topCategory?.type || '-'}
                  {insights.topCategory?.sharePct ? ` (${insights.topCategory.sharePct}%)` : ''}
                </strong>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Last 6 Months Trend</h2>
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={insights.trend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value) => `INR ${value}`} />
                  <Bar dataKey="total" fill="#1d4ed8" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {insights?.recommendations?.length > 0 && (
        <div className="card">
          <h3>Recommendations</h3>
          <ul className="insight-list">
            {insights.recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <h2>Current Month Summary ({currData.month}/{currData.year})</h2>
          <p>
            Total Spent: <strong>INR {currData.total?.toLocaleString('en-IN')}</strong>
          </p>
          <div style={{ height: 320 }}>
            {currentPieData.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={currentPieData}
                    dataKey="total"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={115}
                    label={false}
                    labelLine={false}
                  >
                    {currentPieData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, _name, point) => [`INR ${value}`, labelForType(point?.payload?.type)]} />
                  <Legend formatter={(value) => labelForType(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                <p className="helper-text">No non-zero category data for this month.</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2>Previous Month Summary ({prevData.month}/{prevData.year})</h2>
          <p>
            Total Spent: <strong>INR {prevData.total?.toLocaleString('en-IN')}</strong>
          </p>
          <div style={{ height: 320 }}>
            {previousPieData.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={previousPieData}
                    dataKey="total"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={115}
                    label={false}
                    labelLine={false}
                  >
                    {previousPieData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, _name, point) => [`INR ${value}`, labelForType(point?.payload?.type)]} />
                  <Legend formatter={(value) => labelForType(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
                <p className="helper-text">No non-zero category data for previous month.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {insights?.topExpenses?.length > 0 && (
        <div className="card">
          <h3>Top Expenses This Month</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Type</th>
                <th>Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              {insights.topExpenses.map((it) => (
                <tr key={it.id}>
                  <td>{new Date(it.date).toLocaleDateString('en-IN')}</td>
                  <td>{it.name}</td>
                  <td>{it.type}</td>
                  <td>{it.amount.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!insights && insightsError && (
        <div className="card">
          <h3>Snapshot/Trend Unavailable</h3>
          <p className="error-text">{insightsError}</p>
          <p className="helper-text">
            Ensure frontend and backend point to the same API base and restart the frontend after changing `.env`.
          </p>
        </div>
      )}
    </div>
  );
}
