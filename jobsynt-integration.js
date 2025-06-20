// Add this JavaScript to your HTML landing page
// jobsynt-integration.js

class JobsyntAPI {
  constructor() {
    this.baseURL = window.location.origin;
    this.cache = new Map();
  }

  // Job Search with AI Matching
  async searchJobs(searchParams) {
    try {
      // Show loading state
      this.showLoadingState();

      // Step 1: Scrape jobs from multiple sources
      const jobs = await this.scrapeJobs(searchParams);
      
      // Step 2: Detect ghost jobs
      const analyzedJobs = await this.analyzeGhostJobs(jobs);
      
      // Step 3: AI matching (if user profile exists)
      const userProfile = this.getUserProfile();
      let rankedJobs = analyzedJobs;
      
      if (userProfile) {
        const matchResult = await this.matchJobs(userProfile, analyzedJobs);
        rankedJobs = matchResult.rankedJobs;
      }

      // Step 4: Filter out high-risk ghost jobs (optional)
      const filteredJobs = this.filterGhostJobs(rankedJobs, searchParams.includeGhostJobs);

      return {
        success: true,
        jobs: filteredJobs,
        totalFound: jobs.length,
        ghostJobsFiltered: rankedJobs.length - filteredJobs.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Job search failed:', error);
      return {
        success: false,
        error: error.message,
        jobs: []
      };
    } finally {
      this.hideLoadingState();
    }
  }

  // Scrape jobs from multiple sources
  async scrapeJobs(params) {
    const cacheKey = `jobs_${JSON.stringify(params)}`;
    
    // Check cache first (5 minute expiry)
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.data;
      }
    }

    const response = await fetch(`${this.baseURL}/.netlify/functions/job-scraper`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error(`Job scraping failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Job scraping failed');
    }
    

    // Cache the results
    this.cache.set(cacheKey, {
      data: result.jobs,
      timestamp: Date.now()
    });

    return result.jobs;
  }

  // Analyze jobs for ghost job indicators
  async analyzeGhostJobs(jobs) {
    const analyzedJobs = [];
    
    // Process jobs in batches to avoid overwhelming the function
    const batchSize = 5;
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      const batchPromises = batch.map(job => this.analyzeJob(job));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        analyzedJobs.push(...batchResults);
      } catch (error) {
        console.warn('Ghost job analysis failed for batch:', error);
        // Add jobs without analysis if API fails
        analyzedJobs.push(...batch.map(job => ({
          ...job,
          ghostScore: 0,
          riskLevel: 'UNKNOWN',
          flags: []
        })));
      }
      
      // Small delay between batches
      if (i + batchSize < jobs.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return analyzedJobs;
  }

  // Analyze single job for ghost indicators
  async analyzeJob(job) {
    try {
      const response = await fetch(`${this.baseURL}/.netlify/functions/ghost-detector`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ job })
      });

      if (!response.ok) {
        throw new Error('Ghost detection failed');
      }

      const result = await response.json();
      return result.success ? result.job : job;
      
    } catch (error) {
      console.warn('Ghost analysis failed for job:', job.title, error);
      return {
        ...job,
        ghostScore: 0,
        riskLevel: 'UNKNOWN',
        flags: []
      };
    }
  }

  // AI-powered job matching
  async matchJobs(userProfile, jobs) {
    try {
      const response = await fetch(`${this.baseURL}/.netlify/functions/ai-matcher`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userProfile,
          jobs
        })
      });

      if (!response.ok) {
        throw new Error('AI matching failed');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'AI matching failed');
      }

      return result;

    } catch (error) {
      console.warn('AI matching failed:', error);
      // Return jobs without matching if AI fails
      return {
        rankedJobs: jobs,
        recommendations: {
          topMatches: [],
          skillsToImprove: [],
          careerAdvice: ['AI matching temporarily unavailable']
        }
      };
    }
  }

  // Filter ghost jobs based on user preference
  filterGhostJobs(jobs, includeGhostJobs = false) {
    if (includeGhostJobs) return jobs;
    
    return jobs.filter(job => {
      // Filter out high-risk ghost jobs
      return !job.isGhost && job.riskLevel !== 'HIGH';
    });
  }

  // Get user profile from localStorage or form
  getUserProfile() {
    try {
      // Try to get from form if available
      const profileForm = document.getElementById('user-profile-form');
      if (profileForm) {
        const formData = new FormData(profileForm);
        return {
          skills: formData.get('skills')?.split(',').map(s => s.trim()) || [],
          experience: parseInt(formData.get('experience')) || 0,
          location: formData.get('location') || '',
          preferRemote: formData.get('remote') === 'true',
          salaryExpectation: parseInt(formData.get('salary')) || 0,
          preferredIndustries: formData.get('industries')?.split(',').map(s => s.trim()) || []
        };
      }

      // Fallback to stored profile (using variables instead of localStorage)
      return window.userProfile || null;
      
    } catch (error) {
      console.warn('Could not load user profile:', error);
      return null;
    }
  }

  // Save user profile
  saveUserProfile(profile) {
    try {
      window.userProfile = profile;
      console.log('User profile saved');
    } catch (error) {
      console.warn('Could not save user profile:', error);
    }
  }

  // UI Helper Methods
  showLoadingState() {
    const searchButton = document.getElementById('search-jobs-button');
    const jobResults = document.getElementById('job-results');
    
    if (searchButton) {
      searchButton.disabled = true;
      searchButton.innerHTML = '<span class="animate-spin">⏳</span> Searching Jobs...';
    }
    
    if (jobResults) {
      jobResults.innerHTML = `
        <div class="text-center py-8">
          <div class="animate-spin text-4xl mb-4">🔍</div>
          <p class="text-lg">Searching hidden job opportunities...</p>
          <p class="text-sm text-gray-600">Analyzing jobs from 500+ sources</p>
        </div>
      `;
    }
  }

  hideLoadingState() {
    const searchButton = document.getElementById('search-jobs-button');
    
    if (searchButton) {
      searchButton.disabled = false;
      searchButton.innerHTML = '🚀 Find Hidden Jobs';
    }
  }

  // Render job results in the UI
  renderJobResults(searchResult) {
    const jobResults = document.getElementById('job-results');
    if (!jobResults) return;

    if (!searchResult.success || searchResult.jobs.length === 0) {
      jobResults.innerHTML = `
        <div class="text-center py-8">
          <div class="text-4xl mb-4">😞</div>
          <p class="text-lg">No jobs found matching your criteria</p>
          <p class="text-sm text-gray-600">Try adjusting your search terms</p>
        </div>
      `;
      return;
    }

    const { jobs, totalFound, ghostJobsFiltered } = searchResult;

    jobResults.innerHTML = `
      <div class="mb-6">
        <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <strong>Found ${jobs.length} jobs</strong> from ${totalFound} total sources
          ${ghostJobsFiltered > 0 ? `<br><small>🛡️ Filtered out ${ghostJobsFiltered} potential ghost jobs</small>` : ''}
        </div>
        <div class="grid gap-6">
          ${jobs.map(job => this.renderJobCard(job)).join('')}
        </div>
      </div>
    `;
  }

  // Render individual job card
  renderJobCard(job) {
    const matchBadge = job.matchScore ? 
      `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${this.getMatchColor(job.matchScore)}-100 text-${this.getMatchColor(job.matchScore)}-800">
        ${job.matchScore}% Match
      </span>` : '';

    const ghostBadge = job.riskLevel ? 
      `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${this.getRiskColor(job.riskLevel)}-100 text-${this.getRiskColor(job.riskLevel)}-800">
        ${job.riskLevel} Risk
      </span>` : '';

    const remoteBadge = job.remote ? 
      '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">🏠 Remote</span>' : '';

    return `
      <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">${job.title}</h3>
            <p class="text-lg text-gray-700 mb-1">${job.company}</p>
            <p class="text-sm text-gray-600">${job.location} • ${job.posted}</p>
          </div>
          <div class="flex flex-col gap-2">
            ${matchBadge}
            ${ghostBadge}
            ${remoteBadge}
          </div>
        </div>
        
        <div class="mb-4">
          <p class="text-gray-700"><strong>Salary:</strong> ${job.salary || 'Not specified'}</p>
          <p class="text-gray-700"><strong>Type:</strong> ${job.type || 'Full-time'}</p>
          <p class="text-gray-700"><strong>Source:</strong> ${job.source}</p>
        </div>

        ${job.matchReasons && job.matchReasons.length > 0 ? `
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-900 mb-2">Why this matches you:</p>
            <ul class="text-sm text-gray-600 list-disc list-inside">
              ${job.matchReasons.map(reason => `<li>${reason}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${job.applicationAdvice && job.applicationAdvice.length > 0 ? `
          <div class="mb-4">
            <p class="text-sm font-medium text-gray-900 mb-2">Application advice:</p>
            <ul class="text-sm text-blue-600 list-disc list-inside">
              ${job.applicationAdvice.map(advice => `<li>${advice}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="flex gap-3">
          <a href="${job.link}" target="_blank" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-center hover:bg-blue-700 transition-colors">
            View Job →
          </a>
          <button onclick="jobsyntAPI.saveJob('${job.title}', '${job.company}')" class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            💾 Save
          </button>
        </div>
      </div>
    `;
  }

  // Helper methods for styling
  getMatchColor(score) {
    if (score >= 80) return 'green';
    if (score >= 65) return 'blue';
    if (score >= 50) return 'yellow';
    return 'red';
  }

  getRiskColor(riskLevel) {
    switch (riskLevel) {
      case 'HIGH': return 'red';
      case 'MEDIUM': return 'yellow';
      case 'LOW': return 'blue';
      default: return 'gray';
    }
  }

  // Save job for later
  saveJob(title, company) {
    const savedJobs = window.savedJobs || [];
    const job = { title, company, savedAt: new Date().toISOString() };
    
    if (!savedJobs.find(j => j.title === title && j.company === company)) {
      savedJobs.push(job);
      window.savedJobs = savedJobs;
      alert(`Saved: ${title} at ${company}`);
    } else {
      alert('Job already saved!');
    }
  }
}

// Initialize the API
const jobsyntAPI = new JobsyntAPI();

// Main search function
async function searchJobs() {
  const form = document.getElementById('job-search-form');
  const formData = new FormData(form);
  
  const searchParams = {
    keywords: formData.get('keywords') || 'software engineer',
    location: formData.get('location') || '',
    remote: formData.get('remote') === 'true',
    category: formData.get('category') || 'tech',
    includeGhostJobs: formData.get('include-ghost') === 'true'
  };

  const result = await jobsyntAPI.searchJobs(searchParams);
  jobsyntAPI.renderJobResults(result);
}

// User profile setup
function setupUserProfile() {
  const modal = document.getElementById('profile-modal');
  if (modal) {
    modal.style.display = 'block';
  }
}

function saveUserProfile() {
  const form = document.getElementById('user-profile-form');
  const formData = new FormData(form);
  
  const profile = {
    skills: formData.get('skills')?.split(',').map(s => s.trim()) || [],
    experience: parseInt(formData.get('experience')) || 0,
    location: formData.get('location') || '',
    preferRemote: formData.get('remote') === 'true',
    salaryExpectation: parseInt(formData.get('salary')) || 0,
    preferredIndustries: formData.get('industries')?.split(',').map(s => s.trim()) || []
  };
  
  jobsyntAPI.saveUserProfile(profile);
  
  const modal = document.getElementById('profile-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  
  alert('Profile saved! Your job matches will now be personalized.');
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
  // Search form submission
  const searchForm = document.getElementById('job-search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', function(e) {
      e.preventDefault();
      searchJobs();
    });
  }

  // Profile form submission
  const profileForm = document.getElementById('user-profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', function(e) {
      e.preventDefault();
      saveUserProfile();
    });
  }
});

// Export for global access
window.jobsyntAPI = jobsyntAPI;
window.searchJobs = searchJobs;
window.setupUserProfile = setupUserProfile;
window.saveUserProfile = saveUserProfile;