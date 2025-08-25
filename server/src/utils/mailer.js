import nodemailer from 'nodemailer';

const FROM = process.env.MAIL_FROM;
const APP = (process.env.MAIL_APP_PASS || '').replace(/\s+/g, ''); 

export const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: FROM, pass: APP },
});

export async function sendMail({ to, subject, html }) {
  try {
    return await mailer.sendMail({
      from: `"Budget Buddy" <${FROM}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('sendMail error:', err?.response?.toString?.() || err);
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

