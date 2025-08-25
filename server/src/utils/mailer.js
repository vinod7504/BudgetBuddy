import nodemailer from "nodemailer";

const FROM = process.env.MAIL_FROM;
const APP = process.env.MAIL_APP_PASS;

if (!FROM || !APP) {
  console.warn("MAIL_FROM or MAIL_APP_PASS not set. Emails will fail.");
}

export const mailer = nodemailer.createTransport({
  service: "gmail",
  auth: { user: FROM, pass: APP },
});

export async function sendMail({ to, subject, html }) {
  try {
    await mailer.sendMail({
      from: `"Budget Buddy" <${FROM}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("sendMail error:", err?.response || err?.message || err);
    throw err;
  }
}

export async function verifyMailer() {
  try {
    await mailer.verify();
    console.log("Mailer verified: ready to send");
  } catch (e) {
    console.error("Mailer verify failed:", e?.response || e?.message || e);
  }
}
