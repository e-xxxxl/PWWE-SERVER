const { Resend } = require('resend');

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
  try {
    console.log('Attempting to send email...');
    console.log('   From:', process.env.FROM_EMAIL);
    console.log('   To:', to);
    console.log('   Subject:', subject);

    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL,
      to: [to], // Resend expects an array of recipients
      subject: subject,
      html: html,
    });

    // Check for Resend API errors
    if (error) {
      console.error('Resend API Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email'
      };
    }

    // Success - data.id contains the email ID
    if (data?.id) {
      console.log('Email sent successfully. Message ID:', data.id);
      return { success: true, data };
    }

    // Unknown response
    console.log('Unexpected Resend response:', data);
    return { success: false, error: 'Unknown response from Resend' };

  } catch (error) {
    console.error('Email exception:', error.message);

    // Handle specific Resend errors
    if (error.statusCode === 403) {
      console.error('   -> Sandbox mode: You can only send to verified emails');
      console.error('   -> Add this email to your Resend dashboard or verify your domain');
    }

    return { success: false, error: error.message };
  }
};

// -----------------------------------------------------------------------
// Shared layout pieces
// -----------------------------------------------------------------------

const BRAND_COLOR = '#96158F';
const INK = '#1A1A1A';
const MUTED = '#6B6B6B';
const BORDER = '#E7E5E4';
const BG = '#F5F3F2';

// Set LOGO_URL in your .env, e.g. LOGO_URL=https://yourdomain.com/logo.png
const LOGO_URL = process.env.LOGO_URL || "https://res.cloudinary.com/dhkzg2gfk/image/upload/v1783336483/logo-removebg-preview_hopk7z.png";

const emailHeader = () => `
  <tr>
    <td style="padding: 32px 40px 24px 40px; border-bottom: 1px solid ${BORDER};">
      <img src="${LOGO_URL}" alt="PWWE Foundation" height="36" style="height: 36px; display: block;" />
    </td>
  </tr>
`;

const emailFooter = () => `
  <tr>
    <td style="padding: 28px 40px; border-top: 1px solid ${BORDER}; background: ${BG};">
      <p style="margin: 0 0 6px 0; font-size: 12px; color: ${MUTED}; line-height: 1.6;">
        The Power Within Women Empowerment Foundation
      </p>
      <p style="margin: 0 0 6px 0; font-size: 12px; color: ${MUTED}; line-height: 1.6;">
        This message was sent to you because you have an account with PWWE Foundation.
      </p>
      <p style="margin: 0; font-size: 12px; color: ${MUTED};">
        &copy; ${new Date().getFullYear()} PWWE Foundation. All rights reserved.
      </p>
    </td>
  </tr>
`;

const emailShell = (bodyContent) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin: 0; padding: 0; background: ${BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${BG}; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background: #FFFFFF; border-radius: 6px; overflow: hidden; border: 1px solid ${BORDER};">
            ${emailHeader()}
            <tr>
              <td style="padding: 36px 40px;">
                ${bodyContent}
              </td>
            </tr>
            ${emailFooter()}
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
`;

const button = (url, label) => `
  <a href="${url}" style="display: inline-block; padding: 13px 28px; background: ${BRAND_COLOR}; color: #FFFFFF; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 14px;">
    ${label}
  </a>
`;

// -----------------------------------------------------------------------
// Welcome Email
// -----------------------------------------------------------------------

const getWelcomeEmailTemplate = (name, coopId) => {
  const body = `
    <p style="margin: 0 0 4px 0; font-size: 13px; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.5px;">Welcome</p>
    <h1 style="margin: 0 0 20px 0; font-size: 22px; color: ${INK}; font-weight: 600;">Hi ${name}, your account is ready</h1>

    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.7; color: ${INK};">
      Thank you for joining The Power Within Women Empowerment Foundation. Your membership gives you access to cooperative savings, business mentorship, and skills training designed to support your financial growth.
    </p>

    ${coopId ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${BG}; border-radius: 4px; margin: 24px 0;">
      <tr>
        <td style="padding: 16px 20px;">
          <p style="margin: 0 0 4px 0; font-size: 11px; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.5px;">Your Cooperative ID</p>
          <p style="margin: 0; font-size: 18px; color: ${INK}; font-weight: 600; letter-spacing: 1px; font-family: 'Courier New', monospace;">${coopId}</p>
        </td>
      </tr>
    </table>
    ` : ''}

    <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: ${INK};">Getting started</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 28px 0;">
      <tr><td style="padding: 3px 0; font-size: 14px; color: ${INK}; line-height: 1.6;">1. Complete your member profile</td></tr>
      <tr><td style="padding: 3px 0; font-size: 14px; color: ${INK}; line-height: 1.6;">2. Browse available cooperative groups</td></tr>
      <tr><td style="padding: 3px 0; font-size: 14px; color: ${INK}; line-height: 1.6;">3. Register for upcoming training sessions</td></tr>
    </table>

    ${button(`${process.env.FRONTEND_URL}/dashboard`, 'Go to Dashboard')}

    <p style="margin: 28px 0 0 0; font-size: 13px; color: ${MUTED}; line-height: 1.6;">
      If you have any questions, simply reply to this email — our team is happy to help.
    </p>
  `;
  return emailShell(body);
};

// -----------------------------------------------------------------------
// Email Verification
// -----------------------------------------------------------------------

const getVerificationEmailTemplate = (name, verificationUrl) => {
  const body = `
    <p style="margin: 0 0 4px 0; font-size: 13px; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.5px;">Verify your email</p>
    <h1 style="margin: 0 0 20px 0; font-size: 22px; color: ${INK}; font-weight: 600;">Confirm your email address</h1>

    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK};">
      Hi ${name}, thanks for signing up with PWWE Foundation. Please confirm your email address to activate your account.
    </p>

    ${button(verificationUrl, 'Verify Email Address')}

    <p style="margin: 24px 0 4px 0; font-size: 13px; color: ${MUTED};">Or copy and paste this link into your browser:</p>
    <p style="margin: 0 0 24px 0; font-size: 13px; color: ${BRAND_COLOR}; word-break: break-all;">${verificationUrl}</p>

    <p style="margin: 0; font-size: 13px; color: ${MUTED}; line-height: 1.6;">
      This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.
    </p>
  `;
  return emailShell(body);
};

// -----------------------------------------------------------------------
// Password Reset
// -----------------------------------------------------------------------

const getResetPasswordEmailTemplate = (name, resetUrl) => {
  const body = `
    <p style="margin: 0 0 4px 0; font-size: 13px; color: ${MUTED}; text-transform: uppercase; letter-spacing: 0.5px;">Password reset</p>
    <h1 style="margin: 0 0 20px 0; font-size: 22px; color: ${INK}; font-weight: 600;">Reset your password</h1>

    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.7; color: ${INK};">
      Hi ${name}, we received a request to reset the password on your account. Click below to choose a new one.
    </p>

    ${button(resetUrl, 'Reset Password')}

    <p style="margin: 24px 0 4px 0; font-size: 13px; color: ${MUTED};">Or copy and paste this link into your browser:</p>
    <p style="margin: 0 0 24px 0; font-size: 13px; color: ${BRAND_COLOR}; word-break: break-all;">${resetUrl}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${BG}; border-radius: 4px;">
      <tr>
        <td style="padding: 14px 18px; font-size: 13px; color: ${INK}; line-height: 1.6;">
          <strong>Security note:</strong> This link expires in 1 hour. If you didn't request a password reset, please ignore this email or contact support.
        </td>
      </tr>
    </table>
  `;
  return emailShell(body);
};

module.exports = {
  sendEmail,
  getWelcomeEmailTemplate,
  getVerificationEmailTemplate,
  getResetPasswordEmailTemplate
};