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

function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function otpExpiry(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function canExposeDevOtp() {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_OTP_IN_RESPONSE === 'true';
}

async function verifyCaptcha(token, ip) {
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) {
    console.warn('RECAPTCHA_SECRET missing');
    return false;
  }
  const params = new URLSearchParams();
  params.set('secret', secret);
  params.set('response', token);
  if (ip) params.set('remoteip', ip);
  const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await resp.json();
  return !!data?.success;
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, captchaToken } = req.body;
    if (!name || !email || !password || !captchaToken) {
      return res.status(400).json({ error: 'All fields (including captcha) are required' });
    }
    const normEmail = String(email).toLowerCase().trim();
    if (!GMAIL_RE.test(normEmail)) {
      return res.status(400).json({ error: 'Email must end with @gmail.com' });
    }
    if (!PASSWORD_RE.test(password)) {
      return res.status(400).json({
        error:
          'Password must start with a capital letter, include a number & symbol, no spaces, only 1 uppercase (first char), min 8 chars.',
        examples: passwordSuggestions(),
      });
    }
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    const okCaptcha = await verifyCaptcha(captchaToken, ip);
    if (!okCaptcha) {
      return res.status(400).json({ error: 'Captcha verification failed' });
    }
    const existing = await User.findOne({ email: normEmail });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: normEmail, passwordHash });
    return res.status(201).json({
      message: 'Registered successfully',
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (e) {
    console.error('Register (captcha) error:', e?.message);
    if (e && e.code === 11000) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    if (e?.name === 'ValidationError') {
      return res.status(400).json({ error: e.message });
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set on the server');
      return res.status(500).json({ error: 'Server auth misconfiguration (JWT secret missing)' });
    }
    const normEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normEmail });
    if (!user) {
      return res.status(404).json({ error: 'Email not registered. Please register with us first.' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    let token;
    try {
      token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
    } catch (signErr) {
      console.error('JWT sign error:', signErr?.message || signErr);
      return res.status(500).json({ error: 'Server error while issuing token' });
    }
    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        linkedBanks: user.linkedBanks || [],
        activeBankCode: user.activeBankCode || '',
        onboardingCompletedAt: user.onboardingCompletedAt || null
      }
    });
  } catch (e) {
    console.error('Login error:', e?.message || e);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select(
    'name email phone linkedBanks activeBankCode bankConsentAt onboardingCompletedAt'
  );
  return res.json({ user });
});

router.post('/password/forgot', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!GMAIL_RE.test(email)) return res.status(400).json({ error: 'Email must end with @gmail.com' });

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: 'If the email exists, an OTP has been sent.' });
    }

    const otp = genOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    await Otp.findOneAndUpdate(
      { email, purpose: 'reset' },
      { otpHash, expiresAt: otpExpiry(10) },
      { upsert: true, new: true }
    );

    try {
      await sendMail({
        to: email,
        subject: 'Budget Buddy - Password Reset OTP',
        html: `<p>Your password reset OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`
      });
      return res.json({ message: 'If the email exists, an OTP has been sent.', mailDelivered: true });
    } catch (mailErr) {
      console.error('forgot-password mail error:', mailErr?.message || mailErr);
      if (canExposeDevOtp()) {
        return res.json({
          message: 'Mail failed. Use OTP below for local testing.',
          mailDelivered: false,
          devOtp: otp
        });
      }
      return res.status(500).json({ error: 'Unable to send OTP email right now. Please try again later.' });
    }
  } catch (e) {
    console.error('password/forgot error:', e?.message || e);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/password/verify-otp', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const otp = String(req.body?.otp || '').trim();

    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });
    if (!GMAIL_RE.test(email)) return res.status(400).json({ error: 'Email must end with @gmail.com' });
    if (!/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'OTP must be 6 digits' });
    if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'Server auth misconfiguration (JWT secret missing)' });

    const rec = await Otp.findOne({ email, purpose: 'reset' });
    if (!rec || rec.expiresAt < new Date()) {
      return res.status(400).json({ error: 'OTP expired or not found' });
    }

    const ok = await bcrypt.compare(otp, rec.otpHash);
    if (!ok) return res.status(400).json({ error: 'Invalid OTP' });

    await Otp.deleteOne({ _id: rec._id });

    const resetToken = jwt.sign(
      { email, purpose: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    return res.json({ message: 'OTP verified', resetToken });
  } catch (e) {
    console.error('password/verify-otp error:', e?.message || e);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.post('/password/reset', async (req, res) => {
  try {
    const resetToken = String(req.body?.resetToken || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'resetToken and newPassword are required' });
    }
    if (!PASSWORD_RE.test(newPassword)) {
      return res.status(400).json({
        error:
          'Password must start with a capital letter, include a number & symbol, no spaces, only 1 uppercase (first char), min 8 chars.',
        examples: passwordSuggestions()
      });
    }
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Server auth misconfiguration (JWT secret missing)' });
    }

    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (payload?.purpose !== 'password-reset' || !payload?.email) {
      return res.status(400).json({ error: 'Invalid reset token payload' });
    }

    const user = await User.findOne({ email: String(payload.email).toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: 'Password updated successfully. Please login with the new password.' });
  } catch (e) {
    console.error('password/reset error:', e?.message || e);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
