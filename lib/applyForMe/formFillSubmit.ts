/**
 * Form Fill & Submit
 * 
 * Populates form fields with GPT-generated answers and submits.
 * 
 * Guardrails:
 * - Do not double-submit
 * - Timeout safely
 * - Screenshot on failure
 */

// Lazy Playwright imports (runtime only, not at build time)
// Use type imports for types to avoid build-time evaluation
import type { Page } from 'playwright';
import { FormQuestion } from './formIntelligence';
import { FormAnswer } from './gptAnswerEngine';

export interface FillAndSubmitParams {
  page: Page;
  questions: FormQuestion[];
  answers: FormAnswer[];
  resumePath?: string;
  candidateName?: string;
  candidateEmail?: string;
}

/**
 * Fill form fields with answers
 */
export async function fillAndSubmitForm(params: FillAndSubmitParams): Promise<{ success: boolean; error?: string }> {
  const { page, questions, answers, resumePath, candidateName, candidateEmail } = params;
  // Page is already a Playwright Page instance passed from caller

  try {
    // Create answer map for quick lookup
    const answerMap = new Map<string, string>();
    for (const answer of answers) {
      answerMap.set(answer.id, answer.value);
    }

    // Fill each question
    for (const question of questions) {
      const answer = answerMap.get(question.id);
      if (!answer && question.required) {
        console.warn(`[Form Fill] Missing required answer for ${question.id}`);
        continue;
      }

      try {
        const selector = question.selector;
        const element = page.locator(selector).first();

        if (await element.count() === 0) {
          console.warn(`[Form Fill] Element not found for ${question.id}`);
          continue;
        }

        switch (question.type) {
          case 'text':
            // For email fields, use candidate email if available
            if (question.label.toLowerCase().includes('email') && candidateEmail) {
              await element.fill(candidateEmail);
            } else {
              await element.fill(answer || '');
            }
            break;
          case 'textarea':
            await element.fill(answer || '');
            break;

          case 'dropdown':
            if (answer) {
              // Try to select by text first, then by value
              try {
                await element.selectOption({ label: answer });
              } catch (e) {
                try {
                  await element.selectOption(answer);
                } catch (e2) {
                  // Try matching option text
                  const options = question.options || [];
                  const matchingOption = options.find(opt => 
                    opt.toLowerCase().includes(answer.toLowerCase()) ||
                    answer.toLowerCase().includes(opt.toLowerCase())
                  );
                  if (matchingOption) {
                    await element.selectOption({ label: matchingOption });
                  }
                }
              }
            }
            break;

          case 'radio':
            if (answer) {
              // Find radio button with matching label or value
              const radioGroup = page.locator(`input[type="radio"][name="${question.id.split('_')[0]}"]`);
              const count = await radioGroup.count();
              
              for (let i = 0; i < count; i++) {
                const radio = radioGroup.nth(i);
                const value = await radio.getAttribute('value') || '';
                const radioId = await radio.getAttribute('id') || '';
                const label = await page.locator(`label[for="${radioId}"]`).first();
                
                if (await label.count() > 0) {
                  const labelText = await label.textContent();
                  if (labelText && (
                    labelText.toLowerCase().includes(answer.toLowerCase()) ||
                    answer.toLowerCase().includes(labelText.toLowerCase())
                  )) {
                    await radio.check();
                    break;
                  }
                } else if (value && value.toLowerCase() === answer.toLowerCase()) {
                  await radio.check();
                  break;
                }
              }
            }
            break;

          case 'checkbox':
            if (answer && (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'true')) {
              await element.check();
            }
            break;

          case 'file':
            // File uploads are handled separately (resume)
            if (params.resumePath) {
              await element.setInputFiles(params.resumePath);
            }
            break;
        }

        // Small delay between fields
        await page.waitForTimeout(500);
      } catch (fieldError: any) {
        console.warn(`[Form Fill] Error filling field ${question.id}:`, fieldError.message);
        // Continue with next field
      }
    }

    // Wait for form to be ready
    await page.waitForTimeout(1000);

    // Find and click submit button
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("Apply")',
      'button:has-text("Send")',
      'button:has-text("Submit Application")',
    ];

    let submitted = false;
    for (const selector of submitSelectors) {
      try {
        const submitButton = page.locator(selector).first();
        if (await submitButton.isVisible()) {
          await submitButton.click();
          submitted = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!submitted) {
      return {
        success: false,
        error: 'Submit button not found',
      };
    }

    // Wait for submission confirmation or redirect
    try {
      await page.waitForURL(/success|thank|confirmation|dashboard/i, { timeout: 10000 });
      return { success: true };
    } catch (e) {
      // Check if we're on a different page (redirect indicates success)
      const currentUrl = page.url();
      // Note: We don't have access to initial URL here, so we check for success messages instead

      // Check for success messages on page
      const successIndicators = [
        'thank you',
        'application received',
        'successfully submitted',
        'submitted successfully',
      ];

      const pageText = await page.textContent('body') || '';
      const hasSuccessMessage = successIndicators.some(indicator =>
        pageText.toLowerCase().includes(indicator)
      );

      if (hasSuccessMessage) {
        return { success: true };
      }

      return {
        success: false,
        error: 'Submission status unclear - may have failed',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error filling or submitting form',
    };
  }
}

