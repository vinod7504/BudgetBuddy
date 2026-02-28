import nodemailer from 'nodemailer';

const FIXED_SENDER = 'vinodkumarjntua@gmail.com';
const fromEnv = String(process.env.MAIL_FROM || '').trim().toLowerCase();
const FROM = FIXED_SENDER;
const APP = (process.env.MAIL_APP_PASS || '').replace(/\s+/g, '');

if (fromEnv && fromEnv !== FIXED_SENDER) {
  console.warn(`MAIL_FROM is ignored. Using fixed sender: ${FIXED_SENDER}`);
}

export const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: FROM, pass: APP },
});

export async function sendMail({ to, subject, html }) {
  try {
    return await mailer.sendMail({
      from: `"Budget Buddy" <${FROM}>`,
      to: String(to || '').trim().toLowerCase(),
      subject,
      html
    });
  } catch (err) {
    console.error('sendMail error =>', {
      code: err?.code,
      responseCode: err?.responseCode,
      command: err?.command,
      response: err?.response?.toString?.() || err?.message || String(err),
    });
    throw err;
  }
}

export async function verifyMailer() {
  try {
    await mailer.verify();
    console.log('Mailer verified: ready to send');
  } catch (e) {
    console.error('Mailer verify failed:', e?.response?.toString?.() || e);
  }
}
