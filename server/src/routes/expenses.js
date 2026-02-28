// import { Router } from 'express';
// import Expense, { EXPENSE_TYPES } from '../models/Expense.js';
// import auth from '../middleware/auth.js';
// import mongoose from 'mongoose';

// const router = Router();
// router.use(auth);

// // Create expense
// router.post("/", async (req, res) => {
//   try {
//     const { name, type, amount, date, notes } = req.body;
//     if (!name || !type || amount == null)
//       return res.status(400).json({ error: "name, type, amount are required" });
//     if (!EXPENSE_TYPES.includes(type))
//       return res.status(400).json({ error: "Invalid type" });

//     const exp = await Expense.create({
//       userId: req.user.id,
//       name,
//       type,
//       amount: Number(amount),
//       date: date ? new Date(date) : new Date(),
//       notes,
//     });
//     res.status(201).json({ message: "Created", expense: exp });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // List expenses by month/year (optional)
// router.get("/", async (req, res) => {
//   try {
//     const { month, year } = req.query; // month: 1-12, year: 4-digit
//     const filter = { userId: req.user.id };

//     if (month && year) {
//       const m = Number(month) - 1; // JS Date month index
//       const y = Number(year);
//       const start = new Date(y, m, 1);
//       const end = new Date(y, m + 1, 1);
//       filter.date = { $gte: start, $lt: end };
//     }

//     const items = await Expense.find(filter).sort({ date: -1 });
//     res.json({ items });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // Summary by month/year
// router.get("/summary", async (req, res) => {
//   try {
//     const { month, year } = req.query;
//     if (!month || !year)
//       return res.status(400).json({ error: "month and year are required" });
//     const m = Number(month) - 1;
//     const y = Number(year);
//     const start = new Date(y, m, 1);
//     const end = new Date(y, m + 1, 1);

//     const agg = await Expense.aggregate([
//       {
//         $match: {
//           userId: (
//             await import("mongoose")
//           ).default.Types.ObjectId.createFromHexString(req.user.id),
//           date: { $gte: start, $lt: end },
//         },
//       },
//       { $group: { _id: "$type", total: { $sum: "$amount" } } },
//     ]);

//     const byType = EXPENSE_TYPES.map((t) => ({
//       type: t,
//       total: Math.round((agg.find((a) => a._id === t)?.total || 0) * 100) / 100,
//     }));
//     const total = byType.reduce((s, x) => s + x.total, 0);

//     res.json({ month: Number(month), year: Number(year), total, byType });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// router.get("/summary/previous-month", async (req, res) => {
//   try {
//     const now = new Date();
//     const y = now.getFullYear();
//     const m = now.getMonth(); // 0-11 current month
//     const prevMonthIndex = m === 0 ? 11 : m - 1;
//     const prevYear = m === 0 ? y - 1 : y;

//     const start = new Date(prevYear, prevMonthIndex, 1);
//     const end = new Date(prevYear, prevMonthIndex + 1, 1);

//     const agg = await Expense.aggregate([
//       {
//         $match: {
//           userId: (
//             await import("mongoose")
//           ).default.Types.ObjectId.createFromHexString(req.user.id),
//           date: { $gte: start, $lt: end },
//         },
//       },
//       { $group: { _id: "$type", total: { $sum: "$amount" } } },
//     ]);

//     const byType = EXPENSE_TYPES.map((t) => ({
//       type: t,
//       total: Math.round((agg.find((a) => a._id === t)?.total || 0) * 100) / 100,
//     }));
//     const total = byType.reduce((s, x) => s + x.total, 0);
//     res.json({ month: prevMonthIndex + 1, year: prevYear, total, byType });
//   } catch (e) {
//     console.error(e);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// export default router;



import { Router } from 'express';
import Expense, { EXPENSE_TYPES } from '../models/Expense.js';
import auth from '../middleware/auth.js';
import mongoose from 'mongoose';

const router = Router();
router.use(auth);

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function monthWindow(month, year) {
  const m = Number(month) - 1;
  const y = Number(year);
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 1);
  return { start, end };
}

function toInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Create expense
router.post('/', async (req, res) => {
  try {
    const { name, type, amount, date, notes } = req.body;
    if (!name || !type || amount == null) return res.status(400).json({ error: 'name, type, amount are required' });
    if (!EXPENSE_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });

    const exp = await Expense.create({
      userId: req.user.id,
      name,
      type,
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      notes
    });
    res.status(201).json({ message: 'Created', expense: exp });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// List expenses by month/year (optional)
router.get('/', async (req, res) => {
  try {
    const {
      month,
      year,
      page = '1',
      limit = '25',
      q = '',
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    if ((month && !year) || (!month && year)) {
      return res.status(400).json({ error: 'Provide both month and year together.' });
    }

    const pageNum = toInt(page, 1, 1, 100000);
    const limitNum = toInt(limit, 25, 1, 100);
    const skip = (pageNum - 1) * limitNum;
    const filter = { userId: req.user.id };

    if (month && year) {
      const m = Number(month);
      const y = Number(year);
      if (!Number.isFinite(m) || m < 1 || m > 12 || !Number.isFinite(y) || y < 1970) {
        return res.status(400).json({ error: 'Invalid month/year' });
      }
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      filter.date = { $gte: start, $lt: end };
    }

    const search = String(q || '').trim();
    if (search) {
      const safe = escapeRegex(search.slice(0, 80));
      const regex = new RegExp(safe, 'i');
      filter.$or = [{ name: regex }, { notes: regex }, { type: regex }];
    }

    const order = String(sortOrder).toLowerCase() === 'asc' ? 1 : -1;
    const allowedSort = new Set(['date', 'amount', 'createdAt', 'updatedAt']);
    const sortField = allowedSort.has(String(sortBy)) ? String(sortBy) : 'date';
    const sort = { [sortField]: order, _id: -1 };

    const [items, total] = await Promise.all([
      Expense.find(filter).sort(sort).skip(skip).limit(limitNum),
      Expense.countDocuments(filter)
    ]);

    const pages = Math.max(1, Math.ceil(total / limitNum));
    res.json({
      items,
      total,
      page: pageNum,
      limit: limitNum,
      pages,
      hasPrev: pageNum > 1,
      hasNext: pageNum < pages
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Summary by month/year
router.get('/summary', async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'month and year are required' });
    const m = Number(month) - 1;
    const y = Number(year);
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 1);

    const agg = await Expense.aggregate([
      { $match: { userId: mongoose.Types.ObjectId.createFromHexString(req.user.id), date: { $gte: start, $lt: end } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } }
    ]);

    const byType = EXPENSE_TYPES.map(t => ({ type: t, total: Math.round((agg.find(a => a._id === t)?.total || 0) * 100) / 100 }));
    const total = byType.reduce((s, x) => s + x.total, 0);

    res.json({ month: Number(month), year: Number(year), total, byType });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Previous month summary
router.get('/summary/previous-month', async (req, res) => {
  try {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-11 current month
    const prevMonthIndex = m === 0 ? 11 : m - 1;
    const prevYear = m === 0 ? y - 1 : y;

    const start = new Date(prevYear, prevMonthIndex, 1);
    const end = new Date(prevYear, prevMonthIndex + 1, 1);

    const agg = await Expense.aggregate([
      { $match: { userId: mongoose.Types.ObjectId.createFromHexString(req.user.id), date: { $gte: start, $lt: end } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } }
    ]);

    const byType = EXPENSE_TYPES.map(t => ({ type: t, total: Math.round((agg.find(a => a._id === t)?.total || 0) * 100) / 100 }));
    const total = byType.reduce((s, x) => s + x.total, 0);

    res.json({ month: prevMonthIndex + 1, year: prevYear, total, byType });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Insights by month/year + trend + recommendations
router.get('/insights', async (req, res) => {
  try {
    const now = new Date();
    const month = Number(req.query.month || now.getMonth() + 1);
    const year = Number(req.query.year || now.getFullYear());
    const monthsBack = Math.min(Math.max(Number(req.query.monthsBack || 6), 3), 12);

    if (!Number.isFinite(month) || month < 1 || month > 12 || !Number.isFinite(year) || year < 1970) {
      return res.status(400).json({ error: 'Invalid month/year' });
    }

    const userId = mongoose.Types.ObjectId.createFromHexString(req.user.id);
    const { start, end } = monthWindow(month, year);
    const trendStart = new Date(year, month - monthsBack, 1);

    const [totalsAgg, byTypeAgg, byDayAgg, topExpenses, trendAgg] = await Promise.all([
      Expense.aggregate([
        { $match: { userId, date: { $gte: start, $lt: end } } },
        { $group: { _id: null, total: { $sum: '$amount' }, transactions: { $sum: 1 } } }
      ]),
      Expense.aggregate([
        { $match: { userId, date: { $gte: start, $lt: end } } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, transactions: { $sum: 1 } } },
        { $sort: { total: -1 } }
      ]),
      Expense.aggregate([
        { $match: { userId, date: { $gte: start, $lt: end } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            total: { $sum: '$amount' },
            transactions: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Expense.find({ userId, date: { $gte: start, $lt: end } })
        .sort({ amount: -1 })
        .limit(5)
        .select('name type amount date notes'),
      Expense.aggregate([
        { $match: { userId, date: { $gte: trendStart, $lt: end } } },
        {
          $group: {
            _id: { year: { $year: '$date' }, month: { $month: '$date' } },
            total: { $sum: '$amount' },
            transactions: { $sum: 1 }
          }
        }
      ])
    ]);

    const totals = totalsAgg[0] || { total: 0, transactions: 0 };
    const totalSpend = round2(totals.total);
    const txnCount = Number(totals.transactions || 0);
    const avgTransaction = txnCount > 0 ? round2(totalSpend / txnCount) : 0;

    const daysInMonth = new Date(year, month, 0).getDate();
    const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
    const elapsedDays = isCurrentMonth ? now.getDate() : daysInMonth;
    const avgDaily = elapsedDays > 0 ? round2(totalSpend / elapsedDays) : 0;
    const projectedEnd = round2(avgDaily * daysInMonth);

    const byType = EXPENSE_TYPES.map((type) => {
      const row = byTypeAgg.find((it) => it._id === type);
      return {
        type,
        total: round2(row?.total || 0),
        transactions: Number(row?.transactions || 0)
      };
    });

    const topCategory = byType
      .slice()
      .sort((a, b) => b.total - a.total)
      .find((x) => x.total > 0) || null;
    const topCategorySharePct =
      topCategory && totalSpend > 0 ? round2((topCategory.total / totalSpend) * 100) : 0;

    const highestExpense = topExpenses[0]
      ? {
          id: topExpenses[0]._id,
          name: topExpenses[0].name,
          type: topExpenses[0].type,
          amount: round2(topExpenses[0].amount),
          date: topExpenses[0].date,
          notes: topExpenses[0].notes || ''
        }
      : null;

    const trendMap = new Map(
      trendAgg.map((row) => [`${row._id.year}-${row._id.month}`, { total: round2(row.total), transactions: row.transactions }])
    );
    const trend = [];
    for (let i = monthsBack - 1; i >= 0; i -= 1) {
      const dt = new Date(year, month - 1 - i, 1);
      const key = `${dt.getFullYear()}-${dt.getMonth() + 1}`;
      const val = trendMap.get(key) || { total: 0, transactions: 0 };
      trend.push({
        month: dt.getMonth() + 1,
        year: dt.getFullYear(),
        label: dt.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        total: val.total,
        transactions: val.transactions
      });
    }

    const byDay = byDayAgg.map((row) => ({
      date: row._id,
      total: round2(row.total),
      transactions: row.transactions
    }));

    const recommendations = [];
    if (topCategory && topCategorySharePct >= 45) {
      recommendations.push(
        `${topCategory.type} is ${topCategorySharePct}% of this month. Setting a budget cap for this type can reduce overspending.`
      );
    }
    if (isCurrentMonth && totalSpend > 0 && projectedEnd > totalSpend * 1.15) {
      recommendations.push(
        `Current pace projects INR ${projectedEnd.toLocaleString(
          'en-IN'
        )} by month-end. Slow down discretionary spends this week.`
      );
    }
    if (highestExpense && avgTransaction > 0 && highestExpense.amount >= avgTransaction * 2) {
      recommendations.push(
        `Highest single expense (${highestExpense.name}) is much higher than average transaction. Consider splitting big payments when possible.`
      );
    }
    if (recommendations.length === 0) {
      recommendations.push('Spending pattern looks stable this month. Keep tracking regularly for better insights.');
    }

    res.json({
      period: { month, year },
      totals: {
        spend: totalSpend,
        transactions: txnCount,
        averageTransaction: avgTransaction,
        averageDaily: avgDaily,
        projectedMonthEnd: projectedEnd
      },
      byType,
      topCategory: topCategory
        ? { ...topCategory, sharePct: topCategorySharePct }
        : null,
      highestExpense,
      topExpenses: topExpenses.map((it) => ({
        id: it._id,
        name: it.name,
        type: it.type,
        amount: round2(it.amount),
        date: it.date,
        notes: it.notes || ''
      })),
      byDay,
      trend,
      recommendations
    });
  } catch (e) {
    console.error('insights error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE an expense (only owner)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, amount, date, notes } = req.body;
    const exp = await Expense.findOne({ _id: id, userId: req.user.id });
    if (!exp) return res.status(404).json({ error: 'Expense not found' });
    if (type && !EXPENSE_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });

    if (name != null) exp.name = name;
    if (type != null) exp.type = type;
    if (amount != null) exp.amount = Number(amount);
    if (date != null) exp.date = new Date(date);
    if (notes != null) exp.notes = notes;

    await exp.save();
    res.json({ message: 'Updated', expense: exp });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE an expense (only owner)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const exp = await Expense.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!exp) return res.status(404).json({ error: 'Expense not found' });
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
