import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Generic SMTP email service. Works with any provider (Gmail, Brevo,
 * SendGrid, Mailgun, your own server...) purely through .env.
 * Emails can be delivered to ANY recipient address (Gmail, Outlook, Yahoo, ...).
 *
 * Option A - preset (simplest for Gmail):
 *   EMAIL_SERVICE=gmail
 *   EMAIL_USER=yourapp@gmail.com
 *   EMAIL_PASS=<16-char Google App Password>
 *
 * Option B - any SMTP server:
 *   EMAIL_HOST=smtp.example.com
 *   EMAIL_PORT=587          (465 => implicit TLS, 587 => STARTTLS)
 *   EMAIL_USER=...
 *   EMAIL_PASS=...
 */

const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== 'false';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Telcotec';
const FROM_ADDRESS = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@telcotec.tn';
const FROM = `"${FROM_NAME}" <${FROM_ADDRESS}>`;

const buildTransporter = (): Transporter | null => {
  if (!EMAIL_ENABLED) return null;

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    console.warn('📧 EMAIL_USER / EMAIL_PASS not set - emails will NOT be sent.');
    return null;
  }

  if (process.env.EMAIL_SERVICE) {
    // nodemailer well-known presets: gmail, outlook365, hotmail, yahoo, ...
    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: { user, pass }
    });
  }

  const host = process.env.EMAIL_HOST;
  if (!host) {
    console.warn('📧 Set EMAIL_SERVICE or EMAIL_HOST in .env - emails will NOT be sent.');
    return null;
  }
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);
  const secure = process.env.EMAIL_SECURE
    ? process.env.EMAIL_SECURE === 'true'
    : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,                 // true for 465, false for 587 (STARTTLS is upgraded automatically)
    requireTLS: !secure,    // refuse to send credentials over a plain connection
    auth: { user, pass }
  });
};

const transporter = buildTransporter();

if (transporter) {
  transporter
    .verify()
    .then(() => console.log(`✅ Email service ready (sending as ${FROM_ADDRESS})`))
    .catch(err =>
      console.error('❌ Email service could not connect/authenticate:', err.message)
    );
}

const layout = (title: string, body: string) => `
  <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto;">
    <h2 style="color: #4a6bdf;">${title}</h2>
    ${body}
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #666; font-size: 12px;">
      Telcotec - Telecom GIS Platform<br>
      This is an automated message, please do not reply.
    </p>
  </div>`;

const purposeLabel = (purpose: string): string => {
  switch (purpose) {
    case 'login': return 'signing in';
    case '2fa-enable': return 'enabling two-factor authentication';
    case 'reset-password': return 'resetting your password';
    case 'verify-email': return 'verifying your email address';
    default: return purpose;
  }
};

const send = async (to: string, subject: string, html: string, text: string): Promise<boolean> => {
  if (!transporter) {
    console.error(`❌ Email not sent to ${to}: email service is not configured.`);
    return false;
  }
  try {
    const info = await transporter.sendMail({ from: FROM, to, subject, html, text });
    console.log(`📧 Email sent to ${to} (Message ID: ${info.messageId})`);
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    return false;
  }
};

export const emailService = {
  async sendOtpEmail(to: string, otp: string, purpose: string): Promise<boolean> {
    const expiry = process.env.OTP_EXPIRY_MINUTES || '5';
    const html = layout(
      'Telcotec Verification Code',
      `<p>Use this code for ${purposeLabel(purpose)}:</p>
       <div style="background: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; border: 2px dashed #4a6bdf;">
         <h1 style="color: #4a6bdf; margin: 0; font-size: 36px; letter-spacing: 10px;">${otp}</h1>
       </div>
       <p><strong>Expires in ${expiry} minutes.</strong></p>
       <p>If you didn't request this, please ignore this email.</p>`
    );
    return send(
      to,
      `Your Telcotec verification code: ${otp}`,
      html,
      `Your Telcotec verification code: ${otp}\nIt expires in ${expiry} minutes.\nPurpose: ${purposeLabel(purpose)}`
    );
  },

  async sendResetEmail(to: string, resetLink: string): Promise<boolean> {
    const expiry = process.env.PASSWORD_RESET_EXPIRY_MINUTES || '15';
    const html = layout(
      'Reset Your Password',
      `<p>Click the button below to choose a new password:</p>
       <div style="text-align: center; margin: 25px 0;">
         <a href="${resetLink}"
            style="background: #4a6bdf; color: white; padding: 12px 24px;
                   text-decoration: none; border-radius: 6px; font-weight: bold;">
           Reset Password
         </a>
       </div>
       <p>Or copy this link into your browser:<br>
          <code style="background: #f8f9fa; padding: 10px; border-radius: 4px; word-break: break-all;">${resetLink}</code></p>
       <p><strong>This link expires in ${expiry} minutes.</strong></p>
       <p>If you didn't request this, you can safely ignore this email.</p>`
    );
    return send(
      to,
      'Reset your Telcotec password',
      html,
      `Reset your Telcotec password: ${resetLink}\nThis link expires in ${expiry} minutes.`
    );
  }
};