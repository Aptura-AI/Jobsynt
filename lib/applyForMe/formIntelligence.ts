/**
 * Form Intelligence Layer
 * 
 * Extracts logical questions from DOM without sending DOM to GPT.
 * 
 * Guardrails:
 * - Do not send DOM to GPT
 * - Ignore unknown field types
 * - Skip unsupported fields
 */

// Lazy Playwright imports (runtime only, not at build time)
// Use type imports for types to avoid build-time evaluation
import type { Page } from 'playwright';

export interface FormQuestion {
  id: string;
  type: 'text' | 'textarea' | 'dropdown' | 'radio' | 'checkbox' | 'file';
  label: string;
  required: boolean;
  options?: string[];
  selector: string;
}

/**
 * Extract form questions from page
 */
export async function extractFormQuestions(page: Page): Promise<FormQuestion[]> {
  const questions: FormQuestion[] = [];

  try {
    // Find all form inputs
    const inputs = await page.locator('input, textarea, select').all();

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      
      // Get input type
      const tagName = await input.evaluate((el: HTMLElement) => el.tagName.toLowerCase());
      const inputType = await input.getAttribute('type') || 'text';
      const name = await input.getAttribute('name') || '';
      const id = await input.getAttribute('id') || '';
      
      // Skip hidden inputs
      if (inputType === 'hidden' || tagName === 'input' && inputType === 'submit') {
        continue;
      }

      // Determine question type
      let questionType: FormQuestion['type'] = 'text';
      if (tagName === 'textarea') {
        questionType = 'textarea';
      } else if (tagName === 'select') {
        questionType = 'dropdown';
      } else if (inputType === 'radio') {
        questionType = 'radio';
      } else if (inputType === 'checkbox') {
        questionType = 'checkbox';
      } else if (inputType === 'file') {
        questionType = 'file';
      } else if (inputType === 'text' || inputType === 'email' || inputType === 'tel') {
        questionType = 'text';
      } else {
        // Skip unsupported types
        continue;
      }

      // Get label text
      let label = '';
      const labelElement = await page.locator(`label[for="${id}"], label[for="${name}"]`).first();
      if (await labelElement.count() > 0) {
        label = await labelElement.textContent() || '';
      } else {
        // Try to find associated label by proximity
        const parent = await input.locator('..').first();
        const parentLabel = await parent.locator('label').first();
        if (await parentLabel.count() > 0) {
          label = await parentLabel.textContent() || '';
        } else {
          // Use placeholder or name as fallback
          const placeholder = await input.getAttribute('placeholder') || '';
          label = placeholder || name || id;
        }
      }

      // Clean label text
      label = label.trim().replace(/\s+/g, ' ');

      // Check if required
      const required = await input.getAttribute('required') !== null;
      const ariaRequired = await input.getAttribute('aria-required') === 'true';
      const isRequired = required || ariaRequired || label.toLowerCase().includes('required');

      // Get options for dropdown/radio
      let options: string[] | undefined;
      if (questionType === 'dropdown') {
        const optionElements = await input.locator('option').all();
        options = [];
        for (const opt of optionElements) {
          const text = await opt.textContent();
          if (text && text.trim()) {
            options.push(text.trim());
          }
        }
      } else if (questionType === 'radio') {
        // Get all radio buttons with same name
        const radioGroup = await page.locator(`input[type="radio"][name="${name}"]`).all();
        options = [];
        for (const radio of radioGroup) {
          const value = await radio.getAttribute('value') || '';
          const radioLabel = await page.locator(`label[for="${await radio.getAttribute('id')}"]`).first();
          if (await radioLabel.count() > 0) {
            const labelText = await radioLabel.textContent();
            if (labelText) {
              options.push(labelText.trim());
            }
          } else if (value) {
            options.push(value);
          }
        }
      }

      // Generate unique ID
      const questionId = `${name || id || `q${i}`}_${questionType}`;

      questions.push({
        id: questionId,
        type: questionType,
        label,
        required: isRequired,
        options,
        selector: name || id || `input:nth-of-type(${i + 1})`,
      });
    }

    // Remove duplicates (same name/id)
    const uniqueQuestions = questions.filter((q, index, self) =>
      index === self.findIndex(t => t.id === q.id)
    );

    return uniqueQuestions;
  } catch (error: any) {
    console.error('[Form Intelligence] Error extracting questions:', error);
    return [];
  }
}

