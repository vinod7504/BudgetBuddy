// import { Router } from 'express';
// import bcrypt from 'bcryptjs';
// import jwt from 'jsonwebtoken';
// import User from '../models/User.js';
// import auth from '../middleware/auth.js';

// const router = Router();

// router.post('/register', async (req, res) => {
//   try {
//     const { name, email, password } = req.body;
//     if (!name || !email || !password)
//       return res.status(400).json({ error: 'All fields are required' });

//     const normEmail = String(email).toLowerCase().trim();

//     // Pre-check (helps UX)
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

//     // Handle duplicate key error from Mongo
//     if (e && e.code === 11000) {
//       return res.status(409).json({ error: 'Email already registered' });
//     }

//     // Handle mongoose validation
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
import auth from '../middleware/auth.js';

const router = Router();

const GMAIL_RE = /^[a-z0-9._%+-]+@gmail\.com$/i;
// Start with capital, min 8, at least one digit and one symbol, no spaces,
// and no other uppercase letters after the first.
const PASSWORD_RE = /^(?=.{8,})(?=.*\d)(?=.*[^A-Za-z0-9\s])[A-Z](?!.*[A-Z])[^\s]+$/;

function passwordSuggestions() {
  // examples that satisfy the rule:
  return [
    'Abcdef1!',      // A + lowercase + number + symbol
    'Moneyapp2@',
    'Budget3#x',     // Note: only first letter is uppercase; rest lowercase/digits/symbols
  ];
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields are required' });

    const normEmail = String(email).toLowerCase().trim();

    // ✅ Allow only @gmail.com mails
    if (!GMAIL_RE.test(normEmail)) {
      return res.status(400).json({ error: 'Email must end with @gmail.com' });
    }

    // ✅ Enforce password policy:
    // - First letter capital
    // - At least one number
    // - At least one symbol
    // - Only first letter uppercase (rest not uppercase)
    // - No spaces
    // - Min length: 8
    if (!PASSWORD_RE.test(password)) {
      return res.status(400).json({
        error:
          'Password must start with a capital letter, include at least one number and one symbol, contain no spaces, have only the first letter uppercase, and be at least 8 characters.',
        examples: passwordSuggestions(),
      });
    }

    // Pre-check
    const existing = await User.findOne({ email: normEmail });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: normEmail, passwordHash });

    return res.status(201).json({
      message: 'Registered successfully',
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (e) {
    console.error('Register error:', e?.code, e?.message);

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

router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('name email');
  return res.json({ user });
});

export default router;
