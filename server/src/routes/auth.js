// import { Router } from 'express';
// import bcrypt from 'bcryptjs';
// import jwt from 'jsonwebtoken';
// import User from '../models/User.js';
// import auth from '../middleware/auth.js';

// const router = Router();

// const GMAIL_RE = /^[a-z0-9._%+-]+@gmail\.com$/i;
// const PASSWORD_RE = /^(?=.{8,})(?=.*\d)(?=.*[^A-Za-z0-9\s])[A-Z](?!.*[A-Z])[^\s]+$/;

// function passwordSuggestions() {
//   return [
//     'Abcdef1!',    
//     'Moneyapp2@',
//     'Budget3#x',     
//   ];
// }

// router.post('/register', async (req, res) => {
//   try {
//     const { name, email, password } = req.body;
//     if (!name || !email || !password)
//       return res.status(400).json({ error: 'All fields are required' });

//     const normEmail = String(email).toLowerCase().trim();

//     if (!GMAIL_RE.test(normEmail)) {
//       return res.status(400).json({ error: 'Email must end with @gmail.com' });
//     }

//     if (!PASSWORD_RE.test(password)) {
//       return res.status(400).json({
//         error:
//           'Password must start with a capital letter, include at least one number and one symbol, contain no spaces, have only the first letter uppercase, and be at least 8 characters.',
//         examples: passwordSuggestions(),
//       });
//     }

//     // Pre-check
//     const existing = await User.findOne({ email: normEmail });
//     if (existing) return res.status(409).json({ error: 'Email already registered' });

//     const passwordHash = await bcrypt.hash(password, 10);
//     const user = await User.create({ name, email: normEmail, passwordHash });

//     return res.status(201).json({
//       message: 'Registered successfully',
//       user: { id: user._id, name: user.name, email: user.email }
//     });
//   } catch (e) {
//     console.error('Register error:', e?.code, e?.message);

//     if (e && e.code === 11000) {
//       return res.status(409).json({ error: 'Email already registered' });
//     }
//     if (e?.name === 'ValidationError') {
//       return res.status(400).json({ error: e.message });
//     }
//     return res.status(500).json({ error: 'Server error' });
//   }
// });

// router.post('/login', async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     if (!email || !password)
//       return res.status(400).json({ error: 'Email and password required' });

//     const normEmail = String(email).toLowerCase().trim();

//     const user = await User.findOne({ email: normEmail });
//     if (!user) return res.status(401).json({ error: 'Invalid credentials' });

//     const ok = await bcrypt.compare(password, user.passwordHash);
//     if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

//     const token = jwt.sign(
//       { id: user._id, email: user.email },
//       process.env.JWT_SECRET,
//       { expiresIn: '7d' }
//     );

//     return res.json({
//       message: 'Login successful',
//       token,
//       user: { id: user._id, name: user.name, email: user.email }
//     });
//   } catch (e) {
//     console.error('Login error:', e?.message);
//     return res.status(500).json({ error: 'Server error' });
//   }
// });

// router.get('/me', auth, async (req, res) => {
//   const user = await User.findById(req.user.id).select('name email');
//   return res.json({ user });
// });

// export default router;


import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import auth from '../middleware/auth.js';
import { sendMail } from '../utils/mailer.js';

const router = Router();

const GMAIL_RE = /^[a-z0-9._%+-]+@gmail\.com$/i;
const PASSWORD_RE = /^(?=.{8,})(?=.*\d)(?=.*[^A-Za-z0-9\s])[A-Z](?!.*[A-Z])[^\s]+$/;

function passwordSuggestions() {
  return ['Abcdef1!','Moneyapp2@','Budget3#x'];
}

function genOTP() {
  // 6-digit numeric OTP
  return String(Math.floor(100000 + Math.random() * 900000));
}
function exp(minutes = 10) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

// =================== REGISTER with OTP ===================
// Step-1: Request OTP (does NOT create user yet)
router.post('/register/request-otp', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields are required' });

    const normEmail = String(email).toLowerCase().trim();
    if (!GMAIL_RE.test(normEmail)) return res.status(400).json({ error: 'Email must end with @gmail.com' });

    if (!PASSWORD_RE.test(password)) {
      return res.status(400).json({
        error: 'Password must start with a capital letter, include a number & symbol, no spaces, only 1 uppercase (first char), min 8 chars.',
        examples: passwordSuggestions(),
      });
    }

    const existing = await User.findOne({ email: normEmail });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const otp = genOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const passwordHash = await bcrypt.hash(password, 10);

    // Upsert OTP document for this email+purpose
    await Otp.findOneAndUpdate(
      { email: normEmail, purpose: 'register' },
      { otpHash, data: { name, passwordHash }, expiresAt: exp(10) },
      { upsert: true, new: true }
    );

    await sendMail({
      to: normEmail,
      subject: 'Your Budget Buddy Registration OTP',
      html: `<p>Hi ${name},</p><p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`,
    });

    return res.json({ message: 'OTP sent to email' });
  } catch (e) {
    console.error('register/request-otp error:', e?.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Step-2: Verify OTP (creates user)
router.post('/register/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

    const normEmail = String(email).toLowerCase().trim();
    const record = await Otp.findOne({ email: normEmail, purpose: 'register' });
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'OTP expired or not found' });
    }

    const ok = await bcrypt.compare(String(otp), record.otpHash);
    if (!ok) return res.status(400).json({ error: 'Invalid OTP' });

    const { name, passwordHash } = record.data || {};
    if (!name || !passwordHash) return res.status(400).json({ error: 'Invalid registration context' });

    const user = await User.create({ name, email: normEmail, passwordHash });
    await Otp.deleteOne({ _id: record._id });

    return res.status(201).json({
      message: 'Registered successfully',
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (e) {
    console.error('register/verify error:', e?.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// =================== LOGIN (unchanged) ===================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    const normEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normEmail });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (e) {
    console.error('Login error:', e?.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// =================== FORGOT PASSWORD (2-step) ===================
// Step-1: Request reset OTP
router.post('/password/forgot', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const normEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normEmail });
    // respond generic to avoid user enumeration
    if (!user) return res.json({ message: 'If the email exists, an OTP has been sent' });

    const otp = genOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    await Otp.findOneAndUpdate(
      { email: normEmail, purpose: 'reset' },
      { otpHash, data: {}, expiresAt: exp(10) },
      { upsert: true, new: true }
    );

    await sendMail({
      to: normEmail,
      subject: 'Budget Buddy Password Reset OTP',
      html: `<p>Your password reset OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`,
    });

    return res.json({ message: 'If the email exists, an OTP has been sent' });
  } catch (e) {
    console.error('/password/forgot error:', e?.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Step-2: Verify OTP → issue short-lived reset token
router.post('/password/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

    const normEmail = String(email).toLowerCase().trim();
    const record = await Otp.findOne({ email: normEmail, purpose: 'reset' });
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'OTP expired or not found' });
    }

    const ok = await bcrypt.compare(String(otp), record.otpHash);
    if (!ok) return res.status(400).json({ error: 'Invalid OTP' });

    // Create a short-lived JWT reset token (15m)
    const resetToken = jwt.sign(
      { email: normEmail, purpose: 'reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    return res.json({ message: 'OTP verified', resetToken });
  } catch (e) {
    console.error('/password/verify-otp error:', e?.message);
    return res.status(500).json({ error: 'Server error' });
  }
});
// Step-3: Reset password using resetToken
router.post('/password/reset', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'resetToken and newPassword required' });
    }

    if (!PASSWORD_RE.test(newPassword)) {
      return res.status(400).json({
        error: 'Password must start with a capital letter, include a number & symbol, no spaces, only 1 uppercase (first char), min 8 chars.',
        examples: passwordSuggestions(),
      });
    }

    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (e) {
      console.error('reset token verify failed:', e?.message);
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    if (payload.purpose !== 'reset') {
      return res.status(400).json({ error: 'Invalid token purpose' });
    }

    // compute hash and update explicitly
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const result = await User.updateOne(
      { email: payload.email },           // email was normalized during verify-otp
      { $set: { passwordHash } }
    );

    console.log('password reset update', {
      email: payload.email,
      matched: result.matchedCount,
      modified: result.modifiedCount
    });

    if (result.matchedCount === 0) {
      return res.status(400).json({ error: 'User not found' });
    }
    if (result.modifiedCount === 0) {
      // This usually means the new password equals the existing one (same hash outcome)
      // or Mongoose determined no change—very rare with a fresh hash.
      return res.status(200).json({ message: 'Password unchanged (already the same?)' });
    }

    // Invalidate any outstanding reset OTPs
    await Otp.deleteOne({ email: payload.email, purpose: 'reset' });

    return res.json({ message: 'Password updated successfully' });
  } catch (e) {
    console.error('/password/reset error:', e?.message);
    return res.status(500).json({ error: 'Server error' });
  }
});


// =================== ME ===================
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('name email');
  return res.json({ user });
});

export default router;
