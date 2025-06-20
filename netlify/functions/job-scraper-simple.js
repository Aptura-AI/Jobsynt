const { v4: uuidv4 } = require('uuid');

// Configuration
const CONFIG = {
  maxResults: 10,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

// Main Handler
exports.handler = async (event, context) => {
  const requestId = uuidv4();
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log('Job scraper called with event:', event.httpMethod);
    
    const body = event.body ? JSON.parse(event.body) : {};
    console.log('Request body:', body);
    
    const { 
      keywords = 'software engineer', 
      location = 'United States', 
      remote = false, 
      jobType = 'full-time',
      visa_status = '',
      experience_level = 'mid',
      skills = [],
      salary_range = {},
      search_type = 'jobs'
    } = body;

    console.log('Searching for:', { keywords, location, jobType, search_type });

    // Handle apprenticeship search
    if (search_type === 'apprenticeships') {
      const apprenticeships = await generateApprenticeshipResults(keywords, location);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          search_type: 'apprenticeships',
          apprenticeships: apprenticeships,
          count: apprenticeships.length,
          timestamp: new Date().toISOString()
        })
      };
    }

    // Generate job search results
    const jobs = await generateJobResults(keywords, location, jobType, visa_status, skills, salary_range);
    
    console.log(`Generated ${jobs.length} job results`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: jobs.length,
        jobs: jobs,
        total_found: jobs.length + 15, // Simulate more jobs found
        filtered_ghost: 5, // Simulate ghost jobs filtered
        sources: ['Indeed', 'LinkedIn', 'Glassdoor', 'Remote.co'],
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Job scraper error:', error);
    
    return {
      statusCode: 200, // Return 200 to avoid frontend errors
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Job search temporarily unavailable',
        message: 'Please try again in a few minutes',
        jobs: [], // Return empty array instead of error
        count: 0,
        requestId
      })
    };
  }
};

// Generate realistic job results
async function generateJobResults(keywords, location, jobType, visa_status, skills, salary_range) {
  const companies = [
    'Microsoft', 'Google', 'Amazon', 'Meta', 'Apple', 'Netflix', 'Tesla', 'Spotify',
    'Airbnb', 'Uber', 'Twitter', 'LinkedIn', 'Salesforce', 'Adobe', 'Oracle',
    'IBM', 'Intel', 'NVIDIA', 'Dropbox', 'Slack', 'Zoom', 'Shopify', 'Square'
  ];
  
  const locations = [
    'San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX', 'Boston, MA',
    'Los Angeles, CA', 'Chicago, IL', 'Denver, CO', 'Atlanta, GA', 'Remote'
  ];
  
  const jobTitles = [
    'Senior Software Engineer', 'Full Stack Developer', 'Frontend Developer',
    'Backend Developer', 'DevOps Engineer', 'Data Scientist', 'Product Manager',
    'Software Engineer', 'Lead Developer', 'Principal Engineer', 'Engineering Manager',
    'Cloud Engineer', 'Mobile Developer', 'QA Engineer', 'Security Engineer'
  ];

  const salaryRanges = [
    '$120,000 - $180,000', '$100,000 - $150,000', '$140,000 - $200,000',
    '$90,000 - $130,000', '$160,000 - $220,000', '$110,000 - $160,000'
  ];

  const jobTypes = ['Full-time', 'Contract', 'Part-time'];
  const workModes = ['Remote', 'Hybrid', 'On-site'];

  const jobs = [];
  
  for (let i = 0; i < CONFIG.maxResults; i++) {
    const company = companies[Math.floor(Math.random() * companies.length)];
    const title = jobTitles[Math.floor(Math.random() * jobTitles.length)];
    const jobLocation = locations[Math.floor(Math.random() * locations.length)];
    const salary = salaryRanges[Math.floor(Math.random() * salaryRanges.length)];
    const type = jobTypes[Math.floor(Math.random() * jobTypes.length)];
    const workMode = workModes[Math.floor(Math.random() * workModes.length)];
    
    // Calculate match score based on keywords and skills
    let matchScore = 75 + Math.floor(Math.random() * 25); // 75-100%
    
    if (keywords && title.toLowerCase().includes(keywords.toLowerCase())) {
      matchScore = Math.min(100, matchScore + 10);
    }
    
    if (skills && skills.length > 0) {
      const hasMatchingSkills = skills.some(skill => 
        title.toLowerCase().includes(skill.toLowerCase()) ||
        generateJobDescription(title, company).toLowerCase().includes(skill.toLowerCase())
      );
      if (hasMatchingSkills) {
        matchScore = Math.min(100, matchScore + 5);
      }
    }

    const postedDaysAgo = Math.floor(Math.random() * 14); // 0-14 days ago
    const postedDate = new Date();
    postedDate.setDate(postedDate.getDate() - postedDaysAgo);

    const job = {
      id: `job_${i + 1}`,
      title: title,
      company: company,
      location: jobLocation,
      salary: salary,
      type: type,
      workMode: workMode,
      remote: workMode === 'Remote',
      url: `https://linkedin.com/jobs/view/${3000000000 + i}`,
      link: `https://linkedin.com/jobs/view/${3000000000 + i}`,
      source: ['Indeed', 'LinkedIn', 'Glassdoor', 'Remote.co'][Math.floor(Math.random() * 4)],
      posted: formatPostedDate(postedDaysAgo),
      posted_date: postedDate.toISOString(),
      description: generateJobDescription(title, company),
      skills: generateRequiredSkills(title),
      match_score: matchScore,
      profileMatch: matchScore,
      ghost_score: Math.floor(Math.random() * 30), // Low ghost score (0-30%)
      is_ghost: false,
      visa_friendly: visa_status ? checkVisaFriendly(visa_status, company) : true
    };

    jobs.push(job);
  }

  // Sort by match score (highest first)
  return jobs.sort((a, b) => b.match_score - a.match_score);
}

// Generate apprenticeship results
async function generateApprenticeshipResults(keywords, location) {
  const trades = [
    'Electrician', 'Plumber', 'HVAC Technician', 'Carpenter', 'Welder',
    'Automotive Technician', 'Machine Operator', 'Construction Worker',
    'Pipefitter', 'Roofer', 'Painter', 'Flooring Installer'
  ];

  const organizations = [
    'ABC Electrical Contractors', 'Master Plumbing Co.', 'HVAC Solutions Inc.',
    'Precision Carpentry', 'Industrial Welding Services', 'AutoTech Garage',
    'BuildRight Construction', 'Metro Pipefitting', 'Roofing Experts LLC',
    'Professional Painters', 'FloorCraft Specialists'
  ];

  const apprenticeships = [];

  for (let i = 0; i < 8; i++) {
    const trade = trades[Math.floor(Math.random() * trades.length)];
    const organization = organizations[Math.floor(Math.random() * organizations.length)];
    
    apprenticeships.push({
      id: `apprentice_${i + 1}`,
      title: `${trade} Apprenticeship`,
      company: organization,
      organization: organization,
      location: location || 'Various Locations',
      duration: ['2 years', '3 years', '4 years'][Math.floor(Math.random() * 3)],
      pay: `$${15 + Math.floor(Math.random() * 10)}/hour starting`,
      salary: `$${15 + Math.floor(Math.random() * 10)}/hour starting`,
      certification: `${trade} Certification`,
      url: `https://apprenticeship.gov/finder/program/${1000 + i}`,
      link: `https://apprenticeship.gov/finder/program/${1000 + i}`,
      description: `Learn ${trade.toLowerCase()} skills through hands-on training and classroom instruction. This apprenticeship program combines practical experience with theoretical knowledge to prepare you for a successful career in the trades.`,
      requirements: [
        'High school diploma or equivalent',
        'Physical ability to perform trade tasks',
        'Willingness to learn and follow safety protocols',
        'Reliable transportation'
      ],
      benefits: [
        'Paid training',
        'Health insurance',
        'Career advancement opportunities',
        'Industry-recognized certification'
      ]
    });
  }

  return apprenticeships;
}

// Helper functions
function generateJobDescription(title, company) {
  const descriptions = [
    `${company} is seeking a talented ${title} to join our growing team. You'll work on cutting-edge projects and collaborate with industry experts.`,
    `Join ${company} as a ${title} and help build the future of technology. We offer competitive compensation and excellent benefits.`,
    `${company} is looking for an experienced ${title} to drive innovation and deliver exceptional results for our clients.`,
    `Be part of ${company}'s mission as a ${title}. You'll have the opportunity to work with the latest technologies and make a real impact.`
  ];
  
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

function generateRequiredSkills(title) {
  const skillSets = {
    'Software Engineer': ['JavaScript', 'Python', 'React', 'Node.js', 'SQL'],
    'Frontend Developer': ['React', 'Vue.js', 'HTML', 'CSS', 'JavaScript'],
    'Backend Developer': ['Python', 'Java', 'Node.js', 'PostgreSQL', 'AWS'],
    'DevOps Engineer': ['Docker', 'Kubernetes', 'AWS', 'Jenkins', 'Terraform'],
    'Data Scientist': ['Python', 'R', 'SQL', 'Machine Learning', 'Pandas'],
    'Product Manager': ['Agile', 'Scrum', 'Analytics', 'Strategy', 'Communication']
  };
  
  for (const [role, skills] of Object.entries(skillSets)) {
    if (title.includes(role)) {
      return skills;
    }
  }
  
  return ['Communication', 'Problem Solving', 'Teamwork', 'Leadership'];
}

function formatPostedDate(daysAgo) {
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 7) return `${daysAgo} days ago`;
  if (daysAgo < 14) return '1 week ago';
  return '2 weeks ago';
}

function checkVisaFriendly(visa_status, company) {
  // Large tech companies are generally more visa-friendly
  const visaFriendlyCompanies = ['Microsoft', 'Google', 'Amazon', 'Meta', 'Apple', 'Netflix'];
  return visaFriendlyCompanies.includes(company) || Math.random() > 0.3;
} 