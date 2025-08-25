import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ResponsiveContainer, PieChart, Pie, Tooltip, Legend, Cell } from 'recharts';

const COLORS = ['#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
const LABELS = { savings: 'Savings', food: 'Food', utilities: 'Utilities', rent: 'Rent', medicine: 'Medicine' };

export default function Home() {
  const [prevData, setPrevData] = useState({ month: 0, year: 0, total: 0, byType: [] });
  const [currData, setCurrData] = useState({ month: 0, year: 0, total: 0, byType: [] });

  useEffect(() => {
    (async () => {
      // Previous month
      const prev = await api.prevMonthSummary();
      setPrevData(prev || { month: 0, year: 0, total: 0, byType: [] });

      // Current month (use /summary?month&year)
      const now = new Date();
      const month = now.getMonth() + 1; // 1-12
      const year = now.getFullYear();
      const curr = await api.summary(month, year);
      setCurrData(curr?.error ? { month, year, total: 0, byType: [] } : { ...curr, month, year });
    })();
  }, []);

  return (
    <div className="grid grid-2">
      {/* Current Month */}
      <div className="card">
        <h2>Current Month Summary ({currData.month}/{currData.year})</h2>
        <p>Total Spent: <strong>₹ {currData.total?.toLocaleString('en-IN')}</strong></p>
        <div style={{ height: 360 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={currData.byType || []}
                dataKey="total"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={120}
                label={(e) => LABELS[e.type] || e.type}
              >
                {(currData.byType || []).map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n, p) => [`₹ ${v}`, LABELS[p.payload.type] || p.payload.type]} />
              <Legend formatter={(v) => LABELS[v] || v} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Previous Month */}
      <div className="card">
        <h2>Previous Month Summary ({prevData.month}/{prevData.year})</h2>
        <p>Total Spent: <strong>₹ {prevData.total?.toLocaleString('en-IN')}</strong></p>
        <div style={{ height: 360 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={prevData.byType || []}
                dataKey="total"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={120}
                label={(e) => LABELS[e.type] || e.type}
              >
                {(prevData.byType || []).map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n, p) => [`₹ ${v}`, LABELS[p.payload.type] || p.payload.type]} />
              <Legend formatter={(v) => LABELS[v] || v} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
