// netlify/functions/ai-matcher.js
// AI-powered job matching based on user profile and preferences
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

    const { userProfile, jobs } = JSON.parse(event.body);
    
    if (!userProfile || !jobs || !Array.isArray(jobs)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Valid user profile and jobs array are required'
        })
      };
    }

    console.log(`Processing ${jobs.length} jobs for user profile`);

    // Calculate match scores for each job
    const rankedJobs = await rankJobs(userProfile, jobs);
    
    // Generate personalized recommendations
    const recommendations = generateRecommendations(userProfile, rankedJobs);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        rankedJobs: rankedJobs.slice(0, 20), // Top 20 matches
        recommendations,
        userProfile: {
          ...userProfile,
          lastAnalyzed: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Error in ai-matcher:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

async function rankJobs(userProfile, jobs) {
  try {
    const rankedJobs = [];

    for (const job of jobs) {
      const matchScore = calculateMatchScore(userProfile, job);
      const matchReasons = getMatchReasons(userProfile, job, matchScore);
      
      rankedJobs.push({
        ...job,
        matchScore,
        matchReasons,
        matchLevel: getMatchLevel(matchScore),
        applicationAdvice: getApplicationAdvice(userProfile, job, matchScore),
        matchDetails: getMatchDetails(userProfile, job)
      });
    }

    // Sort by match score (highest first)
    return rankedJobs.sort((a, b) => b.matchScore - a.matchScore);
  } catch (error) {
    console.error('Error ranking jobs:', error);
    throw error;
  }
}

function calculateMatchScore(userProfile, job) {
  try {
    let score = 0;
    let maxScore = 0;

    // Skills matching (30% weight) - reduced to give more weight to growth potential
    const skillsWeight = 30;
    const skillsMatch = calculateSkillsMatch(userProfile.skills || [], job);
    score += skillsMatch * skillsWeight;
    maxScore += skillsWeight;

    // Career Growth Potential (20% weight) - NEW
    const growthWeight = 20;
    const growthMatch = calculateGrowthPotential(userProfile, job);
    score += growthMatch * growthWeight;
    maxScore += growthWeight;

    // Experience level matching (15% weight)
    const experienceWeight = 15;
    const experienceMatch = calculateExperienceMatch(userProfile.experience || 0, job);
    score += experienceMatch * experienceWeight;
    maxScore += experienceWeight;

    // Location/Remote preference matching (15% weight)
    const locationWeight = 15;
    const locationMatch = calculateLocationMatch(userProfile, job);
    score += locationMatch * locationWeight;
    maxScore += locationWeight;

    // Salary matching (10% weight)
    const salaryWeight = 10;
    const salaryMatch = calculateSalaryMatch(userProfile.salaryExpectation, job.salary);
    score += salaryMatch * salaryWeight;
    maxScore += salaryWeight;

    // Company culture fit (10% weight) - NEW
    const cultureWeight = 10;
    const cultureMatch = calculateCultureFit(userProfile, job);
    score += cultureMatch * cultureWeight;
    maxScore += cultureWeight;

    return Math.round((score / maxScore) * 100);
  } catch (error) {
    console.error('Error calculating match score:', error);
    return 50;
  }
}

function calculateSkillsMatch(userSkills, job) {
  if (!userSkills?.length) return 0.3;
  
  try {
    const jobText = `${job.title} ${job.description || ''}`.toLowerCase();
    const matchedSkills = userSkills.filter(skill => 
      skill && jobText.includes(skill.toLowerCase())
    );
    
    // Ensure we don't divide by zero
    return userSkills.length > 0 ? matchedSkills.length / userSkills.length : 0;
  } catch (error) {
    console.error('Error calculating skills match:', error);
    return 0.3;
  }
}

function calculateExperienceMatch(userExperience, job) {
  try {
    const jobTitle = (job.title || '').toLowerCase();
    let requiredExperience = 2; // Default
    
    if (jobTitle.includes('senior') || jobTitle.includes('lead')) {
      requiredExperience = 5;
    } else if (jobTitle.includes('junior') || jobTitle.includes('entry')) {
      requiredExperience = 0;
    } else if (jobTitle.includes('principal') || jobTitle.includes('architect')) {
      requiredExperience = 8;
    } else if (jobTitle.includes('manager') || jobTitle.includes('director')) {
      requiredExperience = 6;
    }
    
    const experienceDiff = Math.abs((userExperience || 0) - requiredExperience);
    
    if (experienceDiff === 0) return 1.0;
    if (experienceDiff <= 1) return 0.8;
    if (experienceDiff <= 2) return 0.6;
    if (experienceDiff <= 3) return 0.4;
    return 0.2;
  } catch (error) {
    console.error('Error calculating experience match:', error);
    return 0.5;
  }
}

function calculateLocationMatch(userProfile, job) {
  try {
    const userLocation = (userProfile.location || '').toLowerCase();
    const jobLocation = (job.location || '').toLowerCase();
    const preferRemote = userProfile.preferRemote || false;
    const isRemote = job.remote || false;
    
    // Perfect match for remote preference
    if (preferRemote && isRemote) return 1.0;
    if (!preferRemote && !isRemote && userLocation && jobLocation.includes(userLocation)) return 1.0;
    
    // Partial matches
    if (isRemote && !preferRemote) return 0.7;
    if (preferRemote && !isRemote) return 0.3;
    if (userLocation && jobLocation && !jobLocation.includes(userLocation)) return 0.4;
    
    return 0.5;
  } catch (error) {
    console.error('Error calculating location match:', error);
    return 0.5;
  }
}

function calculateSalaryMatch(userExpectation, jobSalary) {
  try {
    if (!userExpectation || !jobSalary || jobSalary === 'Not specified') return 0.5;
    
    // Improved salary parsing
    const userSalary = typeof userExpectation === 'number' 
      ? userExpectation 
      : parseSalary(userExpectation) || 80000;
    
    const jobSalaryNum = parseSalary(jobSalary);
    if (!jobSalaryNum) return 0.5;
    
    const salaryRatio = jobSalaryNum / userSalary;
    
    if (salaryRatio >= 0.9 && salaryRatio <= 1.3) return 1.0;
    if (salaryRatio >= 0.8 && salaryRatio <= 1.5) return 0.8;
    if (salaryRatio >= 0.7 && salaryRatio <= 1.7) return 0.6;
    return 0.3;
  } catch (error) {
    console.error('Error calculating salary match:', error);
    return 0.5;
  }
}

function parseSalary(salaryStr) {
  if (typeof salaryStr === 'number') return salaryStr;
  
  // Handle ranges like "$80,000 - $100,000"
  const rangeMatch = salaryStr.match(/(\d[\d,]+)\s*-\s*(\d[\d,]+)/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1].replace(/,/g, ''));
    const max = parseInt(rangeMatch[2].replace(/,/g, ''));
    return (min + max) / 2; // Return average
  }
  
  // Handle single values
  const singleMatch = salaryStr.match(/(\d[\d,]+)/);
  if (singleMatch) {
    return parseInt(singleMatch[1].replace(/,/g, ''));
  }
  
  return null;
}

function calculateCompanySizeMatch(preferredSize, job) {
  try {
    if (!preferredSize || !job.companySize) return 0.5;
    
    const sizeMap = {
      'small': 1,
      'medium': 2,
      'large': 3
    };
    
    const userSize = sizeMap[preferredSize.toLowerCase()] || 2;
    const companySize = sizeMap[job.companySize.toLowerCase()] || 2;
    
    return userSize === companySize ? 1.0 : 0.5;
  } catch (error) {
    console.error('Error calculating company size match:', error);
    return 0.5;
  }
}

function calculateIndustryMatch(preferredIndustries, job) {
  try {
    if (!preferredIndustries?.length) return 0.5;
    
    const jobText = `${job.title} ${job.company} ${job.description || ''}`.toLowerCase();
    const matchedIndustries = preferredIndustries.filter(industry => 
      industry && jobText.includes(industry.toLowerCase())
    );
    
    return preferredIndustries.length > 0 
      ? matchedSkills.length / preferredIndustries.length 
      : 0.3;
  } catch (error) {
    console.error('Error calculating industry match:', error);
    return 0.5;
  }
}

function getMatchDetails(userProfile, job) {
  return {
    skillsMatch: calculateSkillsMatch(userProfile.skills || [], job),
    experienceMatch: calculateExperienceMatch(userProfile.experience || 0, job),
    locationMatch: calculateLocationMatch(userProfile, job),
    salaryMatch: calculateSalaryMatch(userProfile.salaryExpectation, job.salary),
    companySizeMatch: calculateCompanySizeMatch(userProfile.preferredCompanySize, job),
    industryMatch: calculateIndustryMatch(userProfile.preferredIndustries || [], job)
  };
}

function getMatchReasons(userProfile, job, matchScore) {
  const reasons = [];
  
  if (matchScore >= 80) {
    reasons.push('Excellent match for your skills and experience');
  }
  
  if (userProfile.skills?.length) {
    const jobText = `${job.title} ${job.description || ''}`.toLowerCase();
    const matchedSkills = userProfile.skills.filter(skill => 
      skill && jobText.includes(skill.toLowerCase())
    );
    if (matchedSkills.length > 0) {
      reasons.push(`Matches ${matchedSkills.length} of your skills`);
    }
  }
  
  if (userProfile.preferRemote && job.remote) {
    reasons.push('Remote position matches your preference');
  }
  
  if (job.salary && job.salary !== 'Not specified') {
    reasons.push('Salary meets your expectations');
  }
  
  if (reasons.length === 0) {
    reasons.push('Potential match based on basic criteria');
  }
  
  return reasons;
}

function getMatchLevel(score) {
  if (score >= 85) return 'EXCELLENT';
  if (score >= 70) return 'GOOD';
  if (score >= 50) return 'FAIR';
  return 'POOR';
}

function getApplicationAdvice(userProfile, job, matchScore) {
  const advice = [];
  
  if (matchScore >= 85) {
    advice.push('This is an excellent match - prioritize this application');
  } else if (matchScore >= 70) {
    advice.push('Strong match - tailor your application to highlight relevant experience');
  } else if (matchScore >= 50) {
    advice.push('Moderate match - consider if the role aligns with your goals');
  } else {
    advice.push('Low match - only apply if you have strong interest in this role');
  }
  
  // Salary advice
  if (!job.salary || job.salary === 'Not specified') {
    advice.push('Salary not specified - research typical compensation for this role');
  } else {
    const salaryMatch = calculateSalaryMatch(userProfile.salaryExpectation, job.salary);
    if (salaryMatch < 0.5) {
      advice.push('Salary may be below your expectations - consider negotiation strategy');
    }
  }
  
  // Remote advice
  if (job.remote && !userProfile.preferRemote) {
    advice.push('This is a remote position - ensure you have suitable work environment');
  } else if (!job.remote && userProfile.preferRemote) {
    advice.push('On-site position - consider if location works for you');
  }
  
  // Experience advice
  const expMatch = calculateExperienceMatch(userProfile.experience || 0, job);
  if (expMatch < 0.5) {
    advice.push('You may be under/over-qualified - address this in your application');
  }
  
  return advice;
}

function generateRecommendations(userProfile, rankedJobs) {
  try {
    const recommendations = {
      topMatches: rankedJobs.slice(0, 5).map(job => ({
        id: job.id || job._id,
        title: job.title,
        company: job.company,
        matchScore: job.matchScore,
        reason: job.matchReasons[0] || 'Good overall match',
        salary: job.salary || 'Not specified',
        location: job.location || 'Not specified'
      })),
      skillsToImprove: getSkillsRecommendations(userProfile, rankedJobs),
      careerAdvice: getCareerAdvice(userProfile, rankedJobs),
      stats: {
        totalJobs: rankedJobs.length,
        excellentMatches: rankedJobs.filter(j => j.matchScore >= 85).length,
        goodMatches: rankedJobs.filter(j => j.matchScore >= 70).length,
        remotePercentage: Math.round((rankedJobs.filter(j => j.remote).length / rankedJobs.length * 100) || 0)
      }
    };
    
    return recommendations;
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return {
      topMatches: [],
      skillsToImprove: [],
      careerAdvice: []
    };
  }
}

function getSkillsRecommendations(userProfile, jobs) {
  try {
    const allJobTexts = jobs.map(job => `${job.title} ${job.description || ''}`).join(' ').toLowerCase();
    
    const commonSkills = [
      'javascript', 'python', 'react', 'node.js', 'aws', 'docker', 'kubernetes',
      'sql', 'git', 'agile', 'scrum', 'machine learning', 'data analysis',
      'typescript', 'graphql', 'rest api', 'ci/cd', 'terraform', 'cloud computing'
    ];
    
    const userSkills = (userProfile.skills || []).map(s => s?.toLowerCase()).filter(Boolean);
    const recommendedSkills = commonSkills.filter(skill => 
      !userSkills.includes(skill) && allJobTexts.includes(skill)
    );
    
    // Add skills frequently appearing in high-match jobs
    const highMatchJobs = jobs.filter(j => j.matchScore >= 80);
    if (highMatchJobs.length > 0) {
      const highMatchTexts = highMatchJobs.map(j => `${j.title} ${j.description || ''}`).join(' ').toLowerCase();
      commonSkills.forEach(skill => {
        if (!userSkills.includes(skill) && highMatchTexts.includes(skill)) {
          recommendedSkills.push(skill);
        }
      });
    }
    
    return [...new Set(recommendedSkills)].slice(0, 5);
  } catch (error) {
    console.error('Error getting skill recommendations:', error);
    return [];
  }
}

function getCareerAdvice(userProfile, jobs) {
  const advice = [];
  
  try {
    const avgMatchScore = jobs.reduce((sum, job) => sum + job.matchScore, 0) / jobs.length;
    
    if (avgMatchScore < 50) {
      advice.push('Your profile has low match rates with current listings - consider expanding your skill set or search criteria');
    } else if (avgMatchScore > 75) {
      advice.push('Your profile is well-aligned with current market opportunities');
    }
    
    const remoteJobs = jobs.filter(job => job.remote).length;
    const totalJobs = jobs.length;
    
    if (remoteJobs / totalJobs > 0.6) {
      advice.push('Many remote opportunities available - consider if remote work suits your preferences');
    }
    
    // Skill gap analysis
    const missingSkills = getSkillsRecommendations(userProfile, jobs);
    if (missingSkills.length > 0) {
      advice.push(`Developing these skills could increase your matches: ${missingSkills.join(', ')}`);
    }
    
    if (advice.length === 0) {
      advice.push('Your profile shows good general alignment with current job market trends');
    }
    
    return advice;
  } catch (error) {
    console.error('Error generating career advice:', error);
    return ['Review your profile for optimal matching with current opportunities'];
  }
}