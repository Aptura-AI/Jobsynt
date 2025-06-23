const { createClient } = require('@supabase/supabase-js');

// Clean environment variables (remove quotes and semicolons)
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/[';]/g, '');
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[';]/g, '');
const openaiApiKey = (process.env.OPENAI_API_KEY || '').replace(/[';]/g, '');
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { action, userId, jobDescription, jobUrl } = JSON.parse(event.body);

        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'User ID is required' })
            };
        }

        console.log('AI Resume Assistant request:', { action, userId });

        if (!supabase) {
            console.error('Supabase not initialized - missing environment variables');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Database connection not available',
                    debug: {
                        hasUrl: !!supabaseUrl,
                        hasKey: !!supabaseKey,
                        urlLength: supabaseUrl?.length || 0,
                        keyLength: supabaseKey?.length || 0
                    }
                })
            };
        }

        if (!openaiApiKey) {
            console.error('OpenAI API key not configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'AI service not available - OpenAI API key not configured'
                })
            };
        }

        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (profileError) {
            console.error('Profile error:', profileError);
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Profile not found' })
            };
        }

        // Get resume
        const { data: resume, error: resumeError } = await supabase
            .from('resumes')
            .select('*')
            .eq('user_id', userId)
            .eq('is_primary', true)
            .single();

        if (resumeError || !resume) {
            console.error('Resume error:', resumeError);
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ 
                    error: 'No resume found. Please upload your resume first.',
                    hasResume: false
                })
            };
        }

        // Get favorite companies
        const { data: favoriteCompanies } = await supabase
            .from('favorite_companies')
            .select('*')
            .eq('user_id', userId);

        let response;
        switch (action) {
            case 'analyze':
                response = await analyzeResumeWithGPT(profile, resume, favoriteCompanies || []);
                break;
            case 'optimize':
                if (!jobDescription && !jobUrl) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Job description or job URL is required for optimization' })
                    };
                }
                
                let finalJobDescription = jobDescription;
                
                if (jobUrl && !jobDescription) {
                    finalJobDescription = `Job URL: ${jobUrl}\n\nJob posting from: ${jobUrl}\n\nPlease copy and paste the full job description for better optimization results.`;
                } else if (jobUrl && jobDescription) {
                    finalJobDescription = `Job URL: ${jobUrl}\n\n${jobDescription}`;
                }
                
                response = await optimizeResumeWithGPT(profile, resume, finalJobDescription, favoriteCompanies || []);
                break;
            case 'ats-check':
                response = await checkATSCompatibilityWithGPT(profile, resume);
                break;
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid action' })
                };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        };

    } catch (error) {
        console.error('AI Resume Assistant error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message 
            })
        };
    }
};

// GPT API Integration
async function callGPTAPI(messages, maxTokens = 2000) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: messages,
                max_tokens: maxTokens,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('GPT API call failed:', error);
        throw new Error('AI analysis service temporarily unavailable');
    }
}

// Save cover letter to Supabase storage
async function saveCoverLetterToStorage(userId, coverLetterContent, jobTitle, companyName) {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `cover_letter_${jobTitle}_${companyName}_${timestamp}.txt`.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${userId}/${fileName}`;
        
        const { data, error } = await supabase.storage
            .from('cover-letters')
            .upload(filePath, coverLetterContent, {
                contentType: 'text/plain',
                upsert: false
            });

        if (error) {
            console.error('Cover letter storage error:', error);
            return null;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('cover-letters')
            .getPublicUrl(filePath);

        return {
            filePath,
            publicUrl: urlData.publicUrl,
            fileName
        };
    } catch (error) {
        console.error('Error saving cover letter:', error);
        return null;
    }
}

// AI-powered resume analysis
async function analyzeResumeWithGPT(profile, resume, favoriteCompanies) {
    const prompt = `You are an expert resume analyst and career advisor. Analyze the following profile and resume information to provide comprehensive insights.

PROFILE INFORMATION:
- Name: ${profile.full_name || 'Not provided'}
- Current Title: ${profile.current_title || 'Not provided'}
- Target Role: ${profile.target_role || 'Not provided'}
- Experience: ${profile.years_of_experience || 'Not provided'} years
- Skills: ${profile.skills || 'Not provided'}
- Location: ${profile.location || 'Not provided'}
- Email: ${profile.email || 'Not provided'}

RESUME INFORMATION:
- File Name: ${resume.file_name}
- File Type: ${resume.file_type}
- Upload Date: ${resume.uploaded_at}

FAVORITE COMPANIES: ${favoriteCompanies.map(c => \`\${c.name} (\${c.location})\`).join(', ') || 'None specified'}

Please provide a detailed analysis in the following JSON format:
{
    "resumeInfo": {
        "fileName": "string",
        "fileType": "string",
        "uploadDate": "string",
        "analysisScore": "number (1-100)"
    },
    "profileMatch": {
        "currentTitle": "string",
        "targetRole": "string",
        "experience": "string",
        "skills": "string",
        "location": "string",
        "alignment": "string (High/Medium/Low)"
    },
    "recommendations": [
        "Specific actionable recommendations for improving the resume and profile"
    ],
    "targetCompanies": [
        {
            "name": "string",
            "location": "string", 
            "reason": "Why this company is a good fit"
        }
    ],
    "nextSteps": [
        "Prioritized action items for the job search"
    ],
    "strengths": [
        "Key strengths identified in the profile"
    ],
    "improvements": [
        "Areas that need improvement"
    ]
}

Provide actionable, specific advice based on current job market trends and best practices.`;

    try {
        const gptResponse = await callGPTAPI([
            { role: 'system', content: 'You are an expert resume analyst. Always respond with valid JSON.' },
            { role: 'user', content: prompt }
        ]);

        const analysis = JSON.parse(gptResponse);
        
        return {
            success: true,
            hasResume: true,
            analysis: analysis
        };
    } catch (error) {
        console.error('GPT analysis error:', error);
        // Fallback to basic analysis if GPT fails
        return {
            success: true,
            hasResume: true,
            analysis: {
                resumeInfo: {
                    fileName: resume.file_name,
                    fileType: resume.file_type,
                    uploadDate: resume.uploaded_at,
                    analysisScore: 75
                },
                profileMatch: {
                    currentTitle: profile.current_title || 'Not specified',
                    targetRole: profile.target_role || 'Not specified',
                    experience: profile.years_of_experience || 'Not specified',
                    skills: profile.skills || 'Not specified',
                    location: profile.location || 'Not specified',
                    alignment: 'Medium'
                },
                recommendations: [
                    'Complete your profile with missing information',
                    'Add specific achievements and metrics to your experience',
                    'Optimize your resume keywords for ATS systems',
                    'Consider adding a professional summary section'
                ],
                targetCompanies: favoriteCompanies.map(company => ({
                    name: company.name,
                    location: company.location,
                    reason: company.reason || 'Based on your favorite companies list'
                })),
                nextSteps: [
                    'Use the Optimize for Job feature to tailor your resume',
                    'Apply to positions that match your target role',
                    'Network with professionals in your industry',
                    'Continue developing relevant skills'
                ],
                strengths: ['Professional experience', 'Relevant skills'],
                improvements: ['Add quantifiable achievements', 'Enhance keyword optimization']
            }
        };
    }
}

// AI-powered resume optimization for specific jobs
async function optimizeResumeWithGPT(profile, resume, jobDescription, favoriteCompanies) {
    const prompt = `You are an expert resume optimization specialist. Your task is to analyze a candidate's profile against a specific job description and provide tailored optimization recommendations.

CANDIDATE PROFILE:
- Name: ${profile.full_name || 'Not provided'}
- Current Title: ${profile.current_title || 'Not provided'}
- Target Role: ${profile.target_role || 'Not provided'}
- Experience: ${profile.years_of_experience || 'Not provided'} years
- Skills: ${profile.skills || 'Not provided'}
- Location: ${profile.location || 'Not provided'}
- Email: ${profile.email || 'Not provided'}
- Phone: ${profile.phone || 'Not provided'}

JOB DESCRIPTION:
${jobDescription}

FAVORITE COMPANIES: ${favoriteCompanies.map(c => \`\${c.name} (\${c.location}): \${c.reason || 'No reason provided'}\`).join('; ') || 'None specified'}

Please provide a comprehensive optimization analysis in the following JSON format:
{
    "rewrittenSummary": {
        "title": "AI-Optimized Professional Summary",
        "content": "A compelling 3-4 sentence professional summary tailored to this specific job",
        "instructions": "How to use this summary effectively"
    },
    "skillHighlighting": {
        "title": "Skills Analysis",
        "instructions": "Strategic advice on highlighting skills",
        "matchingSkills": [
            {
                "skill": "skill name",
                "suggestion": "specific advice on how to highlight this skill",
                "priority": "High/Medium/Low"
            }
        ],
        "keywordSkills": [
            {
                "skill": "keyword from job description",
                "suggestion": "how to incorporate or develop this skill",
                "priority": "High/Medium/Low"
            }
        ]
    },
    "coverLetter": {
        "title": "AI-Generated Cover Letter",
        "content": "A complete, personalized cover letter for this position",
        "instructions": "Customization tips for the cover letter",
        "companyName": "extracted or inferred company name",
        "jobTitle": "extracted job title"
    },
    "suggestions": [
        "Specific actionable suggestions for improving the application"
    ],
    "message": "Summary of the optimization results"
}

Generate content that is:
1. Authentic to the candidate's actual experience
2. Tailored specifically to the job requirements
3. Professional and compelling
4. ATS-friendly with relevant keywords
5. Quantifiable where possible`;

    try {
        const gptResponse = await callGPTAPI([
            { role: 'system', content: 'You are an expert resume optimization specialist. Always respond with valid JSON.' },
            { role: 'user', content: prompt }
        ], 3000);

        const optimization = JSON.parse(gptResponse);
        
        // Save cover letter to storage
        const coverLetterStorage = await saveCoverLetterToStorage(
            profile.user_id || 'unknown',
            optimization.coverLetter.content,
            optimization.coverLetter.jobTitle || 'position',
            optimization.coverLetter.companyName || 'company'
        );

        if (coverLetterStorage) {
            optimization.coverLetter.downloadUrl = coverLetterStorage.publicUrl;
            optimization.coverLetter.fileName = coverLetterStorage.fileName;
            optimization.coverLetter.saved = true;
        }

        return {
            success: true,
            optimization: optimization
        };
    } catch (error) {
        console.error('GPT optimization error:', error);
        throw new Error('Resume optimization failed. Please try again.');
    }
}

// AI-powered ATS compatibility check
async function checkATSCompatibilityWithGPT(profile, resume) {
    const prompt = `You are an ATS (Applicant Tracking System) compatibility expert. Analyze the following resume information and provide ATS optimization recommendations.

RESUME INFORMATION:
- File Name: ${resume.file_name}
- File Type: ${resume.file_type}
- Profile Skills: ${profile.skills || 'Not provided'}
- Current Title: ${profile.current_title || 'Not provided'}

Please provide ATS compatibility analysis in the following JSON format:
{
    "resumeInfo": {
        "fileName": "string",
        "fileType": "string"
    },
    "compatibility": {
        "score": "number (1-100)",
        "fileFormat": "Assessment of file format compatibility",
        "recommendations": [
            "Specific ATS optimization recommendations"
        ]
    },
    "optimizationTips": [
        "Actionable tips for improving ATS compatibility"
    ],
    "message": "Overall assessment summary"
}

Focus on practical, actionable advice for improving ATS compatibility.`;

    try {
        const gptResponse = await callGPTAPI([
            { role: 'system', content: 'You are an ATS compatibility expert. Always respond with valid JSON.' },
            { role: 'user', content: prompt }
        ]);

        const atsCheck = JSON.parse(gptResponse);
        
        return {
            success: true,
            atsCheck: atsCheck
        };
    } catch (error) {
        console.error('GPT ATS check error:', error);
        // Fallback analysis
        return {
            success: true,
            atsCheck: {
                resumeInfo: {
                    fileName: resume.file_name,
                    fileType: resume.file_type
                },
                compatibility: {
                    score: 70,
                    fileFormat: resume.file_type === 'application/pdf' ? 'PDF format is generally ATS-compatible' : 'Consider using PDF format for better compatibility',
                    recommendations: [
                        'Use standard section headings (Experience, Education, Skills)',
                        'Include relevant keywords from job descriptions',
                        'Use a clean, simple format without complex graphics',
                        'Ensure text is selectable (not embedded in images)'
                    ]
                },
                optimizationTips: [
                    'Tailor your resume keywords to each job application',
                    'Use standard fonts like Arial, Calibri, or Times New Roman',
                    'Save your resume as a PDF to preserve formatting',
                    'Test your resume by copying and pasting text to ensure it is readable'
                ],
                message: 'Your resume has good ATS compatibility with room for improvement'
            }
        };
    }
}
