// netlify/functions/ghost-detector.js
// Enhanced AI-powered ghost job detection with simplified scoring
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

    // Calculate both comprehensive and simplified scores
    const comprehensiveScore = await calculateGhostScore(job);
    const simplifiedScore = calculateSimpleScore(job.description || '', job.company);
    
    // Combine scores with weighted average (60% comprehensive, 40% simplified)
    const combinedScore = Math.round((comprehensiveScore * 0.6) + (simplifiedScore * 0.4));
    
    const riskLevel = getRiskLevel(combinedScore);
    const flags = getJobFlags(job, combinedScore);
    const recommendation = getRecommendation(combinedScore, riskLevel);
    const summary = getSummary(combinedScore);

    console.log('Scores - Comprehensive:', comprehensiveScore, 'Simplified:', simplifiedScore, 'Combined:', combinedScore);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        job: {
          ...job,
          ghostScore: combinedScore,
          comprehensiveScore,
          simplifiedScore,
          riskLevel,
          flags,
          isGhost: combinedScore > 70,
          recommendation,
          summary
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

// New simplified scoring function
function calculateSimpleScore(desc, company) {
  let score = 0;
  desc = (desc || '').toLowerCase();
  company = (company || '').toLowerCase();
  
  // More precise scoring:
  if (desc.length < 100) score += 40;  // Increased from 30
  if (/recruit|staffing|talent/i.test(company)) score += 30; // Increased from 20
  if (/urgently|immediate|hiring now/i.test(desc)) score += 20; // Increased from 10
  if (!desc.includes("responsibilities")) score += 10; // New rule
  
  return Math.min(100, score);
}

// New summary function
function getSummary(score) {
  if (score > 70) return "🚩 High ghost job risk";
  if (score > 40) return "⚠️ Moderate risk";
  return "✅ Likely legitimate";
}

// Original comprehensive scoring function
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

// Rest of the original helper functions remain unchanged
function isJobTooOld(posted) {
  if (!posted) return false;
  
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    
    if (Date.parse(posted)) {
      return new Date(posted) < thirtyDaysAgo;
    }
    
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
  
  // Add flags from simple scoring
  const desc = (job.description || '').toLowerCase();
  if (desc.length < 100) flags.push('SHORT_DESCRIPTION');
  if (/recruit|staffing|talent/i.test(job.company)) flags.push('RECRUITER_COMPANY');
  if (/urgently|immediate|hiring now/i.test(desc)) flags.push('URGENT_HIRING');
  if (!desc.includes("responsibilities")) flags.push('NO_RESPONSIBILITIES');
  
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