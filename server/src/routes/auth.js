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
import { createSign } from 'crypto';
import { readFileSync } from 'fs';
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

const TEXT_CAPTCHA_LENGTH = 5;
const TEXT_CAPTCHA_TTL_SEC = 5 * 60;
const TEXT_CAPTCHA_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TEXT_CAPTCHA_SECRET = process.env.CAPTCHA_TEXT_SECRET || process.env.JWT_SECRET || 'budget-buddy-captcha-secret';

function randomTextCaptcha(length = TEXT_CAPTCHA_LENGTH) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += TEXT_CAPTCHA_ALPHABET[Math.floor(Math.random() * TEXT_CAPTCHA_ALPHABET.length)];
  }
  return out;
}

function textCaptchaSvg(text) {
  const chars = text.split('');
  const charNodes = chars
    .map((ch, i) => {
      const x = 24 + i * 24 + Math.floor(Math.random() * 6);
      const y = 33 + Math.floor(Math.random() * 8);
      const rot = -18 + Math.floor(Math.random() * 36);
      return `<text x="${x}" y="${y}" font-size="26" transform="rotate(${rot} ${x} ${y})">${ch}</text>`;
    })
    .join('');

  const noise = Array.from({ length: 5 }, (_, i) => {
    const x1 = Math.floor(Math.random() * 160);
    const y1 = Math.floor(Math.random() * 50);
    const x2 = Math.floor(Math.random() * 160);
    const y2 = Math.floor(Math.random() * 50);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#8fb3ff" stroke-width="${1 + (i % 2)}" />`;
  }).join('');

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="52" viewBox="0 0 160 52" role="img" aria-label="captcha">
  <rect width="160" height="52" rx="8" fill="#eef5ff"/>
  ${noise}
  <g fill="#1e3a8a" font-family="monospace" font-weight="700">${charNodes}</g>
</svg>`.trim();
}

function buildTextCaptchaPayload() {
  const answer = randomTextCaptcha().toUpperCase();
  const captchaProof = jwt.sign(
    { type: 'text-captcha', answer },
    TEXT_CAPTCHA_SECRET,
    { expiresIn: `${TEXT_CAPTCHA_TTL_SEC}s` }
  );
  const svg = textCaptchaSvg(answer);
  const captchaImage = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return { captchaImage, captchaProof, expiresInSec: TEXT_CAPTCHA_TTL_SEC };
}

function verifyTextCaptcha(input, proof) {
  const value = String(input || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!value) {
    return { ok: false, provider: 'text', reason: 'Captcha text is required' };
  }
  if (!proof) {
    return { ok: false, provider: 'text', reason: 'Captcha proof is missing' };
  }

  let payload;
  try {
    payload = jwt.verify(String(proof), TEXT_CAPTCHA_SECRET);
  } catch (err) {
    return { ok: false, provider: 'text', reason: `Captcha proof invalid (${err?.message || 'verify failed'})` };
  }

  const answer = String(payload?.answer || '').toUpperCase();
  if (!answer || payload?.type !== 'text-captcha') {
    return { ok: false, provider: 'text', reason: 'Captcha proof payload invalid' };
  }
  if (value !== answer) {
    return { ok: false, provider: 'text', reason: 'Entered captcha text does not match' };
  }

  return { ok: true, provider: 'text', score: 1 };
}

const CAPTCHA_DEFAULT_ACTION = 'REGISTER';
const CAPTCHA_DEFAULT_MIN_SCORE = 0.3;
let enterpriseAccessTokenCache = { token: '', expiresAtMs: 0 };

function normalizeCaptchaAction(value) {
  const clean = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '');
  return clean || CAPTCHA_DEFAULT_ACTION;
}

function parseMinScore(value, fallback = CAPTCHA_DEFAULT_MIN_SCORE) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

async function verifyCaptchaClassic(token, ip, expectedAction) {
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) {
    console.warn('RECAPTCHA_SECRET missing');
    return { ok: false, provider: 'classic', reason: 'RECAPTCHA_SECRET missing' };
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
  if (!data?.success) {
    const codes = Array.isArray(data?.['error-codes']) ? data['error-codes'].join(',') : '';
    const suffix = codes ? ` (${codes})` : '';
    return { ok: false, provider: 'classic', reason: `Captcha token rejected by Google${suffix}` };
  }

  const actualAction = normalizeCaptchaAction(data?.action);
  if (expectedAction && data?.action && actualAction !== expectedAction) {
    return { ok: false, provider: 'classic', reason: `Captcha action mismatch (${actualAction})` };
  }

  const minScore = parseMinScore(process.env.RECAPTCHA_MIN_SCORE, CAPTCHA_DEFAULT_MIN_SCORE);
  const score = Number(data?.score);
  if (Number.isFinite(score) && score < minScore) {
    return { ok: false, provider: 'classic', reason: `Captcha score too low (${score})` };
  }

  return { ok: true, provider: 'classic', score: Number.isFinite(score) ? score : null };
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function parseServiceAccount(rawJson, sourceLabel) {
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new Error(`Invalid ${sourceLabel} (${err?.message || 'parse failed'})`);
  }

  const privateKey = String(parsed?.private_key || '').replace(/\\n/g, '\n');
  const clientEmail = String(parsed?.client_email || '').trim();
  const tokenUri = String(parsed?.token_uri || 'https://oauth2.googleapis.com/token').trim();

  if (!privateKey || !clientEmail) {
    throw new Error(`${sourceLabel} missing client_email/private_key`);
  }

  return { privateKey, clientEmail, tokenUri };
}

function getEnterpriseServiceAccount() {
  const rawJson = String(process.env.RECAPTCHA_ENTERPRISE_SERVICE_ACCOUNT_JSON || '').trim();
  if (rawJson) {
    return parseServiceAccount(rawJson, 'RECAPTCHA_ENTERPRISE_SERVICE_ACCOUNT_JSON');
  }

  const serviceFile = String(
    process.env.RECAPTCHA_ENTERPRISE_SERVICE_ACCOUNT_FILE ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    ''
  ).trim();
  if (serviceFile) {
    try {
      const fileJson = readFileSync(serviceFile, 'utf8');
      return parseServiceAccount(fileJson, `service account file ${serviceFile}`);
    } catch (err) {
      throw new Error(`Unable to read service account file (${serviceFile}): ${err?.message || 'read failed'}`);
    }
  }

  const clientEmail = String(
    process.env.RECAPTCHA_ENTERPRISE_CLIENT_EMAIL ||
    process.env.GOOGLE_CLIENT_EMAIL ||
    ''
  ).trim();
  const privateKey = String(
    process.env.RECAPTCHA_ENTERPRISE_PRIVATE_KEY ||
    process.env.GOOGLE_PRIVATE_KEY ||
    ''
  ).replace(/\\n/g, '\n');
  const tokenUri = String(process.env.RECAPTCHA_ENTERPRISE_TOKEN_URI || 'https://oauth2.googleapis.com/token').trim();

  if (clientEmail && privateKey) {
    return { clientEmail, privateKey, tokenUri };
  }

  throw new Error(
    'RECAPTCHA_ENTERPRISE_SERVICE_ACCOUNT_JSON missing (or set RECAPTCHA_ENTERPRISE_SERVICE_ACCOUNT_FILE / GOOGLE_APPLICATION_CREDENTIALS / RECAPTCHA_ENTERPRISE_CLIENT_EMAIL+RECAPTCHA_ENTERPRISE_PRIVATE_KEY)'
  );
}

function signServiceAccountAssertion({ clientEmail, privateKey, tokenUri }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUri,
    iat: now,
    exp: now + 3600
  };

  const encodedHeader = base64UrlJson(header);
  const encodedPayload = base64UrlJson(payload);
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(privateKey, 'base64url');
  return `${unsignedToken}.${signature}`;
}

async function getEnterpriseAccessToken() {
  const now = Date.now();
  if (enterpriseAccessTokenCache.token && enterpriseAccessTokenCache.expiresAtMs > now + 60_000) {
    return enterpriseAccessTokenCache.token;
  }

  const serviceAccount = getEnterpriseServiceAccount();
  const assertion = signServiceAccountAssertion(serviceAccount);

  const tokenParams = new URLSearchParams();
  tokenParams.set('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  tokenParams.set('assertion', assertion);

  const tokenResp = await fetch(serviceAccount.tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams.toString()
  });

  const tokenData = await tokenResp.json().catch(() => ({}));
  if (!tokenResp.ok || !tokenData?.access_token) {
    const reason = tokenData?.error_description || tokenData?.error || `HTTP ${tokenResp.status}`;
    throw new Error(`OAuth token fetch failed (${reason})`);
  }

  const expiresInSec = Number(tokenData?.expires_in || 3600);
  enterpriseAccessTokenCache = {
    token: tokenData.access_token,
    expiresAtMs: now + Math.max(60, expiresInSec) * 1000
  };

  return enterpriseAccessTokenCache.token;
}

async function verifyCaptchaEnterprise(token, expectedAction) {
  const projectID = process.env.RECAPTCHA_ENTERPRISE_PROJECT_ID;
  const recaptchaKey = process.env.RECAPTCHA_ENTERPRISE_SITE_KEY;

  if (!projectID || !recaptchaKey) {
    return { ok: false, provider: 'enterprise', reason: 'Enterprise captcha config missing' };
  }

  let accessToken;
  try {
    accessToken = await getEnterpriseAccessToken();
  } catch (err) {
    return {
      ok: false,
      provider: 'enterprise',
      reason: `Enterprise client not available (${err?.message || 'credentials not set'})`
    };
  }

  const responseResp = await fetch(`https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(projectID)}/assessments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      event: {
        token,
        siteKey: recaptchaKey
      }
    })
  });
  const response = await responseResp.json().catch(() => ({}));
  if (!responseResp.ok) {
    const msg = response?.error?.message || `HTTP ${responseResp.status}`;
    return { ok: false, provider: 'enterprise', reason: `Assessment API failed (${msg})` };
  }

  if (!response?.tokenProperties?.valid) {
    return {
      ok: false,
      provider: 'enterprise',
      reason: `Invalid captcha token (${response?.tokenProperties?.invalidReason || 'unknown'})`
    };
  }

  const rawAction = String(response?.tokenProperties?.action || '').trim();
  const actualAction = normalizeCaptchaAction(rawAction);
  if (expectedAction && (!rawAction || actualAction !== expectedAction)) {
    return { ok: false, provider: 'enterprise', reason: `Captcha action mismatch (${actualAction})` };
  }

  const minScore = parseMinScore(process.env.RECAPTCHA_ENTERPRISE_MIN_SCORE, parseMinScore(process.env.RECAPTCHA_MIN_SCORE, 0.4));
  const score = Number(response?.riskAnalysis?.score ?? 0);
  if (Number.isFinite(score) && score < minScore) {
    return { ok: false, provider: 'enterprise', reason: `Captcha score too low (${score})` };
  }

  return {
    ok: true,
    provider: 'enterprise',
    score: Number.isFinite(score) ? score : null
  };
}

function prefersEnterpriseCaptcha() {
  const mode = String(process.env.RECAPTCHA_MODE || '').trim().toLowerCase();
  if (mode === 'enterprise') return true;
  if (mode === 'classic') return false;
  return Boolean(process.env.RECAPTCHA_ENTERPRISE_PROJECT_ID && process.env.RECAPTCHA_ENTERPRISE_SITE_KEY);
}

async function verifyCaptcha(token, ip, expectedAction) {
  const explicitMode = String(process.env.RECAPTCHA_MODE || '').trim().toLowerCase();
  const enterpriseConfigured = Boolean(process.env.RECAPTCHA_ENTERPRISE_PROJECT_ID && process.env.RECAPTCHA_ENTERPRISE_SITE_KEY);
  const allowClassicFallback = String(process.env.RECAPTCHA_ALLOW_CLASSIC_FALLBACK || '').trim().toLowerCase() === 'true';
  const hasClassicSecret = Boolean(String(process.env.RECAPTCHA_SECRET || '').trim());

  // Respect explicit classic mode and avoid enterprise dependency entirely.
  if (explicitMode === 'classic') {
    return verifyCaptchaClassic(token, ip, '');
  }

  // If frontend sent an explicit action token, prefer Enterprise verification.
  if (explicitMode !== 'classic' && expectedAction && enterpriseConfigured) {
    const enterpriseResult = await verifyCaptchaEnterprise(token, expectedAction);
    if (enterpriseResult.ok) return enterpriseResult;

    const enterpriseConfigError =
      String(enterpriseResult?.reason || '').toLowerCase().includes('service account') ||
      String(enterpriseResult?.reason || '').toLowerCase().includes('credentials') ||
      String(enterpriseResult?.reason || '').toLowerCase().includes('config');
    if ((allowClassicFallback || enterpriseConfigError) && hasClassicSecret) {
      const classicResult = await verifyCaptchaClassic(token, ip, expectedAction);
      if (classicResult.ok) return classicResult;
    }
    return enterpriseResult;
  }

  if (prefersEnterpriseCaptcha()) {
    const enterpriseResult = await verifyCaptchaEnterprise(token, expectedAction);
    if (enterpriseResult.ok) return enterpriseResult;

    const enterpriseConfigError =
      String(enterpriseResult?.reason || '').toLowerCase().includes('service account') ||
      String(enterpriseResult?.reason || '').toLowerCase().includes('credentials') ||
      String(enterpriseResult?.reason || '').toLowerCase().includes('config');
    if ((allowClassicFallback || enterpriseConfigError) && hasClassicSecret) {
      const classicResult = await verifyCaptchaClassic(token, ip, expectedAction);
      if (classicResult.ok) return classicResult;
    }
    return enterpriseResult;
  }

  return verifyCaptchaClassic(token, ip, expectedAction);
}

function captchaFailureCode(check) {
  const reason = String(check?.reason || '').toLowerCase();
  const provider = String(check?.provider || '').toLowerCase();
  if (provider === 'text') {
    if (reason.includes('match')) return 'CAPTCHA_TEXT_MISMATCH';
    if (reason.includes('proof') || reason.includes('missing') || reason.includes('invalid')) return 'CAPTCHA_TEXT_INVALID';
    return 'CAPTCHA_TEXT_FAILED';
  }
  if (reason.includes('missing') || reason.includes('config')) {
    return provider === 'enterprise' ? 'CAPTCHA_ENTERPRISE_CONFIG' : 'CAPTCHA_CONFIG_ERROR';
  }
  if (reason.includes('client not available')) return 'CAPTCHA_ENTERPRISE_CLIENT_ERROR';
  if (reason.includes('action mismatch')) return 'CAPTCHA_ACTION_MISMATCH';
  if (reason.includes('score too low')) return 'CAPTCHA_LOW_SCORE';
  if (reason.includes('token rejected') || reason.includes('invalid captcha token')) return 'CAPTCHA_TOKEN_INVALID';
  return 'CAPTCHA_VERIFY_FAILED';
}

router.get('/captcha', (_req, res) => {
  try {
    const payload = buildTextCaptchaPayload();
    return res.json(payload);
  } catch (err) {
    console.error('captcha generate error:', err?.message || err);
    return res.status(500).json({ error: 'Unable to generate captcha right now' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, captchaToken, captchaAction, captchaInput, captchaProof } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
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
    let captchaCheck;
    if (captchaInput || captchaProof) {
      captchaCheck = verifyTextCaptcha(captchaInput, captchaProof);
    } else if (captchaToken) {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
      const expectedAction = captchaAction ? normalizeCaptchaAction(captchaAction) : '';
      captchaCheck = await verifyCaptcha(captchaToken, ip, expectedAction);
    } else {
      return res.status(400).json({ error: 'Captcha is required' });
    }
    if (!captchaCheck.ok) {
      const code = captchaFailureCode(captchaCheck);
      const details = process.env.NODE_ENV === 'production' ? undefined : captchaCheck.reason;
      console.warn('Captcha check failed:', { provider: captchaCheck.provider, reason: captchaCheck.reason, code });
      return res.status(400).json({ error: 'Captcha verification failed', code, details });
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
