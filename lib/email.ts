import nodemailer from 'nodemailer';

// Email configuration
// Zoho SMTP: smtp.zoho.com, port 587 (STARTTLS), port 465 (SSL)
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.zoho.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === '465', // SSL for 465, STARTTLS for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Zoho requires TLS
  tls: {
    rejectUnauthorized: false, // Allow self-signed certificates if needed
  },
});

const FROM_EMAIL = process.env.EMAIL_FROM || 'info@jobsynt.com';
const SENDER_NAME = process.env.SENDER_NAME || 'JobSynt';
// Format: "JobSynt <info@jobsynt.com>" for better email display
const FROM_ADDRESS = SENDER_NAME ? `${SENDER_NAME} <${FROM_EMAIL}>` : FROM_EMAIL;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.jobsynt.com';

/**
 * Send password reset email to candidate (simplified flow)
 * Creates user account if needed and sends password reset link
 * Email is auto-verified when candidate clicks the link
 */
export async function sendAuthEmail(email: string, name: string): Promise<boolean> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('Supabase not configured - cannot send password reset');
      return false;
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists using admin API
    const { data: existingUser, error: getUserError } = await supabase.auth.admin.getUserByEmail(email);

    // If user doesn't exist, create them first (with temporary password)
    if (!existingUser?.user) {
      // Generate a secure random password
      const tempPassword = `Temp${Math.random().toString(36).slice(-12)}!${Date.now()}`;
      
      const { error: signupError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          role: 'candidate',
          name: name,
        },
      });

      if (signupError) {
        console.error('Error creating user:', signupError);
        return false;
      }
    }

    // Send password reset email (works for both new and existing users)
    // The reset link will auto-verify email and allow password setting
    const { error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${SITE_URL}/reset-password?email=${encodeURIComponent(email)}&type=recovery`,
      },
    });

    if (resetError) {
      console.error('Error generating password reset link:', resetError);
      // Fallback: use regular resetPasswordForEmail (requires anon key)
      const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
      const { error: fallbackError } = await supabaseAnon.auth.resetPasswordForEmail(email, {
        redirectTo: `${SITE_URL}/reset-password?email=${encodeURIComponent(email)}&type=recovery`,
      });
      
      if (fallbackError) {
        console.error('Error sending password reset (fallback):', fallbackError);
        return false;
      }
    }

    console.log(`✅ Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending auth email:', error);
    return false;
  }
}

/**
 * Send daily job digest email
 */
export async function sendDailyJobDigest(
  email: string,
  name: string,
  jobs: Array<{
    title: string;
    company: string;
    location: string;
    job_type: string | null;
    skills_required: string[] | null;
    url: string;
  }>
): Promise<boolean> {
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('Email not configured - skipping job digest');
      return false;
    }

    if (jobs.length === 0) {
      console.log(`No jobs to send to ${email}`);
      return true;
    }

    const loginLink = `${SITE_URL}/auth/login?email=${encodeURIComponent(email)}`;
    
    // Format job type for display
    const formatJobType = (type: string | null) => {
      if (!type) return 'Not specified';
      const types: Record<string, string> = {
        'full-time': 'Full-time',
        'w2-contract': 'W2 Contract',
        'c2c': 'C2C',
        '1099': '1099',
      };
      return types[type] || type;
    };

    // Build jobs HTML
    const jobsHtml = jobs.map((job, index) => `
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0; color: #1f2937;">${job.title}</h3>
        <p style="margin: 5px 0; color: #6b7280;"><strong>Company:</strong> ${job.company || 'Not specified'}</p>
        <p style="margin: 5px 0; color: #6b7280;"><strong>Location:</strong> ${job.location || 'Not specified'}</p>
        <p style="margin: 5px 0; color: #6b7280;"><strong>Job Type:</strong> ${formatJobType(job.job_type)}</p>
        ${job.skills_required && Array.isArray(job.skills_required) && job.skills_required.length > 0
          ? `<p style="margin: 5px 0; color: #6b7280;"><strong>Skills Required:</strong> ${job.skills_required.join(', ')}</p>`
          : ''
        }
        <p style="margin: 15px 0 0 0;">
          <a href="${loginLink}" style="color: #4F46E5; text-decoration: none; font-weight: 600;">
            Login to view detailed description →
          </a>
        </p>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Your Daily Job Matches</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Here are ${jobs.length} job${jobs.length > 1 ? 's' : ''} that match your profile, shortlisted by our AI Agent:</p>
            ${jobsHtml}
            <p style="text-align: center; margin-top: 30px;">
              <a href="${loginLink}" class="button">Login to View All Jobs</a>
            </p>
            <p style="text-align: center; color: #6b7280; font-size: 14px;">
              Login to your Jobsynt profile to see detailed job descriptions, apply directly, and access more opportunities.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Jobsynt. All rights reserved.</p>
            <p>This email was sent from info@jobsynt.com</p>
            <p>You're receiving this because you have a profile on Jobsynt.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await emailTransporter.sendMail({
      from: FROM_ADDRESS,
      to: email,
      subject: `Your Daily Job Matches - ${jobs.length} New Opportunity${jobs.length > 1 ? 'ies' : ''}`,
      html,
    });

    console.log(`✅ Daily job digest sent to ${email} (${jobs.length} jobs)`);
    return true;
  } catch (error) {
    console.error('Error sending daily job digest:', error);
    return false;
  }
}

