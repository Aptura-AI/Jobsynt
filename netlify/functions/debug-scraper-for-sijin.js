const { createClient } = require('@supabase/supabase-js');

// Clean environment variables (remove quotes and semicolons)
const cleanSupabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/[';]/g, '');
const cleanSupabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').replace(/[';]/g, '');

const supabase = cleanSupabaseUrl && cleanSupabaseKey ? 
    createClient(cleanSupabaseUrl, cleanSupabaseKey) : 
    null;

// IT and C2C related keywords for auto-detection
const IT_KEYWORDS = [
    'software developer', 'java', 'python', 'javascript', 'react', 'angular', 'vue',
    'node.js', 'php', 'c#', '.net', 'sql', 'database', 'aws', 'azure', 'cloud',
    'devops', 'kubernetes', 'docker', 'microservices', 'api', 'backend', 'frontend',
    'full stack', 'data engineer', 'data scientist', 'machine learning', 'ai',
    'cybersecurity', 'network', 'system admin', 'sap', 'salesforce', 'servicenow',
    'tableau', 'power bi', 'scrum master', 'product owner', 'qa', 'testing',
    'automation', 'ci/cd', 'jenkins', 'git', 'agile', 'mobile developer',
    'ios', 'android', 'flutter', 'react native', 'blockchain', 'ethereum'
];

const C2C_KEYWORDS = [
    'c2c', 'corp to corp', 'corp-to-corp', 'contract', 'contractor', 'consulting',
    'vendor', 'w2', '1099', 'freelance', 'independent contractor'
];

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        console.log('🔍 Starting debug analysis for Sijin\'s profile...');

        if (!supabase) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Supabase not configured',
                    debug: {
                        hasUrl: !!cleanSupabaseUrl,
                        hasKey: !!cleanSupabaseKey,
                        urlLength: cleanSupabaseUrl?.length || 0,
                        keyLength: cleanSupabaseKey?.length || 0
                    }
                })
            };
        }

        // Get all profiles to find Sijin
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*');

        if (profilesError) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Failed to fetch profiles',
                    details: profilesError.message
                })
            };
        }

        console.log(`📊 Found ${profiles?.length || 0} total profiles`);

        // Find Sijin's profile
        const sijinProfile = profiles?.find(p => 
            p.full_name?.toLowerCase().includes('sijin') ||
            p.email?.toLowerCase().includes('sijin')
        );

        if (!sijinProfile) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Sijin profile not found',
                    available_profiles: profiles?.map(p => ({
                        name: p.full_name,
                        email: p.email,
                        current_title: p.current_title,
                        target_role: p.target_role
                    })) || []
                })
            };
        }

        console.log('👤 Found Sijin\'s profile:', sijinProfile.email);

        // Analyze the profile
        const { current_title, skills, city, state, country, contract_types, id: profile_id, email } = sijinProfile;
        
        // Create search query from current_title and skills
        const searchTerms = [];
        if (current_title) searchTerms.push(current_title);
        if (skills) searchTerms.push(skills);
        
        const searchQuery = searchTerms.join(' ').toLowerCase();

        // Check if this is an IT role
        const matchingITKeywords = IT_KEYWORDS.filter(keyword => 
            searchQuery.includes(keyword.toLowerCase())
        );
        const isITRole = matchingITKeywords.length > 0;

        // Check if user wants C2C contracts
        const matchingC2CKeywords = C2C_KEYWORDS.filter(keyword => 
            searchQuery.includes(keyword.toLowerCase())
        );
        const wantsC2C = contract_types?.includes('c2c') || 
                         contract_types?.includes('contract') ||
                         matchingC2CKeywords.length > 0;

        // Check for existing jobs
        const { data: existingJobs, error: jobsError } = await supabase
            .from('scraped_jobs')
            .select('*')
            .eq('profile_id', profile_id)
            .order('scraped_at', { ascending: false })
            .limit(10);

        // Environment check
        const envCheck = {
            supabase_url: !!process.env.SUPABASE_URL,
            supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            jsearch_api: !!process.env.JSEARCH_API_KEY,
            adzuna_api: !!process.env.ADZUNA_API_KEY,
            adzuna_app_id: !!process.env.ADZUNA_APP_ID
        };

        const analysis = {
            timestamp: new Date().toISOString(),
            profile_analysis: {
                profile_id: profile_id,
                email: email,
                full_name: sijinProfile.full_name,
                current_title: current_title,
                target_role: sijinProfile.target_role,
                skills: skills,
                location: {
                    city: city,
                    state: state,
                    country: country,
                    formatted: city && state ? `${city}, ${state}` : (state || country || 'remote')
                },
                contract_types: contract_types
            },
            scraper_logic: {
                search_query: searchQuery,
                search_terms: searchTerms,
                is_it_role: isITRole,
                matching_it_keywords: matchingITKeywords,
                wants_c2c: wantsC2C,
                matching_c2c_keywords: matchingC2CKeywords,
                would_be_scraped: isITRole && wantsC2C,
                skip_reasons: []
            },
            existing_jobs: {
                count: existingJobs?.length || 0,
                jobs: existingJobs || [],
                error: jobsError?.message || null
            },
            environment_check: envCheck,
            recommendations: []
        };

        // Add skip reasons
        if (!searchQuery) {
            analysis.scraper_logic.skip_reasons.push('No search query (missing current_title and skills)');
        }
        if (!isITRole) {
            analysis.scraper_logic.skip_reasons.push('Profile not detected as IT role');
        }
        if (!wantsC2C) {
            analysis.scraper_logic.skip_reasons.push('Profile doesn\'t indicate C2C/contract interest');
        }

        // Add recommendations
        if (!isITRole && current_title) {
            analysis.recommendations.push(`Add IT keywords to current_title or skills. Current: "${current_title}"`);
        }
        if (!wantsC2C) {
            analysis.recommendations.push('Add "contract" or "c2c" to contract_types field or skills');
        }
        if (!envCheck.jsearch_api && !envCheck.adzuna_api) {
            analysis.recommendations.push('No job search APIs configured - scraper cannot find real jobs');
        }
        if (analysis.existing_jobs.count === 0 && analysis.scraper_logic.would_be_scraped) {
            analysis.recommendations.push('Profile should be scraped but no jobs found - check API keys and rate limits');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Debug analysis completed for Sijin\'s profile',
                analysis: analysis,
                action_needed: analysis.scraper_logic.skip_reasons.length > 0 || analysis.recommendations.length > 0
            })
        };

    } catch (error) {
        console.error('Debug scraper error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Debug analysis failed',
                details: error.message
            })
        };
    }
};
