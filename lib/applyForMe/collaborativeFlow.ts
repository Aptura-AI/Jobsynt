/**
 * Collaborative Flow Module
 * 
 * Handles human-in-the-loop automation with pause/resume capabilities.
 * 
 * Responsibilities:
 * - Detect login/signup requirement
 * - Detect CAPTCHA
 * - Pause automation safely
 * - Emit human-intervention events
 * - Resume exactly where paused
 * 
 * RULE: CAPTCHA IS NOT A FAILURE
 * CAPTCHA is a Human-Intervention Gate, not an error.
 */

// Lazy Playwright imports (runtime only, not at build time)
// Use type imports for types to avoid build-time evaluation
import type { Page } from 'playwright';

import { createClient } from '@supabase/supabase-js';
import { InterventionReason, HumanInterventionEvent, SupportedApplySite } from './types';
import { checkInterventionTimeout, INTERVENTION_REMINDER_INTERVAL } from './timeouts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export interface PauseResult {
  paused: boolean;
  reason?: InterventionReason;
  message?: string;
  event?: HumanInterventionEvent;
}

/**
 * Detect if CAPTCHA is present on page
 */
export async function detectCaptcha(page: Page): Promise<boolean> {
  const captchaSelectors = [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    '.g-recaptcha',
    '#captcha',
    '[data-callback*="captcha"]',
    '[class*="captcha"]',
    '[id*="captcha"]',
  ];

  for (const selector of captchaSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 1000 })) {
        return true;
      }
    } catch (e) {
      // Continue checking
    }
  }

  // Check page text for CAPTCHA indicators
  try {
    const pageText = await page.textContent('body') || '';
    const captchaKeywords = ['captcha', 'verify you', 'not a robot', 'human verification'];
    if (captchaKeywords.some(keyword => pageText.toLowerCase().includes(keyword))) {
      return true;
    }
  } catch (e) {
    // Ignore text check errors
  }

  return false;
}

/**
 * Detect if login is required
 */
export async function detectLoginRequired(page: Page): Promise<boolean> {
  const loginIndicators = [
    'input[type="password"]',
    'button:has-text("Sign in")',
    'button:has-text("Log in")',
    'a:has-text("Sign in")',
    'a:has-text("Log in")',
    'form[action*="login"]',
    'form[action*="signin"]',
  ];

  for (const selector of loginIndicators) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 1000 })) {
        return true;
      }
    } catch (e) {
      // Continue checking
    }
  }

  // Check page text
  try {
    const pageText = await page.textContent('body') || '';
    const loginKeywords = ['sign in', 'log in', 'login required', 'please login'];
    if (loginKeywords.some(keyword => pageText.toLowerCase().includes(keyword))) {
      return true;
    }
  } catch (e) {
    // Ignore text check errors
  }

  return false;
}

/**
 * Pause automation and create intervention event
 * 
 * Idempotent: Only creates intervention if not already active for same reason
 */
export async function pauseForIntervention(params: {
  applicationRunId: string;
  reason: InterventionReason;
  message: string;
  page: Page;
  jobTitle: string;
  jobCompany: string;
  site: SupportedApplySite;
  instructions?: string[];
}): Promise<PauseResult> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check if intervention already exists (idempotency)
  const { data: existingRun } = await supabase
    .from('job_application_runs')
    .select('status, intervention_reason, paused_at')
    .eq('id', params.applicationRunId)
    .maybeSingle();

  // If already waiting for same reason and less than 3 minutes elapsed, don't re-emit
  if (existingRun?.status === 'WAITING_FOR_CANDIDATE' && 
      existingRun.intervention_reason === params.reason &&
      existingRun.paused_at) {
    const pausedAt = new Date(existingRun.paused_at);
    const elapsed = Date.now() - pausedAt.getTime();
    
    if (elapsed < INTERVENTION_REMINDER_INTERVAL) {
      // Same intervention, less than 3 min - don't spam
      return {
        paused: true,
        reason: params.reason,
        message: params.message,
      };
    }
  }

  // Generate resume token
  const resumeToken = `${params.applicationRunId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Update application run status
  const { error: updateError } = await supabase
    .from('job_application_runs')
    .update({
      status: 'WAITING_FOR_CANDIDATE',
      intervention_reason: params.reason,
      intervention_message: params.message,
      paused_at: new Date().toISOString(),
      resume_token: resumeToken,
    })
    .eq('id', params.applicationRunId);

  if (updateError) {
    console.error('[Collaborative Flow] Failed to pause application:', updateError);
    return { paused: false };
  }

  // Create intervention event
  const event: HumanInterventionEvent = {
    type: 'HUMAN_INTERVENTION_REQUIRED',
    reason: params.reason,
    message: params.message,
    applicationRunId: params.applicationRunId,
    jobTitle: params.jobTitle,
    jobCompany: params.jobCompany,
    site: params.site,
    browserWindowOpen: true,
    instructions: params.instructions || getDefaultInstructions(params.reason),
  };

  return {
    paused: true,
    reason: params.reason,
    message: params.message,
    event,
  };
}

/**
 * Get default instructions based on intervention reason
 */
function getDefaultInstructions(reason: InterventionReason): string[] {
  switch (reason) {
    case 'CAPTCHA_REQUIRED':
      return [
        'Please complete the CAPTCHA shown in the open browser window.',
        'Once done, return here to continue.',
      ];
    case 'LOGIN_REQUIRED':
      return [
        'Please log in using your account credentials in the browser window.',
        'Once done, return here to continue.',
      ];
    case 'SIGNUP_REQUIRED':
      return [
        'Please follow the signup prompts in the browser window.',
        'Once done, return here to continue.',
      ];
    case 'EMAIL_VERIFICATION_REQUIRED':
      return [
        'Please check your email and click the verification link.',
        'Once your account is verified, return here to continue.',
      ];
    case 'PROFILE_COMPLETION_REQUIRED':
      return [
        'Please complete your profile in the browser window.',
        'Once done, return here to continue.',
      ];
    default:
      return ['Please complete the step shown in the open browser window. Once done, return here to continue.'];
  }
}

/**
 * Check if intervention is resolved (CAPTCHA gone, logged in, etc.)
 */
export async function checkInterventionResolved(
  page: Page,
  reason: InterventionReason
): Promise<boolean> {
  switch (reason) {
    case 'CAPTCHA_REQUIRED':
      return !(await detectCaptcha(page));
    case 'LOGIN_REQUIRED':
      return !(await detectLoginRequired(page));
    case 'SIGNUP_REQUIRED':
      // Check if we're past signup (on application page or logged in)
      const currentUrl = page.url();
      return !currentUrl.includes('signup') && !currentUrl.includes('register');
    case 'EMAIL_VERIFICATION_REQUIRED':
      // Check if verification is complete (usually redirects to dashboard or application)
      const url = page.url();
      return !url.includes('verify') && !url.includes('activation');
    default:
      return true;
  }
}

