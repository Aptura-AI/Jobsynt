// netlify/functions/ghost-detector.js
// AI-powered ghost job detection using various signals
const axios = require('axios');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Request body is required' 
        })
      };
    }

    const { job } = JSON.parse(event.body);
    
    if (!job || !job.title || !job.company) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Job title and company are required'
        })
      };
    }

    console.log('Processing job:', job.title, 'at', job.company);

    // Ghost job detection algorithm
    const ghostScore = await calculateGhostScore(job);
    const riskLevel = getRiskLevel(ghostScore);
    const flags = getJobFlags(job, ghostScore);
    const recommendation = getRecommendation(ghostScore, riskLevel);

    console.log('Calculated ghost score:', ghostScore, 'Risk level:', riskLevel);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        job: {
          ...job,
          ghostScore,
          riskLevel,
          flags,
          isGhost: ghostScore > 70,
          recommendation
        }
      })
    };

  } catch (error) {
    console.error('Error processing job:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      })
    };
  }
};

async function calculateGhostScore(job) {
  let score = 0;
  
  // Red flags that increase ghost job probability
  const redFlags = [
    // Job posting age
    { check: isJobTooOld(job.posted), weight: 25, reason: 'Job posted over 30 days ago' },
    
    // Vague job descriptions
    { check: hasVagueDescription(job.description || job.title), weight: 20, reason: 'Vague job description' },
    
    // Unrealistic requirements
    { check: hasUnrealisticRequirements(job.description || ''), weight: 15, reason: 'Unrealistic requirements' },
    
    // Generic company descriptions
    { check: hasGenericCompanyInfo(job.company), weight: 15, reason: 'Generic company information' },
    
    // No salary information
    { check: !job.salary || job.salary === 'Not specified', weight: 10, reason: 'No salary information' },
    
    // Multiple locations
    { check: job.location && job.location.includes(','), weight: 10, reason: 'Multiple locations listed' },
    
    // Always hiring companies
    { check: isAlwaysHiringCompany(job.company), weight: 30, reason: 'Company constantly hiring' },
    
    // High turnover indicators
    { check: hasHighTurnoverKeywords(job.description || ''), weight: 15, reason: 'High turnover indicators' }
  ];

  // Calculate weighted score
  redFlags.forEach(flag => {
    if (flag.check) {
      score += flag.weight;
    }
  });

  return Math.min(score, 100);
}

function isJobTooOld(posted) {
  if (!posted) return false;
  
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    
    // Handle ISO dates
    if (Date.parse(posted)) {
      return new Date(posted) < thirtyDaysAgo;
    }
    
    // Handle relative dates
    if (posted.includes('days ago')) {
      const days = parseInt(posted.match(/(\d+)/)[1]);
      return days > 30;
    }
    
    if (posted.includes('weeks ago')) {
      const weeks = parseInt(posted.match(/(\d+)/)[1]);
      return weeks > 4;
    }
    
    if (posted.includes('months ago')) {
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Date parsing error:', e);
    return false;
  }
}

function hasVagueDescription(text) {
  if (!text) return true;
  
  const vagueTerms = [
    'competitive salary',
    'fast-paced environment',
    'dynamic team',
    'wear many hats',
    'self-starter',
    'rockstar',
    'ninja',
    'guru',
    'competitive pay',
    'other duties as assigned'
  ];
  
  const lowerText = text.toLowerCase();
  return vagueTerms.some(term => lowerText.includes(term));
}

function hasUnrealisticRequirements(description) {
  if (!description) return false;
  
  const unrealisticPatterns = [
    /\d+\+?\s*years.*entry.level/i,
    /5\+.*years.*junior/i,
    /expert.*all.*technologies/i,
    /10\+.*years.*senior/i,
    /master.*multiple.*frameworks/i
  ];
  
  return unrealisticPatterns.some(pattern => pattern.test(description));
}

function hasGenericCompanyInfo(company) {
  if (!company) return true;
  
  const genericTerms = [
    'leading company',
    'innovative startup',
    'fast-growing',
    'well-funded',
    'stealth mode',
    'disruptive',
    'industry leader'
  ];
  
  const lowerCompany = company.toLowerCase();
  return genericTerms.some(term => lowerCompany.includes(term));
}

function isAlwaysHiringCompany(company) {
  const alwaysHiring = [
    'amazon',
    'accenture',
    'cognizant',
    'tcs',
    'infosys',
    'wipro',
    'randstad',
    'hcl'
  ];
  
  const lowerCompany = company.toLowerCase();
  return alwaysHiring.some(name => lowerCompany.includes(name));
}

function hasHighTurnoverKeywords(description) {
  if (!description) return false;
  const terms = [
    'immediate hire',
    'urgent hiring',
    'multiple openings',
    'hiring immediately',
    'immediate opening',
    'urgent requirement',
    'immediate start'
  ];
  return terms.some(term => description.toLowerCase().includes(term));
}

function getRiskLevel(score) {
  if (score >= 80) return 'HIGH';
  if (score >= 60) return 'MEDIUM';
  if (score >= 30) return 'LOW';
  return 'MINIMAL';
}

function getJobFlags(job, score) {
  const flags = [];
  
  if (score >= 70) flags.push('LIKELY_GHOST');
  if (isJobTooOld(job.posted)) flags.push('OLD_POSTING');
  if (!job.salary || job.salary === 'Not specified') flags.push('NO_SALARY');
  if (hasVagueDescription(job.description || job.title)) flags.push('VAGUE_DESCRIPTION');
  if (isAlwaysHiringCompany(job.company)) flags.push('ALWAYS_HIRING');
  if (hasHighTurnoverKeywords(job.description || '')) flags.push('HIGH_TURNOVER');
  
  return flags;
}

function getRecommendation(score, riskLevel) {
  if (score >= 80) {
    return 'HIGH RISK: This job shows multiple ghost job indicators. Strongly consider avoiding or verifying with current employees.';
  }
  if (score >= 60) {
    return 'MEDIUM RISK: Several red flags detected. Research company thoroughly and check employee reviews before applying.';
  }
  if (score >= 30) {
    return 'LOW RISK: Some minor concerns. Apply with normal precautions and verify details during interview.';
  }
  return 'MINIMAL RISK: This job appears legitimate based on our analysis. Standard application recommended.';
}