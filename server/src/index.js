import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './lib/db.js';
import authRoutes from './routes/auth.js';
import expenseRoutes from './routes/expenses.js';


const app = express();


app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());


app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);


const PORT = process.env.PORT || 5000;
connectDB().then(() => {
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
});