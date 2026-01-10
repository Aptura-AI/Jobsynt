/**
 * GPT Answer Engine
 * 
 * Generates form answers from candidate profile + job description.
 * 
 * Guardrails:
 * - Validate JSON schema
 * - Retry once on failure
 * - Fallback to empty string if needed
 * - GPT never sees DOM/HTML
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface FormQuestion {
  id: string;
  type: 'text' | 'textarea' | 'dropdown' | 'radio' | 'checkbox' | 'file';
  label: string;
  required: boolean;
  options?: string[];
}

export interface FormAnswer {
  id: string;
  value: string;
}

/**
 * Generate answers for form questions using GPT
 */
export async function getGPTAnswers(params: {
  candidateProfile: any;
  jobDescription: string;
  questions: FormQuestion[];
}): Promise<FormAnswer[]> {
  if (params.questions.length === 0) {
    return [];
  }

  try {
    const systemPrompt = `You are an AI assistant helping a job candidate fill out job application forms.
Your task is to generate appropriate answers based on the candidate's profile and the job description.

Rules:
1. Answer questions accurately based on the candidate's resume/profile
2. For dropdown/radio questions, select the best matching option
3. For text/textarea questions, provide concise, professional answers
4. Never make up information not in the candidate profile
5. If information is missing, use reasonable defaults or leave blank for optional fields

Return ONLY a JSON array of answers in this format:
[
  { "id": "question_id", "value": "answer text" }
]`;

    // GPT Safety: Only send structured data, never HTML/DOM/credentials
    // Extract only safe fields from candidate profile
    const safeProfile = {
      name: params.candidateProfile.name || '',
      email: params.candidateProfile.email || '',
      phone: params.candidateProfile.phone || '',
      location: params.candidateProfile.location || '',
      skills: params.candidateProfile.skills || [],
      experience: (params.candidateProfile.experience || []).map((exp: any) => ({
        title: exp.title || '',
        company: exp.company || '',
        duration: exp.duration || '',
        description: exp.description || '',
      })),
      education: params.candidateProfile.education || [],
      work_authorization: params.candidateProfile.work_authorization || '',
      salary_expectation: params.candidateProfile.salary_expectation || '',
    };

    // Questions are already structured (no DOM/HTML)
    const safeQuestions = params.questions.map(q => ({
      id: q.id,
      type: q.type,
      label: q.label,
      required: q.required,
      options: q.options,
    }));

    const userPrompt = `Candidate Profile:
${JSON.stringify(safeProfile, null, 2)}

Job Description:
${params.jobDescription}

Questions to Answer:
${safeQuestions.map(q => `- ${q.id} (${q.type}): ${q.label}${q.required ? ' [REQUIRED]' : ''}${q.options ? ` Options: ${q.options.join(', ')}` : ''}`).join('\n')}

Generate answers for all questions. Return JSON array only.
IMPORTANT: Never include passwords, credentials, or sensitive information.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT');
    }

    // Parse JSON (may be wrapped in markdown)
    let answers: FormAnswer[] = [];
    try {
      // Try direct JSON parse
      answers = JSON.parse(content);
    } catch (e) {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (jsonMatch) {
        answers = JSON.parse(jsonMatch[1]);
      } else {
        // Try finding JSON array in content
        const arrayMatch = content.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          answers = JSON.parse(arrayMatch[0]);
        } else {
          throw new Error('Could not parse GPT response as JSON');
        }
      }
    }

    // Validate schema
    if (!Array.isArray(answers)) {
      throw new Error('GPT response is not an array');
    }

    // Ensure all answers have required fields
    const validatedAnswers: FormAnswer[] = answers
      .filter((a: any) => a.id && a.value !== undefined)
      .map((a: any) => ({
        id: String(a.id),
        value: String(a.value || ''),
      }));

    return validatedAnswers;
  } catch (error: any) {
    console.error('[GPT Answer Engine] Error:', error);
    
    // Retry once
    try {
      return await getGPTAnswers(params);
    } catch (retryError: any) {
      console.error('[GPT Answer Engine] Retry failed:', retryError);
      
      // Return empty answers as fallback
      return params.questions
        .filter(q => !q.required)
        .map(q => ({ id: q.id, value: '' }));
    }
  }
}

