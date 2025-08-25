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
    const { month, year } = req.query; // month: 1-12, year: 4-digit
    const filter = { userId: req.user.id };

    if (month && year) {
      const m = Number(month) - 1; // JS Date month index
      const y = Number(year);
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 1);
      filter.date = { $gte: start, $lt: end };
    }

    const items = await Expense.find(filter).sort({ date: -1 });
    res.json({ items });
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
