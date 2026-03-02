/**
 * mailer.js — Email service for Adarsha High School Portal
 * Uses Nodemailer with Gmail SMTP.
 * Configure credentials in .env (EMAIL_USER + EMAIL_PASS = App Password)
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

const configured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS &&
    process.env.EMAIL_USER !== 'your_gmail@gmail.com');

// Create Gmail transporter (lazy — only if configured)
let transporter = null;
function getTransporter() {
    if (!transporter && configured) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });
    }
    return transporter;
}

const SCHOOL = process.env.SCHOOL_NAME || 'Adarsha High School';

/**
 * Send a real OTP email.
 * @param {string} toEmail   — recipient email address
 * @param {string} toName    — recipient's name
 * @param {string} otp       — 6-digit OTP code
 * @param {string} role      — 'student' or 'parent'
 * @returns {{ sent: boolean, preview?: string }}
 */
async function sendOtpEmail(toEmail, toName, otp, role) {
    const t = getTransporter();
    if (!t) {
        // Email not configured — fall back to console log
        console.log(`\n📧 [EMAIL NOT CONFIGURED — FALLBACK]\nTo: ${toEmail}\nOTP: ${otp}\n`);
        return { sent: false };
    }

    const roleLabel = role === 'student' ? 'Student' : 'Parent / Guardian';
    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:40px 20px">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155">
      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#2563eb,#0f766e);padding:32px 40px;text-align:center">
          <div style="font-size:2.2rem;margin-bottom:8px">🎓</div>
          <h1 style="margin:0;color:#fff;font-size:1.4rem;font-weight:800">${SCHOOL}</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.7);font-size:.85rem">Password Reset OTP</p>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:36px 40px">
          <p style="color:#cbd5e1;font-size:.95rem;margin:0 0 16px">Hello <strong style="color:#f1f5f9">${toName}</strong>,</p>
          <p style="color:#94a3b8;font-size:.88rem;margin:0 0 28px;line-height:1.6">
            You requested to reset your <strong style="color:#60a5fa">${roleLabel}</strong> account password on the ${SCHOOL} Portal.
            Use the OTP below to complete the reset.
          </p>

          <!-- OTP Box -->
          <div style="background:#0f172a;border:2px solid #3b82f6;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px">
            <p style="margin:0 0 8px;color:#94a3b8;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase">Your One-Time Password</p>
            <div style="font-size:2.5rem;font-weight:900;letter-spacing:.3em;color:#60a5fa;font-family:monospace">${otp}</div>
            <p style="margin:10px 0 0;color:#64748b;font-size:.75rem">⏰ Valid for <strong style="color:#f59e0b">10 minutes</strong></p>
          </div>

          <p style="color:#64748b;font-size:.8rem;margin:0;line-height:1.6">
            ⚠️ If you did not request this OTP, please ignore this email. Your account remains safe.<br/>
            Do not share this OTP with anyone.
          </p>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background:#0f172a;padding:20px 40px;text-align:center;border-top:1px solid #1e293b">
          <p style="margin:0;color:#475569;font-size:.75rem">${SCHOOL} Portal · Automated Email · Do Not Reply</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

    await t.sendMail({
        from: `"${SCHOOL} Portal" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: `${otp} — Your OTP for ${SCHOOL} Portal`,
        html,
        text: `Hello ${toName},\n\nYour OTP to reset your ${roleLabel} account password is: ${otp}\n\nThis OTP is valid for 10 minutes. Do not share it with anyone.\n\n— ${SCHOOL} Portal`,
    });

    return { sent: true };
}

module.exports = { sendOtpEmail, configured };
