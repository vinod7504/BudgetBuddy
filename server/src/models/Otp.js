import mongoose from 'mongoose';

const OtpSchema = new mongoose.Schema({
  email: { type: String, index: true, required: true },
  purpose: { type: String, enum: ['register', 'reset'], required: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Otp', OtpSchema);
