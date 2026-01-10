/**
 * TechFetch Site Adapter
 * 
 * Isolated adapter for TechFetch job applications.
 * No shared logic with other sites.
 */

// Lazy Playwright imports (runtime only, not at build time)
// Use type imports for types to avoid build-time evaluation
import type { Page } from 'playwright';
import { SupportedApplySite } from '../types';
import { detectLoginRequired, detectCaptcha, pauseForIntervention } from '../collaborativeFlow';
import { getCredentials, hasCredentials } from '../credentials';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const TECHFETCH_SITE: SupportedApplySite = 'TECHFETCH';

/**
 * Detect if login is required on TechFetch
 */
export async function detectTechFetchLoginRequired(page: any): Promise<boolean> {
  // TechFetch-specific login detection
  const techfetchLoginSelectors = [
    'a[href*="/login"]',
    'a[href*="/signin"]',
    'button:has-text("Sign In")',
    'input[name="email"]',
    'input[name="username"]',
  ];

  for (const selector of techfetchLoginSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 1000 })) {
        return true;
      }
    } catch (e) {
      // Continue
    }
  }

  return await detectLoginRequired(page);
}

/**
 * Navigate to TechFetch signup
 */
export async function navigateToTechFetchSignup(page: Page): Promise<boolean> {
  try {
    // Look for signup link
    const signupLink = page.locator('a[href*="/signup"], a[href*="/register"], a:has-text("Sign Up")').first();
    
    if (await signupLink.isVisible({ timeout: 5000 })) {
      await signupLink.click();
      await page.waitForTimeout(2000);
      return true;
    }

    // Try navigating directly
    const currentUrl = page.url();
    const baseUrl = new URL(currentUrl).origin;
    await page.goto(`${baseUrl}/signup`, { waitUntil: 'networkidle', timeout: 10000 });
    return true;
  } catch (error: any) {
    console.error('[TechFetch] Signup navigation failed:', error);
    return false;
  }
}

/**
 * Apply to job on TechFetch
 */
export async function applyToTechFetchJob(params: {
  page: Page;
  jobUrl: string;
  candidateEmail: string;
  candidateName: string;
  applicationRunId: string;
  jobTitle: string;
  jobCompany: string;
}): Promise<{ success: boolean; error?: string; paused?: boolean }> {
  const { page, jobUrl, candidateEmail, candidateName, applicationRunId, jobTitle, jobCompany } = params;

  try {
    // Navigate to job
    await page.goto(jobUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Check for CAPTCHA
    if (await detectCaptcha(page)) {
      const pauseResult = await pauseForIntervention({
        applicationRunId,
        reason: 'CAPTCHA_REQUIRED',
        message: 'Action needed to continue. Please complete the step shown in the open browser window. Once done, return here to continue.',
        page,
        jobTitle,
        jobCompany,
        site: TECHFETCH_SITE,
      });
      return { success: false, paused: true };
    }

    // Check for login requirement
    if (await detectTechFetchLoginRequired(page)) {
      // REQUIREMENT 1: Try auto-login if credentials exist
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Get candidate ID from application run
      const { data: runData } = await supabase
        .from('job_application_runs')
        .select('candidate_id')
        .eq('id', applicationRunId)
        .maybeSingle();

      if (runData) {
        const credentials = await getCredentials({
          candidateId: runData.candidate_id,
          site: TECHFETCH_SITE,
        });

        if (credentials) {
          // Attempt auto-login
          const loginSuccess = await attemptTechFetchLogin(page, credentials.email, credentials.password);
          
          if (loginSuccess) {
            // Login successful, continue
            console.log('[TechFetch] Auto-login successful');
          } else {
            // Auto-login failed, require human intervention
            const pauseResult = await pauseForIntervention({
              applicationRunId,
              reason: 'LOGIN_REQUIRED',
              message: 'Action needed to continue. Please complete the step shown in the open browser window. Once done, return here to continue.',
              page,
              jobTitle,
              jobCompany,
              site: TECHFETCH_SITE,
            });
            return { success: false, paused: true };
          }
        } else {
          // No credentials, require human intervention
          const pauseResult = await pauseForIntervention({
            applicationRunId,
            reason: 'LOGIN_REQUIRED',
            message: 'Action needed to continue. Please complete the step shown in the open browser window. Once done, return here to continue.',
            page,
            jobTitle,
            jobCompany,
            site: TECHFETCH_SITE,
          });
          return { success: false, paused: true };
        }
      } else {
        // Can't get candidate ID, require human intervention
        const pauseResult = await pauseForIntervention({
          applicationRunId,
          reason: 'LOGIN_REQUIRED',
          message: 'Action needed to continue. Please complete the step shown in the open browser window. Once done, return here to continue.',
          page,
          jobTitle,
          jobCompany,
          site: TECHFETCH_SITE,
        });
        return { success: false, paused: true };
      }
    }

    // Find apply button
    const applyButton = page.locator(
      'button:has-text("Apply"), a:has-text("Apply"), button:has-text("Apply Now"), a:has-text("Apply Now")'
    ).first();

    if (!(await applyButton.isVisible({ timeout: 5000 }))) {
      return { success: false, error: 'Apply button not found on TechFetch' };
    }

    await applyButton.click();
    await page.waitForTimeout(2000);

    // TODO: Continue with form filling (will be handled by orchestrator)
    // This adapter only handles site-specific navigation and detection

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'TechFetch application failed' };
  }
}

/**
 * Attempt auto-login to TechFetch
 */
async function attemptTechFetchLogin(page: Page, email: string, password: string): Promise<boolean> {
  try {
    // Find login form
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const loginButton = page.locator('button:has-text("Sign In"), button:has-text("Log In"), button[type="submit"]').first();

    if (!(await emailInput.isVisible({ timeout: 5000 }))) {
      return false;
    }

    // Fill credentials
    await emailInput.fill(email);
    await passwordInput.fill(password);
    await loginButton.click();

    // Wait for navigation or success indicator
    await page.waitForTimeout(3000);

    // Check if login was successful (not on login page anymore)
    const currentUrl = page.url();
    const isLoggedIn = !currentUrl.includes('login') && !currentUrl.includes('signin');

    return isLoggedIn;
  } catch (error: any) {
    console.error('[TechFetch] Auto-login failed:', error);
    return false;
  }
}

