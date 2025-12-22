// Supabase Edge Function: Send candidate registration/completion notifications
// Sends detailed email to info@jobsynt.com when candidates register or complete profiles

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import nodemailer from 'https://esm.sh/nodemailer@6.9.13';

const ZOHO_PASSWORD = Deno.env.get('ZOHO_PASSWORD');

interface ProfileData {
  id?: string;
  email?: string;
  name?: string;
  phone?: string;
  title?: string;
  location?: string;
  experience_years?: number;
  skills?: string[];
  primary_skills?: string[];
  secondary_skills?: string[];
  adjacent_skills?: string[];
  generic_skills?: string[];
  contract_type?: string[];
  work_mode?: string[];
  preferred_job_types?: string[];
  preferred_job_type?: string;
  visa_status?: string;
  rate_expectation?: string;
  availability?: string;
  summary?: string;
  image_url?: string;
  onboarding_complete?: boolean;
  role?: string;
  trial_ends_at?: string;
  is_paid?: boolean;
  paid_at?: string;
  created_at?: string;
  updated_at?: string;
}

serve(async (req) => {
  try {
    const { profile, action } = await req.json();

    if (!profile || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing profile or action' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!ZOHO_PASSWORD) {
      console.error('ZOHO_PASSWORD environment variable not set');
      return new Response(
        JSON.stringify({ error: 'Email configuration missing' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const profileData: ProfileData = profile;

    // Format candidate details for email
    const formatValue = (value: any): string => {
      if (value === null || value === undefined) return 'Not provided';
      if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'Not provided';
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (typeof value === 'object') return JSON.stringify(value, null, 2);
      return String(value);
    };

    const formatDate = (dateStr: string | null | undefined): string => {
      if (!dateStr) return 'Not provided';
      try {
        return new Date(dateStr).toLocaleString('en-US', {
          timeZone: 'UTC',
          dateStyle: 'long',
          timeStyle: 'short',
        });
      } catch {
        return dateStr;
      }
    };

    // Build detailed email content
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .section { background: white; padding: 20px; margin-bottom: 15px; border-radius: 6px; border-left: 4px solid #4F46E5; }
    .section h3 { margin-top: 0; color: #4F46E5; }
    .field { margin: 10px 0; }
    .field-label { font-weight: bold; color: #1f2937; }
    .field-value { color: #6b7280; margin-left: 10px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-complete { background: #D1FAE5; color: #065F46; }
    .status-incomplete { background: #FEE2E2; color: #991B1B; }
    .status-paid { background: #DBEAFE; color: #1E40AF; }
    .status-trial { background: #FEF3C7; color: #92400E; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${action === 'registration' ? 'New Candidate Registration' : 'Profile Completion'}</h1>
    </div>
    <div class="content">
      <div class="section">
        <h3>Basic Information</h3>
        <div class="field">
          <span class="field-label">Email:</span>
          <span class="field-value">${formatValue(profileData.email)}</span>
        </div>
        <div class="field">
          <span class="field-label">Name:</span>
          <span class="field-value">${formatValue(profileData.name)}</span>
        </div>
        <div class="field">
          <span class="field-label">Phone:</span>
          <span class="field-value">${formatValue(profileData.phone)}</span>
        </div>
        <div class="field">
          <span class="field-label">Title:</span>
          <span class="field-value">${formatValue(profileData.title)}</span>
        </div>
        <div class="field">
          <span class="field-label">Location:</span>
          <span class="field-value">${formatValue(profileData.location)}</span>
        </div>
        <div class="field">
          <span class="field-label">Experience (Years):</span>
          <span class="field-value">${formatValue(profileData.experience_years)}</span>
        </div>
      </div>

      <div class="section">
        <h3>Skills</h3>
        <div class="field">
          <span class="field-label">Primary Skills:</span>
          <span class="field-value">${formatValue(profileData.primary_skills)}</span>
        </div>
        <div class="field">
          <span class="field-label">Secondary Skills:</span>
          <span class="field-value">${formatValue(profileData.secondary_skills)}</span>
        </div>
        <div class="field">
          <span class="field-label">Adjacent Skills:</span>
          <span class="field-value">${formatValue(profileData.adjacent_skills)}</span>
        </div>
        <div class="field">
          <span class="field-label">Generic Skills:</span>
          <span class="field-value">${formatValue(profileData.generic_skills)}</span>
        </div>
        ${profileData.skills ? `
        <div class="field">
          <span class="field-label">Legacy Skills:</span>
          <span class="field-value">${formatValue(profileData.skills)}</span>
        </div>
        ` : ''}
      </div>

      <div class="section">
        <h3>Job Preferences</h3>
        <div class="field">
          <span class="field-label">Contract Type:</span>
          <span class="field-value">${formatValue(profileData.contract_type)}</span>
        </div>
        <div class="field">
          <span class="field-label">Work Mode:</span>
          <span class="field-value">${formatValue(profileData.work_mode)}</span>
        </div>
        <div class="field">
          <span class="field-label">Preferred Job Types:</span>
          <span class="field-value">${formatValue(profileData.preferred_job_types)}</span>
        </div>
        <div class="field">
          <span class="field-label">Preferred Job Type (Legacy):</span>
          <span class="field-value">${formatValue(profileData.preferred_job_type)}</span>
        </div>
      </div>

      <div class="section">
        <h3>Additional Details</h3>
        <div class="field">
          <span class="field-label">Visa Status:</span>
          <span class="field-value">${formatValue(profileData.visa_status)}</span>
        </div>
        <div class="field">
          <span class="field-label">Rate Expectation:</span>
          <span class="field-value">${formatValue(profileData.rate_expectation)}</span>
        </div>
        <div class="field">
          <span class="field-label">Availability:</span>
          <span class="field-value">${formatValue(profileData.availability)}</span>
        </div>
        <div class="field">
          <span class="field-label">Summary:</span>
          <span class="field-value">${formatValue(profileData.summary)}</span>
        </div>
      </div>

      <div class="section">
        <h3>Status & Access</h3>
        <div class="field">
          <span class="field-label">Role:</span>
          <span class="field-value">${formatValue(profileData.role)}</span>
        </div>
        <div class="field">
          <span class="field-label">Onboarding Complete:</span>
          <span class="field-value">
            <span class="status-badge ${profileData.onboarding_complete ? 'status-complete' : 'status-incomplete'}">
              ${profileData.onboarding_complete ? 'Yes' : 'No'}
            </span>
          </span>
        </div>
        <div class="field">
          <span class="field-label">Payment Status:</span>
          <span class="field-value">
            <span class="status-badge ${profileData.is_paid ? 'status-paid' : 'status-trial'}">
              ${profileData.is_paid ? 'Paid' : 'Trial/Unpaid'}
            </span>
          </span>
        </div>
        ${profileData.trial_ends_at ? `
        <div class="field">
          <span class="field-label">Trial Ends At:</span>
          <span class="field-value">${formatDate(profileData.trial_ends_at)}</span>
        </div>
        ` : ''}
        ${profileData.paid_at ? `
        <div class="field">
          <span class="field-label">Paid At:</span>
          <span class="field-value">${formatDate(profileData.paid_at)}</span>
        </div>
        ` : ''}
      </div>

      <div class="section">
        <h3>Timestamps</h3>
        <div class="field">
          <span class="field-label">Created At:</span>
          <span class="field-value">${formatDate(profileData.created_at)}</span>
        </div>
        <div class="field">
          <span class="field-label">Updated At:</span>
          <span class="field-value">${formatDate(profileData.updated_at)}</span>
        </div>
      </div>

      ${profileData.id ? `
      <div class="section">
        <h3>Profile ID</h3>
        <div class="field">
          <span class="field-label">ID:</span>
          <span class="field-value">${profileData.id}</span>
        </div>
      </div>
      ` : ''}
    </div>
  </div>
</body>
</html>
    `;

    const emailText = `
${action === 'registration' ? 'New Candidate Registration' : 'Profile Completion'}

Basic Information:
- Email: ${formatValue(profileData.email)}
- Name: ${formatValue(profileData.name)}
- Phone: ${formatValue(profileData.phone)}
- Title: ${formatValue(profileData.title)}
- Location: ${formatValue(profileData.location)}
- Experience: ${formatValue(profileData.experience_years)} years

Skills:
- Primary: ${formatValue(profileData.primary_skills)}
- Secondary: ${formatValue(profileData.secondary_skills)}
- Adjacent: ${formatValue(profileData.adjacent_skills)}
- Generic: ${formatValue(profileData.generic_skills)}

Job Preferences:
- Contract Type: ${formatValue(profileData.contract_type)}
- Work Mode: ${formatValue(profileData.work_mode)}
- Preferred Job Types: ${formatValue(profileData.preferred_job_types)}

Additional Details:
- Visa Status: ${formatValue(profileData.visa_status)}
- Rate Expectation: ${formatValue(profileData.rate_expectation)}
- Availability: ${formatValue(profileData.availability)}
- Summary: ${formatValue(profileData.summary)}

Status:
- Role: ${formatValue(profileData.role)}
- Onboarding Complete: ${profileData.onboarding_complete ? 'Yes' : 'No'}
- Payment Status: ${profileData.is_paid ? 'Paid' : 'Trial/Unpaid'}
${profileData.trial_ends_at ? `- Trial Ends At: ${formatDate(profileData.trial_ends_at)}` : ''}
${profileData.paid_at ? `- Paid At: ${formatDate(profileData.paid_at)}` : ''}

Timestamps:
- Created At: ${formatDate(profileData.created_at)}
- Updated At: ${formatDate(profileData.updated_at)}
${profileData.id ? `\nProfile ID: ${profileData.id}` : ''}
    `;

    // Send email using Zoho SMTP via nodemailer
    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: 'info@jobsynt.com',
        pass: ZOHO_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates if needed
      },
    });

    const subject = `JobSynt: ${action === 'registration' ? 'New Candidate Registration' : 'Profile Completion'} - ${formatValue(profileData.email)}`;

    await transporter.sendMail({
      from: 'info@jobsynt.com',
      to: 'info@jobsynt.com',
      subject: subject,
      html: emailHtml,
      text: emailText,
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-candidate-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

