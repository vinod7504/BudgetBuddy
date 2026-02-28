import mongoose from 'mongoose';

const TYPES = ['Savings', 'Food', 'Utilities', 'Rent', 'Medicine'];

const expenseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: TYPES, required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: () => new Date() },
    notes: { type: String }
  },
  { timestamps: true }
);

// Common filters for lists, summaries, and trend lookups.
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, type: 1, date: -1 });

export const EXPENSE_TYPES = TYPES;
export default mongoose.model('Expense', expenseSchema);
