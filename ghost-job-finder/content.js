// Content script to detect and flag ghost jobs on job boards
(function() {
  'use strict';

  // Configuration
  const API_URL = 'https://jobsyntai.netlify.app/.netlify/functions/ghost-detector';
  const USER_SKILLS = ['JavaScript', 'React', 'Node.js']; // Replace with actual user skills
  const SHOW_ALL_JOBS = false; // Set based on user preference

  // Enhanced styles for warning badges
  const STYLES = `
    .ghost-job-warning {
      padding: 12px;
      margin: 12px 0;
      border-radius: 6px;
      font-size: 14px;
      border-left: 4px solid;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    }
    .ghost-job-high {
      border-color: #ff4d4d;
      background: rgba(255, 77, 77, 0.08);
    }
    .ghost-job-medium {
      border-color: #ffb84d;
      background: rgba(255, 184, 77, 0.08);
    }
    .ghost-job-low {
      border-color: #00cc66;
      background: rgba(0, 204, 102, 0.08);
    }
    .ghost-job-flags {
      font-size: 12px;
      color: #666;
      margin-top: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .ghost-job-flag {
      background: rgba(0, 0, 0, 0.05);
      padding: 2px 6px;
      border-radius: 4px;
    }
  `;

  // Inject styles
  const styleTag = document.createElement('style');
  styleTag.textContent = STYLES;
  document.head.appendChild(styleTag);

  // Main analysis function
  async function analyzeJob(jobElement) {
    try {
      const jobData = extractJobData(jobElement);
      const analysis = await performGhostAnalysis(jobData);
      
      if (analysis.isGhost || analysis.riskScore > 0.3 || SHOW_ALL_JOBS) {
        renderWarningBadge(jobElement, analysis);
      }

      // Add detailed analysis to job element
      addJobInsights(jobElement, analysis);
    } catch (error) {
      console.error('Ghost job detection failed:', error);
    }
  }

  // Enhanced job data extraction
  function extractJobData(jobElement) {
    const data = {
      title: jobElement.querySelector('.job-title, [data-job-title]')?.innerText?.trim() || 'Unknown',
      company: jobElement.querySelector('.company-name, [data-company]')?.innerText?.trim() || 'Unknown',
      description: jobElement.querySelector('.job-description, [data-description]')?.innerText?.trim() || '',
      posted: jobElement.querySelector('.posting-date, [data-posted-date]')?.innerText?.trim() || null,
      salary: jobElement.querySelector('.salary, [data-salary]')?.innerText?.trim() || 'Not specified',
      location: jobElement.querySelector('.location, [data-location]')?.innerText?.trim() || null,
      applicationUrl: jobElement.querySelector('a[href*="apply"], a[href*="job"]')?.href || null,
      companyUrl: jobElement.querySelector('a[href*="company"], a[href*="employer"]')?.href || null,
      requirements: Array.from(jobElement.querySelectorAll('.requirements li, [data-requirements] li')).map(li => li.innerText.trim()),
      benefits: Array.from(jobElement.querySelectorAll('.benefits li, [data-benefits] li')).map(li => li.innerText.trim()),
      contactInfo: jobElement.querySelector('.contact-info, [data-contact]')?.innerText?.trim() || null
    };

    // Extract application deadline if available
    const deadlineElement = jobElement.querySelector('.deadline, [data-deadline]');
    if (deadlineElement) {
      data.deadline = deadlineElement.innerText.trim();
    }

    return data;
  }

  // Enhanced ghost analysis
  async function performGhostAnalysis(jobData) {
    const analysis = {
      isGhost: false,
      riskScore: 0,
      riskFactors: [],
      verificationSteps: [],
      candidateAdvice: []
    };

    // Check posting age
    if (jobData.posted) {
      const postAge = calculatePostAge(jobData.posted);
      if (postAge > 60) {
        analysis.riskScore += 0.2;
        analysis.riskFactors.push('Job posted over 60 days ago');
        analysis.verificationSteps.push('Verify if position is still open');
      }
    }

    // Verify company existence
    if (jobData.company !== 'Unknown') {
      const companyVerification = await verifyCompanyExistence(jobData.company);
      if (!companyVerification.exists) {
        analysis.riskScore += 0.4;
        analysis.riskFactors.push('Company verification failed');
        analysis.verificationSteps.push('Research company background thoroughly');
      }
    }

    // Check for suspicious patterns
    const suspiciousPatterns = detectSuspiciousPatterns(jobData);
    if (suspiciousPatterns.length > 0) {
      analysis.riskScore += 0.3;
      analysis.riskFactors.push(...suspiciousPatterns);
    }

    // Analyze contact information
    if (!jobData.contactInfo && !jobData.applicationUrl) {
      analysis.riskScore += 0.3;
      analysis.riskFactors.push('No clear application method or contact information');
      analysis.verificationSteps.push('Request official contact information');
    }

    // Check salary information
    if (!jobData.salary || jobData.salary === 'Not specified') {
      analysis.riskScore += 0.1;
      analysis.candidateAdvice.push('Request salary range before proceeding');
    }

    // Analyze requirements clarity
    if (!jobData.requirements || jobData.requirements.length === 0) {
      analysis.riskScore += 0.2;
      analysis.riskFactors.push('No clear job requirements specified');
    }

    // Set ghost status based on risk score
    analysis.isGhost = analysis.riskScore >= 0.5;

    // Add candidate protection advice
    analysis.candidateAdvice.push(
      ...generateCandidateAdvice(jobData, analysis.riskScore)
    );

    return analysis;
  }

  function detectSuspiciousPatterns(jobData) {
    const patterns = [];
    const description = jobData.description.toLowerCase();
    const title = jobData.title.toLowerCase();

    // Check for common scam indicators
    if (description.includes('immediate start') && description.includes('urgent')) {
      patterns.push('Suspicious urgency in job posting');
    }

    if (description.includes('work from home') && description.includes('unlimited earning')) {
      patterns.push('Potential MLM or scam scheme');
    }

    // Check for unrealistic promises
    if (description.includes('guaranteed') && 
        (description.includes('income') || description.includes('earnings'))) {
      patterns.push('Unrealistic income promises');
    }

    // Check for vague job descriptions
    if (description.length < 100) {
      patterns.push('Suspiciously short job description');
    }

    // Check for excessive requirements with entry-level title
    if (title.includes('entry') || title.includes('junior')) {
      const yearsExp = description.match(/\d+\+?\s*years?\s*experience/g);
      if (yearsExp && yearsExp.some(exp => parseInt(exp) > 3)) {
        patterns.push('Mismatched experience requirements');
      }
    }

    return patterns;
  }

  function generateCandidateAdvice(jobData, riskScore) {
    const advice = [];

    if (riskScore > 0.3) {
      advice.push('Research company thoroughly before applying');
      advice.push('Do not provide sensitive personal information early in the process');
    }

    if (!jobData.companyUrl) {
      advice.push('Verify company\'s official web presence');
    }

    if (!jobData.salary || jobData.salary === 'Not specified') {
      advice.push('Request clear compensation details before proceeding');
    }

    if (jobData.remote) {
      advice.push('Verify remote work policies and requirements');
    }

    return advice;
  }

  function addJobInsights(jobElement, analysis) {
    const insightsContainer = document.createElement('div');
    insightsContainer.className = 'job-insights';
    
    if (analysis.isGhost) {
      insightsContainer.innerHTML = `
        <div class="ghost-warning">
          <h4>⚠️ Exercise Caution</h4>
          <ul>
            ${analysis.riskFactors.map(factor => `<li>${factor}</li>`).join('')}
          </ul>
          <div class="verification-steps">
            <h5>Recommended Steps:</h5>
            <ul>
              ${analysis.verificationSteps.map(step => `<li>${step}</li>`).join('')}
            </ul>
          </div>
          <div class="candidate-advice">
            <h5>Protect Yourself:</h5>
            <ul>
              ${analysis.candidateAdvice.map(advice => `<li>${advice}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    } else if (analysis.riskScore > 0.3) {
      insightsContainer.innerHTML = `
        <div class="caution-notice">
          <h4>ℹ️ Verification Recommended</h4>
          <ul>
            ${analysis.candidateAdvice.map(advice => `<li>${advice}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    jobElement.appendChild(insightsContainer);
  }

  // Enhanced warning badge rendering
  function renderWarningBadge(jobElement, job) {
    const warningDiv = document.createElement('div');
    warningDiv.className = `ghost-job-warning ghost-job-${getRiskClass(job.ghostScore)}`;
    
    let html = `
      <strong>${job.recommendation.short}</strong>
      <div>Ghost Score: ${job.ghostScore}% (${job.riskLevel} risk)</div>
    `;
    
    if (job.flags?.length > 0) {
      html += `<div class="ghost-job-flags">
        ${job.flags.map(flag => `<span class="ghost-job-flag">${flag}</span>`).join('')}
      </div>`;
    }
    
    warningDiv.innerHTML = html;
    
    // Smart positioning - tries common job card locations
    const insertPoints = [
      jobElement.querySelector('.job-header'),
      jobElement.querySelector('.job-title')?.parentElement,
      jobElement.querySelector('.apply-button')?.previousElementSibling,
      jobElement
    ].filter(Boolean);
    
    (insertPoints[0] || jobElement).insertAdjacentElement('afterend', warningDiv);
  }

  // Risk classification (updated thresholds)
  function getRiskClass(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  // Page scanning with mutation observer
  function scanPage() {
    const jobListings = document.querySelectorAll(`
      .job-listing, [data-job-id],
      .job-card, .job-search-result,
      [data-entity-urn^="urn:li:jobPosting"]
    `);
    
    jobListings.forEach(job => {
      if (!job.dataset.ghostChecked) {
        job.dataset.ghostChecked = 'true';
        analyzeJob(job);
      }
    });
  }

  // Initial scan and continuous monitoring
  scanPage();
  const observer = new MutationObserver(scanPage);
  observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: false,
    characterData: false
  });

  // Re-scan when user scrolls (for infinite scroll pages)
  window.addEventListener('scroll', () => {
    if (!window.ghostJobScanPending) {
      window.ghostJobScanPending = true;
      setTimeout(() => {
        scanPage();
        window.ghostJobScanPending = false;
      }, 500);
    }
  });

  // Extract job data from the page (example for LinkedIn, can be extended)
  function extractJobData() {
    let jobTitle = document.querySelector('h1')?.innerText || '';
    let company = document.querySelector('.topcard__org-name-link, .topcard__flavor')?.innerText || '';
    let location = document.querySelector('.topcard__flavor--bullet')?.innerText || '';
    let description = document.querySelector('.description__text, .show-more-less-html__markup')?.innerText || '';
    let url = window.location.href;
    return { jobTitle, company, location, description, url };
  }

  // Send job data to background for ghost job detection
  function sendJobDataToBackground() {
    const jobData = extractJobData();
    chrome.runtime.sendMessage({ type: 'ANALYZE_JOB', jobData });
  }

  // Listen for page load or navigation
  window.addEventListener('load', sendJobDataToBackground);
  window.addEventListener('popstate', sendJobDataToBackground);

  // Optionally, listen for messages from background to display results
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GHOST_JOB_RESULT') {
      // Display result (e.g., banner or popup)
      alert(`Ghost Job Detection: ${message.result.isGhost ? 'Potential Ghost Job' : 'Legitimate Job'}\nConfidence: ${message.result.confidence}%`);
    }
  });

})();