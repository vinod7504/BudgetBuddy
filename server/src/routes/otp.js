import { Router } from 'express';
import bcrypt from 'bcryptjs';
import Otp from '../models/Otp.js';
import { sendMail } from '../utils/mailer.js';

const router = Router();
const PURPOSES = ['register', 'reset'];

const GMAIL_RE = /^[a-z0-9._%+-]+@gmail\.com$/i;

function genOTP() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
}
function exp(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

// POST /api/otp/send { email, purpose }
router.post('/send', async (req, res) => {
  try {
    const { email, purpose } = req.body;
    if (!email || !purpose) return res.status(400).json({ error: 'email and purpose required' });
    if (!PURPOSES.includes(purpose)) return res.status(400).json({ error: 'invalid purpose' });

    const normEmail = String(email).toLowerCase().trim();
    if (!GMAIL_RE.test(normEmail)) return res.status(400).json({ error: 'Email must end with @gmail.com' });

    const otp = genOTP();
    const otpHash = await bcrypt.hash(otp, 10);

    await Otp.findOneAndUpdate(
      { email: normEmail, purpose },
      { otpHash, expiresAt: exp(10) },
      { upsert: true, new: true }
    );

    await sendMail({
      to: normEmail,
      subject: `Your ${purpose === 'reset' ? 'Password Reset' : 'Registration'} Code`,
      html: `<p>Your verification code is <b>${otp}</b>. It expires in 10 minutes.</p>`,
    });

    return res.json({ message: 'Code sent to email' });
  } catch (e) {
    console.error('otp/send error:', e?.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/otp/verify { email, purpose, otp }
router.post('/verify', async (req, res) => {
  try {
    const { email, purpose, otp } = req.body;
    if (!email || !purpose || !otp) return res.status(400).json({ error: 'email, purpose, otp required' });

    const normEmail = String(email).toLowerCase().trim();
    const rec = await Otp.findOne({ email: normEmail, purpose });
    if (!rec || rec.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Code expired or not found' });
    }

    const ok = await bcrypt.compare(String(otp), rec.otpHash);
    if (!ok) return res.status(400).json({ error: 'Invalid code' });

    // Optionally delete to enforce one-time use
    await Otp.deleteOne({ _id: rec._id });

    return res.json({ message: 'Code verified' });
  } catch (e) {
    console.error('otp/verify error:', e?.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
