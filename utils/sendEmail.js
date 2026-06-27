const { Resend } = require('resend');

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html }) => {
  try {
    console.log('📧 Attempting to send email...');
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
      console.error('❌ Resend API Error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to send email' 
      };
    }

    // Success - data.id contains the email ID
    if (data?.id) {
      console.log('✅ Email sent successfully!');
      console.log('   Message ID:', data.id);
      return { success: true, data };
    }

    // Unknown response
    console.log('⚠️ Unexpected Resend response:', data);
    return { success: false, error: 'Unknown response from Resend' };

  } catch (error) {
    console.error('❌ Email exception:', error.message);
    
    // Handle specific Resend errors
    if (error.statusCode === 403) {
      console.error('   → Sandbox mode: You can only send to verified emails');
      console.error('   → Add this email to your Resend dashboard or verify your domain');
    }
    
    return { success: false, error: error.message };
  }
};

// Welcome Email Template
const getWelcomeEmailTemplate = (name, coopId) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          line-height: 1.8; 
          color: #333; 
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: white;
        }
        .header { 
          background: linear-gradient(135deg, #96158F, #6B21A8); 
          color: white; 
          padding: 40px 30px; 
          text-align: center; 
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header .subtitle {
          font-size: 14px;
          opacity: 0.9;
          margin-top: 10px;
        }
        .content { 
          padding: 40px 30px; 
          background: white; 
        }
        .welcome-box {
          background: #fdf2f8;
          border-left: 4px solid #96158F;
          padding: 20px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .coop-id-box {
          background: #1a1a1a;
          color: #CC9838;
          padding: 20px;
          text-align: center;
          border-radius: 8px;
          margin: 30px 0;
          font-family: 'Courier New', monospace;
        }
        .coop-id-box .label {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #999;
          margin-bottom: 8px;
        }
        .coop-id-box .id {
          font-size: 24px;
          font-weight: bold;
          letter-spacing: 3px;
        }
        .benefits {
          margin: 30px 0;
        }
        .benefit-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 20px;
        }
        .benefit-icon {
          background: #96158F;
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }
        .benefit-text h4 {
          margin: 0 0 4px 0;
          color: #96158F;
          font-size: 16px;
        }
        .benefit-text p {
          margin: 0;
          font-size: 14px;
          color: #666;
        }
        .button { 
          display: inline-block; 
          padding: 16px 40px; 
          background: #96158F; 
          color: white; 
          text-decoration: none; 
          border-radius: 8px; 
          font-weight: 600;
          font-size: 16px;
          margin: 10px 0; 
          text-align: center;
        }
        .divider {
          border-top: 1px solid #e5e5e5;
          margin: 30px 0;
        }
        .footer { 
          text-align: center; 
          padding: 30px; 
          color: #999; 
          font-size: 13px;
          background: #f9f9f9;
          line-height: 2;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to PWWE!</h1>
          <div class="subtitle">The Power Within Women Empowerment Foundation</div>
        </div>
        
        <div class="content">
          <h2>Dear ${name},</h2>
          
          <p>We are thrilled to welcome you to <strong>The Power Within Women Empowerment Foundation</strong> – a community of strong, ambitious women transforming their lives and communities through financial empowerment, skills development, and mutual support.</p>
          
          <div class="welcome-box">
            <p style="margin: 0;">✨ <strong>Your journey to financial independence and personal growth starts here!</strong></p>
          </div>
          
          ${coopId ? `
          <div class="coop-id-box">
            <div class="label">Your Cooperative ID</div>
            <div class="id">${coopId}</div>
            <p style="margin-top: 10px; font-size: 12px; color: #999;">Keep this ID safe – you'll need it for cooperative activities</p>
          </div>
          ` : ''}
          
          <h3>🌟 What You Get as a PWWE Member:</h3>
          
          <div class="benefits">
            <div class="benefit-item">
              <div class="benefit-icon">💰</div>
              <div class="benefit-text">
                <h4>Cooperative Savings</h4>
                <p>Join savings groups with rotating payouts to help you achieve your financial goals faster</p>
              </div>
            </div>
            
            <div class="benefit-item">
              <div class="benefit-icon">🎓</div>
              <div class="benefit-text">
                <h4>Skills Training</h4>
                <p>Access vocational training and workshops to develop marketable skills</p>
              </div>
            </div>
            
            <div class="benefit-item">
              <div class="benefit-icon">🤝</div>
              <div class="benefit-text">
                <h4>Business Mentorship</h4>
                <p>Get guidance from experienced entrepreneurs to start or grow your business</p>
              </div>
            </div>
            
            <div class="benefit-item">
              <div class="benefit-icon">👥</div>
              <div class="benefit-text">
                <h4>Supportive Community</h4>
                <p>Connect with like-minded women who support and uplift each other</p>
              </div>
            </div>
          </div>
          
          <div class="divider"></div>
          
          <center>
            <p style="font-size: 16px; font-weight: 600; margin-bottom: 20px;">Ready to get started?</p>
            <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Go to Your Dashboard</a>
          </center>
          
          <div class="divider"></div>
          
          <p style="font-size: 14px; color: #666;">
            <strong>Next Steps:</strong><br>
            1️⃣ Complete your profile<br>
            2️⃣ Explore available cooperative groups<br>
            3️⃣ Sign up for upcoming training programs<br>
            4️⃣ Connect with other members
          </p>
        </div>
        
        <div class="footer">
          <p><strong>The Power Within Women Empowerment Foundation</strong></p>
          <p>Empowering women, transforming communities</p>
          <p>© ${new Date().getFullYear()} PWWE Foundation. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Email Verification Template
const getVerificationEmailTemplate = (name, verificationUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6B21A8; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { 
          display: inline-block; 
          padding: 12px 30px; 
          background: #6B21A8; 
          color: white; 
          text-decoration: none; 
          border-radius: 5px; 
          margin: 20px 0; 
        }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your Email</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>Thank you for joining The Power Within Women Empowerment Foundation. Please verify your email address to get started:</p>
          <center>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </center>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all;">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create this account, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} PWWE Foundation. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Password Reset Template
const getResetPasswordEmailTemplate = (name, resetUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #CC9838; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { 
          display: inline-block; 
          padding: 12px 30px; 
          background: #CC9838; 
          color: white; 
          text-decoration: none; 
          border-radius: 5px; 
          margin: 20px 0; 
        }
        .warning { 
          background: #fff3cd; 
          border: 1px solid #ffc107; 
          padding: 15px; 
          border-radius: 5px; 
          margin: 20px 0; 
        }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <center>
            <a href="${resetUrl}" class="button">Reset Password</a>
          </center>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all;">${resetUrl}</p>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you didn't request this change, please ignore this email or contact support.
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} PWWE Foundation. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = { 
  sendEmail, 
  getWelcomeEmailTemplate,
  getVerificationEmailTemplate, 
  getResetPasswordEmailTemplate 
};