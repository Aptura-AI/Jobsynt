const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const apolloApiKey = process.env.APOLLO_API_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('Missing Supabase credentials, returning empty recommendations');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          recommendations: {
            hr: [],
            department: [],
            skills: []
          },
          message: 'Network recommendations are being prepared. Check back later for personalized networking suggestions.'
        })
      };
    }

    // Clean environment variables (remove quotes and semicolons)
    const cleanSupabaseUrl = (supabaseUrl || '').replace(/[';]/g, '');
    const cleanSupabaseKey = (supabaseKey || '').replace(/[';]/g, '');
    
    const supabase = cleanSupabaseUrl && cleanSupabaseKey ? createClient(cleanSupabaseUrl, cleanSupabaseKey) : null;
    
    if (!supabase) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          recommendations: {
            hr: [],
            department: [],
            skills: []
          },
          message: 'Network recommendations are being prepared. Check back later for personalized networking suggestions.'
        })
      };
    }
    
    // Get user ID from request
    const { user_id } = event.queryStringParameters || {};
    if (!user_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'User ID is required' })
      };
    }

    // Get user's favorite companies
    const { data: favoriteCompanies, error: companiesError } = await supabase
      .from('favorite_companies')
      .select('*')
      .eq('user_id', user_id);

    if (companiesError) {
      console.error('Error fetching favorite companies:', companiesError);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          recommendations: {
            hr: [],
            department: [],
            skills: []
          },
          message: 'Network recommendations are being prepared. Check back later for personalized networking suggestions.'
        })
      };
    }

    // Get user profile for skills and preferences
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    // If Apollo API key is available, fetch real recommendations
    if (apolloApiKey && favoriteCompanies && favoriteCompanies.length > 0) {
      console.log('Fetching real network recommendations using Apollo.io API');
      const recommendations = await generateRealNetworkRecommendations(favoriteCompanies, profile, apolloApiKey);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          recommendations,
          message: recommendations.hr.length > 0 || recommendations.department.length > 0 || recommendations.skills.length > 0 
            ? 'Here are your personalized networking recommendations based on your favorite companies.'
            : 'No networking opportunities found at the moment. Our system continues searching for new connections at your favorite companies.'
        })
      };
    }

    // Return empty recommendations if no Apollo API or no favorite companies
    const recommendations = {
      hr: [],
      department: [],
      skills: []
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        recommendations,
        message: favoriteCompanies && favoriteCompanies.length > 0 
          ? 'Network recommendations are being prepared based on your favorite companies. Our system is working to find real networking opportunities for you. Check back later for personalized networking suggestions.'
          : 'Add your favorite companies to get personalized networking recommendations.'
      })
    };

  } catch (error) {
    console.error('Network recommendations error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        recommendations: {
          hr: [],
          department: [],
          skills: []
        },
        message: 'Network recommendations are being prepared. Check back later for personalized networking suggestions.'
      })
    };
  }
};

// Generate real network recommendations using Apollo.io API
async function generateRealNetworkRecommendations(favoriteCompanies, profile, apolloApiKey) {
  const recommendations = {
    hr: [],
    department: [],
    skills: []
  };

  try {
    // Limit to first 3 companies to manage API usage
    const companiesToSearch = favoriteCompanies.slice(0, 3);
    
    for (const company of companiesToSearch) {
      console.log(`Searching for contacts at ${company.company_name}`);
      
      // Search for HR/Recruiting contacts
      const hrContacts = await searchApolloContacts(company.company_name, ['HR Manager', 'Talent Acquisition', 'Recruiter', 'People Operations'], apolloApiKey);
      recommendations.hr.push(...hrContacts.map(contact => ({
        ...contact,
        category: 'hr',
        matchReason: 'Handles recruitment and talent acquisition'
      })));

      // Search for department-specific contacts based on user profile
      const targetRole = profile?.target_role || profile?.current_title || 'Manager';
      const departmentTitles = getDepartmentTitlesForRole(targetRole);
      const departmentContacts = await searchApolloContacts(company.company_name, departmentTitles, apolloApiKey);
      recommendations.department.push(...departmentContacts.map(contact => ({
        ...contact,
        category: 'department',
        matchReason: `Works in ${targetRole} or related department`
      })));

      // Search for skill-based contacts
      const userSkills = profile?.skills ? profile.skills.split(',').slice(0, 2) : ['Software Engineer', 'Developer'];
      const skillTitles = userSkills.map(skill => skill.trim());
      const skillContacts = await searchApolloContacts(company.company_name, skillTitles, apolloApiKey);
      recommendations.skills.push(...skillContacts.map(contact => ({
        ...contact,
        category: 'skills',
        matchReason: 'Shares similar technical skills or expertise'
      })));
    }

    // Limit results to avoid overwhelming the user
    recommendations.hr = recommendations.hr.slice(0, 5);
    recommendations.department = recommendations.department.slice(0, 5);
    recommendations.skills = recommendations.skills.slice(0, 5);

  } catch (error) {
    console.error('Error generating real network recommendations:', error);
  }

  return recommendations;
}

// Search Apollo.io for contacts at a specific company with specific titles
async function searchApolloContacts(companyName, jobTitles, apiKey) {
  try {
    const contacts = [];
    
    // Search for contacts with the specified job titles at the company
    const searchData = {
      api_key: apiKey,
      q_organization_names: companyName,
      person_titles: jobTitles,
      page: 1,
      per_page: 5 // Limit to avoid API overuse
    };

    const response = await axios.post('https://api.apollo.io/api/v1/mixed_people/search', searchData, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      timeout: 10000
    });

    if (response.data && response.data.people) {
      response.data.people.forEach(person => {
        if (person.name && person.title && person.organization) {
          contacts.push({
            name: person.name,
            designation: person.title,
            company: person.organization.name,
            linkedinUrl: person.linkedin_url || `https://linkedin.com/search/results/people/?keywords=${encodeURIComponent(person.name + ' ' + person.organization.name)}`,
            email: person.email || null,
            phone: person.phone_numbers && person.phone_numbers.length > 0 ? person.phone_numbers[0].sanitized_number : null
          });
        }
      });
    }

    return contacts;
  } catch (error) {
    console.error('Error searching Apollo contacts:', error);
    return [];
  }
}

// Get relevant job titles based on user's target role
function getDepartmentTitlesForRole(targetRole) {
  const lowerRole = targetRole.toLowerCase();
  
  if (lowerRole.includes('software') || lowerRole.includes('developer') || lowerRole.includes('engineer')) {
    return ['Engineering Manager', 'Senior Software Engineer', 'Tech Lead', 'CTO'];
  } else if (lowerRole.includes('marketing')) {
    return ['Marketing Manager', 'Digital Marketing Manager', 'CMO', 'Brand Manager'];
  } else if (lowerRole.includes('sales')) {
    return ['Sales Manager', 'Sales Director', 'VP Sales', 'Account Executive'];
  } else if (lowerRole.includes('product')) {
    return ['Product Manager', 'Senior Product Manager', 'VP Product', 'Product Owner'];
  } else if (lowerRole.includes('design')) {
    return ['Design Manager', 'Senior Designer', 'UX Manager', 'Creative Director'];
  } else if (lowerRole.includes('data') || lowerRole.includes('analyst')) {
    return ['Data Manager', 'Analytics Manager', 'Data Scientist', 'Senior Analyst'];
  } else {
    return ['Manager', 'Senior Manager', 'Director', 'Team Lead'];
  }
} 