import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'sandbox.smtp.mailtrap.io',
  port: parseInt(process.env.EMAIL_PORT || '2525'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
});

transporter.verify()
  .then(() => console.log('✅ Email service connected to Mailtrap'))
  .catch(err => console.log('📧 Email service using console log (Mailtrap error):', err.message));

export const emailService = {
  async sendOtpEmail(to: string, otp: string, purpose: string): Promise<boolean> {
    try {
      const info = await transporter.sendMail({
        from: `"Telcotec" <${process.env.EMAIL_FROM || 'noreply@telcotec.tn'}>`,
        to: to,
        subject: `Telcotec OTP Code: ${otp}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #4a6bdf;">Telcotec Verification Code</h2>
            <p>Your OTP for ${purpose}:</p>
            <div style="background: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; border: 2px dashed #4a6bdf;">
              <h1 style="color: #4a6bdf; margin: 0; font-size: 36px; letter-spacing: 10px;">${otp}</h1>
            </div>
            <p><strong>Expires in 5 minutes</strong></p>
            <p>If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              Telcotec - Telecom GIS Platform<br>
              This is an automated message.
            </p>
          </div>
        `,
        text: `Your Telcotec OTP: ${otp}\nExpires in 5 minutes.\nPurpose: ${purpose}`
      });
      
      console.log(` OTP email sent to ${to} (Message ID: ${info.messageId})`);
      return true;
      
    } catch (error: any) {
      console.error(' Failed to send OTP email:', error.message);
      console.log(` [DEV] OTP for ${to}: ${otp}`);
      return false;
    }
  },

  // Send password reset email
  async sendResetEmail(to: string, resetLink: string): Promise<boolean> {
    try {
      const info = await transporter.sendMail({
        from: `"Telcotec" <${process.env.EMAIL_FROM || 'noreply@telcotec.tn'}>`,
        to: to,
        subject: 'Reset Your Telcotec Password',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #4a6bdf;">Reset Your Password</h2>
            <p>Click the link below to reset your password:</p>
            <div style="text-align: center; margin: 25px 0;">
              <a href="${resetLink}" 
                 style="background: #4a6bdf; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 6px; font-weight: bold;">
                Reset Password
              </a>
            </div>
            <p>Or copy this link:<br><code style="background: #f8f9fa; padding: 10px; border-radius: 4px;">${resetLink}</code></p>
            <p><strong> This link expires in 15 minutes</strong></p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              Telcotec - Telecom GIS Platform<br>
              This is an automated message.
            </p>
          </div>
        `,
        text: `Reset your Telcotec password: ${resetLink}\nThis link expires in 15 minutes.`
      });
      
      console.log(` Reset email sent to ${to} (Message ID: ${info.messageId})`);
      return true;
      
    } catch (error: any) {
      console.error(' Failed to send reset email:', error.message);
      console.log(` [DEV] Reset link for ${to}: ${resetLink}`);
      return false;
    }
  },

  async testEmail(): Promise<void> {
    try {
      await transporter.sendMail({
        from: `"Telcotec Test" <${process.env.EMAIL_FROM || 'noreply@telcotec.tn'}>`,
        to: 'test@example.com',
        subject: 'Test Email from Telcotec',
        text: 'This is a test email from Telcotec backend.'
      });
      console.log(' Test email sent successfully');
    } catch (error: any) {
      console.error(' Test email failed:', error.message);
    }
  }
};