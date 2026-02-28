import mongoose from 'mongoose';

export const DEFAULT_EXPENSE_TYPES = ['Savings', 'Food', 'Utilities', 'Rent', 'Medicine'];

const expenseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, required: true, trim: true, maxlength: 48 },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: () => new Date() },
    notes: { type: String }
  },
  { timestamps: true }
);

// Common filters for lists, summaries, and trend lookups.
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, type: 1, date: -1 });

export default mongoose.model('Expense', expenseSchema);
