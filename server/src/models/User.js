import mongoose from 'mongoose';

const linkedBankSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    name: { type: String, required: true },
    accountMask: { type: String, required: true },
    linkedAt: { type: Date, default: Date.now },
    consentId: { type: String, default: '' },
    accountRef: { type: String, default: '' },
    providerRef: { type: String, default: '' }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, trim: true, default: '' },
    linkedBanks: { type: [linkedBankSchema], default: [] },
    activeBankCode: { type: String, default: '' },
    bankConsentAt: { type: Date, default: null },
    onboardingCompletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
