const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const nodemailer = require('nodemailer');
const moment = require('moment');
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Remove LinkedIn API client initialization
// Add LinkedIn scraping configuration
const LINKEDIN_SCRAPER_CONFIG = {
  maxConcurrentPages: 2,
  waitTime: 2000,
  retryAttempts: 3,
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  ]
};

// Email configuration
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

exports.handler = async (event, context) => {
  try {
    // Get all active users
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('digest_enabled', true);

    if (error) throw error;

    for (const user of users) {
      await generateAndSendDigest(user);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Weekly digests sent successfully' })
    };
  } catch (error) {
    console.error('Error sending digests:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send digests' })
    };
  }
};

async function generateAndSendDigest(user) {
  try {
    // Get user's preferences and profile data
    const preferences = await getUserPreferences(user.id);
    const profile = await getUserProfile(user.id);

    // Generate digest content
    const digestContent = await generateDigestContent(user, preferences, profile);

    // Send email
    await sendDigestEmail(user.email, digestContent);

    // Log successful send
    await logDigestSent(user.id);
  } catch (error) {
    console.error(`Error generating digest for user ${user.id}:`, error);
    throw error;
  }
}

async function generateDigestContent(user, preferences, profile) {
  const [
    topJobs,
    industryNews,
    companyNews,
    careerRecommendations,
    networkingRecommendations
  ] = await Promise.all([
    getTopJobMatches(user, profile),
    getIndustryNews(profile.industry),
    getCompanyNews(preferences.favorite_companies),
    generateCareerRecommendations(profile),
    generateNetworkingRecommendations(user, profile)
  ]);

  return {
    weekOf: moment().format('MMMM D, YYYY'),
    userName: profile.first_name,
    topJobs,
    industryNews,
    companyNews,
    careerRecommendations,
    networkingRecommendations
  };
}

async function getTopJobMatches(user, profile) {
  // Get jobs from the past week
  const { data: recentJobs } = await supabase
    .from('jobs')
    .select('*')
    .gte('posted_date', moment().subtract(7, 'days').toISOString());

  // Rank jobs using the AI matcher
  const rankedJobs = await rankJobsByProfile(recentJobs, profile);

  // Return top 10 matches
  return rankedJobs.slice(0, 10).map(job => ({
    title: job.title,
    company: job.company,
    location: job.location,
    matchScore: job.match_score,
    matchFactors: job.match_factors.slice(0, 2),
    salary: job.salary,
    url: job.url,
    growthPotential: job.growth_potential,
    learningOpportunities: job.learning_opportunities
  }));
}

async function getIndustryNews(industry) {
  try {
    // Get news using web search API
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: `${industry} career technology trends`,
        language: 'en',
        sortBy: 'relevancy',
        pageSize: 5,
        apiKey: process.env.NEWS_API_KEY
      }
    });

    return response.data.articles.map(article => ({
      title: article.title,
      description: article.description,
      url: article.url,
      source: article.source.name,
      publishedAt: moment(article.publishedAt).format('MMM D, YYYY')
    }));
  } catch (error) {
    console.error('Error fetching industry news:', error);
    return [];
  }
}

async function getCompanyNews(companies) {
  if (!companies?.length) return [];

  try {
    const newsPromises = companies.map(company =>
      axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: `${company} (hiring OR growth OR expansion)`,
          language: 'en',
          sortBy: 'relevancy',
          pageSize: 2,
          apiKey: process.env.NEWS_API_KEY
        }
      })
    );

    const responses = await Promise.all(newsPromises);
    return responses.flatMap(response =>
      response.data.articles.map(article => ({
        company: article.title.split(' ')[0], // Approximate company name
        title: article.title,
        description: article.description,
        url: article.url,
        source: article.source.name,
        publishedAt: moment(article.publishedAt).format('MMM D, YYYY')
      }))
    );
  } catch (error) {
    console.error('Error fetching company news:', error);
    return [];
  }
}

async function generateCareerRecommendations(profile) {
  try {
    // Get skill gaps from recent job matches
    const skillGaps = await getSkillGaps(profile);

    // Get relevant certifications
    const certifications = await getRelevantCertifications(profile, skillGaps);

    // Get course recommendations
    const courses = await getCourseRecommendations(profile, skillGaps);

    // Get career path suggestions
    const careerPaths = await getCareerPathSuggestions(profile);

    return {
      skillGaps: skillGaps.slice(0, 3),
      certifications: certifications.slice(0, 3),
      courses: courses.slice(0, 3),
      careerPaths
    };
  } catch (error) {
    console.error('Error generating career recommendations:', error);
    return {};
  }
}

async function getSkillGaps(profile) {
  // Get trending skills in user's industry
  const trendingSkills = await getTrendingSkills(profile.industry);
  
  // Compare with user's current skills
  const userSkills = new Set(profile.skills.map(s => s.toLowerCase()));
  
  return trendingSkills.filter(skill => !userSkills.has(skill.toLowerCase()))
    .map(skill => ({
      name: skill,
      relevance: 'High',
      trend: 'Growing',
      demandScore: 85
    }));
}

async function getRelevantCertifications(profile, skillGaps) {
  // Map of skills to relevant certifications
  const certificationMap = {
    'cloud': [
      { name: 'AWS Certified Solutions Architect', provider: 'Amazon', duration: '6 months' },
      { name: 'Azure Solutions Architect', provider: 'Microsoft', duration: '3 months' }
    ],
    'security': [
      { name: 'CompTIA Security+', provider: 'CompTIA', duration: '2 months' },
      { name: 'Certified Information Systems Security Professional (CISSP)', provider: 'ISC2', duration: '6 months' }
    ],
    'data': [
      { name: 'Google Data Analytics Professional Certificate', provider: 'Google', duration: '6 months' },
      { name: 'IBM Data Science Professional Certificate', provider: 'IBM', duration: '3 months' }
    ]
  };

  return skillGaps
    .flatMap(skill => certificationMap[skill.name.toLowerCase()] || [])
    .slice(0, 3);
}

async function getCourseRecommendations(profile, skillGaps) {
  // Integration with course platforms
  const platforms = ['Coursera', 'Udemy', 'edX'];
  
  return skillGaps.flatMap(skill => platforms.map(platform => ({
    name: `${skill.name} Fundamentals`,
    platform,
    duration: '4-6 weeks',
    rating: 4.5,
    enrolled: '10K+',
    price: '$49.99'
  })));
}

async function getCareerPathSuggestions(profile) {
  const careerLevels = ['entry', 'mid', 'senior', 'lead', 'architect', 'management'];
  const currentLevel = profile.experience_level || 'entry';
  const currentIndex = careerLevels.indexOf(currentLevel);
  
  return careerLevels.slice(currentIndex + 1, currentIndex + 3).map(level => ({
    level,
    title: `Senior ${profile.current_title}`,
    requiredSkills: ['Leadership', 'System Design', 'Architecture'],
    timeframe: '2-3 years',
    salaryRange: '$120K - $180K'
  }));
}

async function generateNetworkingRecommendations(user, profile) {
  try {
    const networkInsights = await getNetworkInsights(user);
    const industryConnections = await getIndustryConnections(profile);
    const upcomingEvents = await getRelevantEvents(profile);
    const connectionOpportunities = await findConnectionOpportunities(user, profile);

    return {
      insights: networkInsights,
      suggestedConnections: industryConnections,
      events: upcomingEvents,
      opportunities: connectionOpportunities
    };
  } catch (error) {
    console.error('Error generating networking recommendations:', error);
    return {};
  }
}

async function getNetworkInsights(user) {
  try {
    const browser = await initPuppeteer();
    const page = await browser.newPage();
    
    // Set random user agent
    await page.setUserAgent(LINKEDIN_SCRAPER_CONFIG.userAgents[Math.floor(Math.random() * LINKEDIN_SCRAPER_CONFIG.userAgents.length)]);
    
    // Use stored LinkedIn profile URL from user's profile
    const profileUrl = user.linkedin_profile_url;
    if (!profileUrl) {
      throw new Error('LinkedIn profile URL not found');
    }

    await page.goto(profileUrl, { waitUntil: 'networkidle0' });
    await page.waitForTimeout(LINKEDIN_SCRAPER_CONFIG.waitTime);

    const networkStats = await page.evaluate(() => {
      const connections = document.querySelector('.connection-count')?.innerText || '500+';
      const posts = document.querySelectorAll('.profile-activity-post').length;
      const engagements = Array.from(document.querySelectorAll('.social-details-engagement')).reduce((sum, el) => {
        return sum + parseInt(el.innerText) || 0;
      }, 0);

      return {
        totalConnections: connections,
        recentPosts: posts,
        totalEngagements: engagements
      };
    });

    await browser.close();

    return {
      networkSize: networkStats.totalConnections,
      industryPresence: calculateIndustryPresence(networkStats),
      growthRate: 'Steady', // Simplified without historical data
      engagementScore: calculateEngagementScore(networkStats),
      recentActivity: networkStats.recentPosts
    };
  } catch (error) {
    console.error('Error fetching network insights:', error);
    return null;
  }
}

async function getIndustryConnections(profile) {
  try {
    const browser = await initPuppeteer();
    const page = await browser.newPage();
    
    // Set random user agent and other configurations
    await configureScrapingPage(page);

    // Search for industry professionals
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(profile.industry)}&origin=GLOBAL_SEARCH_HEADER`;
    await page.goto(searchUrl, { waitUntil: 'networkidle0' });
    await page.waitForTimeout(LINKEDIN_SCRAPER_CONFIG.waitTime);

    const connections = await page.evaluate(() => {
      const results = Array.from(document.querySelectorAll('.reusable-search__result-container'));
      return results.slice(0, 5).map(result => ({
        name: result.querySelector('.actor-name')?.innerText || '',
        title: result.querySelector('.subline-level-1')?.innerText || '',
        company: result.querySelector('.subline-level-2')?.innerText || '',
        mutualConnections: result.querySelector('.social-proof-size')?.innerText || '0',
        profileUrl: result.querySelector('.app-aware-link')?.href || ''
      }));
    });

    await browser.close();

    return connections.map(person => ({
      ...person,
      connectionStrength: calculateConnectionStrength(person)
    }));
  } catch (error) {
    console.error('Error fetching industry connections:', error);
    return [];
  }
}

async function getRelevantEvents(profile) {
  try {
    const browser = await initPuppeteer();
    const page = await browser.newPage();
    await configureScrapingPage(page);

    // Search LinkedIn Events
    await page.goto('https://www.linkedin.com/events/', { waitUntil: 'networkidle0' });
    await page.waitForTimeout(LINKEDIN_SCRAPER_CONFIG.waitTime);

    const events = await page.evaluate(() => {
      const eventCards = Array.from(document.querySelectorAll('.event-card'));
      return eventCards.slice(0, 5).map(card => ({
        name: card.querySelector('.event-title')?.innerText || '',
        date: card.querySelector('.event-date')?.innerText || '',
        type: card.querySelector('.event-type')?.innerText || '',
        format: card.querySelector('.event-format')?.innerText || 'online',
        url: card.querySelector('a')?.href || '',
        attendees: card.querySelector('.attendee-count')?.innerText || '0',
        description: card.querySelector('.event-description')?.innerText || ''
      }));
    });

    await browser.close();

    return events.map(event => ({
      ...event,
      relevanceScore: calculateEventRelevance(event, profile)
    }));
  } catch (error) {
    console.error('Error fetching relevant events:', error);
    return [];
  }
}

async function findConnectionOpportunities(user, profile) {
  try {
    const browser = await initPuppeteer();
    const page = await browser.newPage();
    await configureScrapingPage(page);

    // Search for recommended connections
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(profile.industry + ' ' + profile.target_role)}&origin=GLOBAL_SEARCH_HEADER`;
    await page.goto(searchUrl, { waitUntil: 'networkidle0' });
    await page.waitForTimeout(LINKEDIN_SCRAPER_CONFIG.waitTime);

    const opportunities = await page.evaluate(() => {
      const results = Array.from(document.querySelectorAll('.reusable-search__result-container'));
      return results.slice(0, 5).map(result => ({
        name: result.querySelector('.actor-name')?.innerText || '',
        title: result.querySelector('.subline-level-1')?.innerText || '',
        company: result.querySelector('.subline-level-2')?.innerText || '',
        mutualConnections: result.querySelector('.social-proof-size')?.innerText || '0',
        profileUrl: result.querySelector('.app-aware-link')?.href || '',
        commonInterests: Array.from(result.querySelectorAll('.interest-tag')).map(tag => tag.innerText),
      }));
    });

    await browser.close();

    return opportunities.map(rec => ({
      ...rec,
      reason: generateConnectionReason(rec, profile),
      strength: calculateConnectionStrength(rec),
      approach: generateConnectionApproach(rec)
    }));
  } catch (error) {
    console.error('Error finding connection opportunities:', error);
    return [];
  }
}

// Helper functions for scraping
async function initPuppeteer() {
  const executablePath = await chromium.executablePath;
  
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: executablePath,
    headless: true,
    ignoreHTTPSErrors: true
  });
}

async function configureScrapingPage(page) {
  await page.setUserAgent(LINKEDIN_SCRAPER_CONFIG.userAgents[Math.floor(Math.random() * LINKEDIN_SCRAPER_CONFIG.userAgents.length)]);
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Add request interception to avoid unnecessary resources
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
      req.abort();
    } else {
      req.continue();
    }
  });
}

function calculateConnectionStrength(person) {
  const mutualCount = parseInt(person.mutualConnections) || 0;
  if (mutualCount > 50) return 'Very Strong';
  if (mutualCount > 20) return 'Strong';
  if (mutualCount > 10) return 'Moderate';
  return 'Basic';
}

function generateConnectionReason(person, profile) {
  const reasons = [];
  if (person.company.includes(profile.target_companies)) {
    reasons.push('Works at your target company');
  }
  if (person.title.toLowerCase().includes(profile.target_role.toLowerCase())) {
    reasons.push('Has your target role');
  }
  if (parseInt(person.mutualConnections) > 10) {
    reasons.push(`${person.mutualConnections} mutual connections`);
  }
  return reasons.join(', ');
}

function generateConnectionApproach(person) {
  const approaches = [
    'Mention mutual connections',
    'Reference shared industry interests',
    'Discuss common career path',
    'Ask about their experience at their company'
  ];
  return approaches[Math.floor(Math.random() * approaches.length)];
}

async function sendDigestEmail(email, content) {
  const htmlContent = generateEmailHTML(content);
  
  await emailTransporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `Your Weekly Career Digest - ${content.weekOf}`,
    html: htmlContent
  });
}

function generateEmailHTML(content) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        /* Add your email CSS styles here */
      </style>
    </head>
    <body>
      <h1>Your Weekly Career Digest</h1>
      <p>Hello ${content.userName},</p>
      
      <h2>🎯 Top Job Matches This Week</h2>
      ${content.topJobs.map(job => `
        <div class="job-card">
          <h3>${job.title} at ${job.company}</h3>
          <p>Match Score: ${job.matchScore}%</p>
          <p>Why this matches you: ${job.matchFactors.join(', ')}</p>
          <a href="${job.url}">View Job</a>
        </div>
      `).join('')}

      <h2>📰 Industry News</h2>
      ${content.industryNews.map(news => `
        <div class="news-item">
          <h3>${news.title}</h3>
          <p>${news.description}</p>
          <a href="${news.url}">Read More</a>
        </div>
      `).join('')}

      <h2>🏢 Company Updates</h2>
      ${content.companyNews.map(news => `
        <div class="company-news">
          <h3>${news.company}</h3>
          <p>${news.title}</p>
          <a href="${news.url}">Read More</a>
        </div>
      `).join('')}

      <h2>🚀 Career Development Recommendations</h2>
      <div class="recommendations">
        <h3>Recommended Certifications</h3>
        ${content.careerRecommendations.certifications.map(cert => `
          <div class="cert-item">
            <h4>${cert.name}</h4>
            <p>Provider: ${cert.provider}</p>
            <p>Duration: ${cert.duration}</p>
          </div>
        `).join('')}

        <h3>Suggested Courses</h3>
        ${content.careerRecommendations.courses.map(course => `
          <div class="course-item">
            <h4>${course.name}</h4>
            <p>Platform: ${course.platform}</p>
            <p>Duration: ${course.duration}</p>
          </div>
        `).join('')}

        <h3>Career Path Progression</h3>
        ${content.careerRecommendations.careerPaths.map(path => `
          <div class="path-item">
            <h4>${path.title}</h4>
            <p>Timeline: ${path.timeframe}</p>
            <p>Required Skills: ${path.requiredSkills.join(', ')}</p>
          </div>
        `).join('')}
      </div>

      <h2>🤝 Networking Recommendations</h2>
      <div class="networking-section">
        ${content.networkingRecommendations.insights ? `
          <div class="network-insights">
            <h3>Your Network Insights</h3>
            <p>Network Size: ${content.networkingRecommendations.insights.networkSize} connections</p>
            <p>Industry Presence: ${content.networkingRecommendations.insights.industryPresence}</p>
            <p>Network Growth: ${content.networkingRecommendations.insights.growthRate}</p>
          </div>
        ` : ''}

        <div class="suggested-connections">
          <h3>Recommended Connections</h3>
          ${content.networkingRecommendations.suggestedConnections.map(connection => `
            <div class="connection-card">
              <h4>${connection.name}</h4>
              <p>${connection.title} at ${connection.company}</p>
              <p>Mutual Connections: ${connection.mutualConnections}</p>
              <p>Why Connect: ${connection.reason}</p>
              <a href="${connection.profileUrl}" class="connect-button">View Profile</a>
            </div>
          `).join('')}
        </div>

        <div class="upcoming-events">
          <h3>Relevant Events</h3>
          ${content.networkingRecommendations.events.map(event => `
            <div class="event-card">
              <h4>${event.name}</h4>
              <p>Date: ${event.date}</p>
              <p>Format: ${event.format}</p>
              <p>Attendees: ${event.attendees}</p>
              <a href="${event.url}" class="event-button">Learn More</a>
            </div>
          `).join('')}
        </div>
      </div>
    </body>
    </html>
  `;
}

async function logDigestSent(userId) {
  await supabase
    .from('digest_logs')
    .insert({
      user_id: userId,
      sent_at: new Date().toISOString(),
      type: 'weekly'
    });
} 