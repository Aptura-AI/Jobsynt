/**
 * Playwright Automation Layer
 * 
 * Handles browser control and form detection.
 * 
 * Guardrails:
 * - CAPTCHA detection → abort
 * - One browser context per candidate
 * - One tab per job
 * - Always close tab
 * - Screenshot on failure
 */

// Lazy Playwright imports (runtime only, not at build time)
// Use type imports for types, dynamic import for runtime chromium
import type { Browser, BrowserContext, Page } from 'playwright';

let chromium: any;

async function getPlaywright() {
  if (!chromium) {
    const pw = await import('playwright');
    chromium = pw.chromium;
  }
  return { chromium };
}

import { extractFormQuestions } from './formIntelligence';
import { getGPTAnswers } from './gptAnswerEngine';
import { fillAndSubmitForm } from './formFillSubmit';
import { detectCaptcha, detectLoginRequired, pauseForIntervention, checkInterventionResolved } from './collaborativeFlow';
import { SupportedApplySite } from './types';
import { DEFAULT_APPLY_MODE } from './config';

export interface ApplyToJobParams {
  jobUrl: string;
  jobTitle: string;
  jobCompany: string;
  jobDescription: string;
  candidateProfile: any;
  candidateName: string;
  candidateEmail: string;
  applicationRunId?: string;
  site?: SupportedApplySite;
  isResuming?: boolean;
}

export interface ApplyToJobResult {
  success: boolean;
  error?: string;
  screenshot?: string;
  paused?: boolean;
  interventionReason?: string;
}

// Global browser instance (one per process)
let browser: any = null;
let browserContext: any = null;

/**
 * Get or create browser context
 */
async function getBrowserContext(): Promise<any> {
  const { chromium: chromiumModule } = await getPlaywright();
  
  if (!browser) {
    const headless = process.env.NODE_ENV === 'production';
    browser = await chromiumModule.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  if (!browserContext) {
    browserContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
  }

  return browserContext;
}

/**
 * Apply to a single job
 */
export async function applyToJob(params: ApplyToJobParams): Promise<ApplyToJobResult> {
  let page: Page | null = null;

  try {
    const context = await getBrowserContext();
    page = await context.newPage();

    if (!page) {
      return { success: false, error: 'Failed to create browser page' };
    }

    // Navigate to job URL
    await page.goto(params.jobUrl, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Collaborative mode: Pause for human intervention instead of failing
    if (DEFAULT_APPLY_MODE === 'COLLABORATIVE' && params.applicationRunId) {
      // Check for CAPTCHA
      if (await detectCaptcha(page)) {
        const pauseResult = await pauseForIntervention({
          applicationRunId: params.applicationRunId!,
          reason: 'CAPTCHA_REQUIRED',
          message: 'Action needed to continue. Please complete the step shown in the open browser window. Once done, return here to continue.',
          page,
          jobTitle: params.jobTitle,
          jobCompany: params.jobCompany,
          site: params.site || 'UNKNOWN' as SupportedApplySite,
        });
        return {
          success: false,
          paused: true,
          interventionReason: 'CAPTCHA_REQUIRED',
        };
      }

      // Check for login requirement
      if (await detectLoginRequired(page)) {
        const pauseResult = await pauseForIntervention({
          applicationRunId: params.applicationRunId!,
          reason: 'LOGIN_REQUIRED',
          message: 'Action needed to continue. Please complete the step shown in the open browser window. Once done, return here to continue.',
          page,
          jobTitle: params.jobTitle,
          jobCompany: params.jobCompany,
          site: params.site || 'UNKNOWN' as SupportedApplySite,
        });
        return {
          success: false,
          paused: true,
          interventionReason: 'LOGIN_REQUIRED',
        };
      }
    } else {
      // Legacy mode: Fail on CAPTCHA/login (for backwards compatibility)
      if (await detectCaptcha(page)) {
        return {
          success: false,
          error: 'CAPTCHA detected - cannot proceed automatically',
        };
      }

      if (await detectLoginRequired(page)) {
        return {
          success: false,
          error: 'Login required - cannot proceed automatically',
        };
      }
    }

    // Detect apply button
    const applyButton = await page.locator('button:has-text("Apply"), a:has-text("Apply"), button:has-text("Apply Now"), a:has-text("Apply Now")').first();
    
    if (!(await applyButton.isVisible())) {
      return {
        success: false,
        error: 'Apply button not found',
      };
    }

    // Click apply button
    await applyButton.click();
    await page.waitForTimeout(2000); // Wait for form to load

    // Extract form questions (Phase 7)
    const formQuestions = await extractFormQuestions(page);

    if (formQuestions.length === 0) {
      return {
        success: false,
        error: 'No application form detected',
      };
    }

    // Get GPT answers (Phase 8)
    const answers = await getGPTAnswers({
      candidateProfile: params.candidateProfile,
      jobDescription: params.jobDescription,
      questions: formQuestions,
    });

    // Get resume file path from Supabase Storage (if available)
    let resumePath: string | undefined;
    try {
      // TODO: Download resume from Supabase Storage to temp file
      // For now, resume upload will be handled by GPT answers if file field is detected
    } catch (e) {
      console.warn('[Playwright] Could not get resume file path:', e);
    }

    // Fill form and submit (Phase 9)
    const submitResult = await fillAndSubmitForm({
      page,
      questions: formQuestions,
      answers,
      resumePath,
      candidateName: params.candidateName,
      candidateEmail: params.candidateEmail,
    });

    if (submitResult.success) {
      return { success: true };
    } else {
      // Take screenshot on failure
      const screenshot = await page.screenshot({ type: 'png', fullPage: true });
      return {
        success: false,
        error: submitResult.error,
        screenshot: screenshot.toString('base64'),
      };
    }
  } catch (error: any) {
    let screenshot: string | undefined;
    if (page) {
      try {
        const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: true });
        screenshot = screenshotBuffer.toString('base64');
      } catch (e) {
        // Ignore screenshot errors
      }
    }

    return {
      success: false,
      error: error.message || 'Unexpected error during application',
      screenshot,
    };
  } finally {
    // Always close the page
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }
}

// Form intelligence and GPT functions are imported from separate modules

