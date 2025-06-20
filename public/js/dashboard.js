// Dashboard Controller
let dashboardInitialized = false;
window.dashboardInitialized = false; // Expose to window
let authChecked = false;

async function waitForSupabase() {
    if (window.supabase) return;
    
    await new Promise(resolve => {
        const checkSupabase = setInterval(() => {
            if (window.supabase) {
                clearInterval(checkSupabase);
                resolve();
            }
        }, 100);
    });
}

async function checkAuth() {
    if (authChecked) {
        console.log('[Dashboard] Auth already checked, skipping');
        return true;
    }
    
    console.log('[Dashboard] Checking auth...');
    
    // Wait for Supabase to be initialized
    if (!window.supabase) {
        console.log('[Dashboard] Waiting for Supabase to initialize...');
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!window.supabase) {
            throw new Error('Supabase not initialized');
        }
    }
    
    const { data: { session }, error } = await window.supabase.auth.getSession();
    console.log('[Dashboard] Auth check complete', { session, error });
    
    if (error || !session) {
        console.log('[Dashboard] No valid session');
        return false;
    }
    
    authChecked = true;
    console.log('[Dashboard] Auth check passed');
    return true;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Dashboard] DOM loaded, initializing...');
    
    // Prevent double initialization
    if (dashboardInitialized) {
        console.log('[Dashboard] Already initialized, skipping');
        return;
    }
    
    try {
        // First check auth
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            console.log('[Dashboard] Auth check failed, redirecting to index');
            window.location.replace('/');
            return;
        }
        
        // Then initialize the rest of your dashboard
        console.log('[Dashboard] Starting dashboard initialization');
        await loadProfileData();
        await loadJobApplications();
        await loadNetworkingContacts();
        
        // Set up event listeners
        setupEventListeners();
        
        dashboardInitialized = true;
        window.dashboardInitialized = true; // Update window variable
        console.log('[Dashboard] Initialized successfully');
    } catch (error) {
        console.error('[Dashboard] Initialization error:', error);
        // Don't redirect on every error, only on auth failures
        if (error.message && error.message.includes('auth')) {
            window.location.replace('/');
        }
    }
});

// Initialize profile
async function initializeProfile(user) {
    try {
        const { data: profile, error } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) throw error;

        if (profile) {
            // Populate profile form
            document.getElementById('positionInput').value = profile.position || '';
            document.getElementById('unemployedSinceInput').value = profile.unemployed_since || '';
            document.getElementById('experienceInput').value = profile.experience || '';
            document.getElementById('skillsInput').value = profile.skills || '';
            document.getElementById('educationInput').value = profile.education || '';
        }
    } catch (error) {
        console.error('Profile load error:', error);
    }
}

// Load applications
async function loadApplications(userId) {
    try {
        const { data: applications, error } = await window.supabase
            .from('job_applications')
            .select(`
                *,
                job_listings (
                    title,
                    company,
                    location
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Update UI with applications
        const applicationsList = document.getElementById('applicationsList');
        if (applicationsList) {
            applicationsList.innerHTML = applications.map(app => `
                <div class="application-item">
                    <h4>${app.job_listings.title}</h4>
                    <p>${app.job_listings.company} - ${app.job_listings.location}</p>
                    <p>Status: ${app.status}</p>
                    <p>Applied: ${new Date(app.created_at).toLocaleDateString()}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Applications load error:', error);
    }
}

// Initialize forms
function initializeForms() {
    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileSubmit);
    }

    // Job search form
    const jobSearchForm = document.getElementById('jobSearchForm');
    if (jobSearchForm) {
        jobSearchForm.addEventListener('submit', handleJobSearch);
    }

    // Job analysis form
    const jobAnalysisForm = document.getElementById('jobAnalysisForm');
    if (jobAnalysisForm) {
        jobAnalysisForm.addEventListener('submit', handleJobAnalysis);
    }

    // Cover letter form
    const coverLetterForm = document.getElementById('coverLetterForm');
    if (coverLetterForm) {
        coverLetterForm.addEventListener('submit', handleCoverLetter);
    }
}

// Form handlers
async function handleProfileSubmit(e) {
    e.preventDefault();
    try {
        const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const { error } = await window.supabase
            .from('profiles')
            .upsert({
                user_id: session.user.id,
                position: document.getElementById('positionInput').value,
                unemployed_since: document.getElementById('unemployedSinceInput').value,
                experience: document.getElementById('experienceInput').value,
                skills: document.getElementById('skillsInput').value,
                education: document.getElementById('educationInput').value,
                updated_at: new Date()
            });

        if (error) throw error;
        alert('Profile updated successfully!');
    } catch (error) {
        console.error('Profile update error:', error);
        alert('Error updating profile. Please try again.');
    }
}

// Job Analysis Form Handler
async function handleJobAnalysis(e) {
    e.preventDefault();
    
    try {
        const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) throw new Error('Please log in to analyze jobs');

        const jobUrl = document.getElementById('jobUrlAnalysis').value;
        const jobDescription = document.getElementById('jobDescriptionPreview').value;

        if (!jobUrl && !jobDescription) {
            throw new Error('Please provide either a job URL or job description');
        }

        // Show loading state
        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.innerHTML = '<span class="loading"></span> Analyzing...';
        submitButton.disabled = true;

        // Get user profile and resume for analysis
        const { data: profile } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

        const { data: resume } = await window.supabase
            .from('resumes')
            .select('*')
            .eq('user_id', session.user.id)
            .order('uploaded_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // Analyze the job
        const analysisResult = await analyzeJobForUser(jobUrl, jobDescription, profile, resume);
        
        // Display results
        displayJobAnalysisResults(analysisResult);
        
        // Restore button
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;

    } catch (error) {
        console.error('Job analysis error:', error);
        
        // Restore button
        const submitButton = e.target.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.innerHTML = 'Analyze';
            submitButton.disabled = false;
        }
        
        alert(`Job analysis failed: ${error.message}`);
    }
}

async function analyzeJobForUser(jobUrl, jobDescription, profile, resume) {
    try {
        let jobData = {};
        
        // If URL is provided, try to extract job data
        if (jobUrl) {
            try {
                // Call ghost detector first
                const ghostResponse = await fetch('/.netlify/functions/ghost-detector', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jobUrl: jobUrl,
                        jobDescription: jobDescription
                    })
                });
                
                if (ghostResponse.ok) {
                    const ghostResult = await ghostResponse.json();
                    jobData.ghostDetection = ghostResult;
                }
            } catch (error) {
                console.warn('Ghost detection failed:', error);
                jobData.ghostDetection = { error: 'Ghost detection unavailable' };
            }
        }
        
        // Analyze job match with user profile
        if (profile || resume) {
            const userProfile = {
                skills: profile?.skills ? profile.skills.split(',').map(s => s.trim()) : [],
                experience_level: profile?.experience_level || 'entry',
                current_title: profile?.current_title || '',
                visa_status: profile?.visa_status || '',
                salary_range: {
                    min: profile?.salary_range_from || 0,
                    max: profile?.salary_range_to || 0
                },
                location: profile?.city && profile?.state ? `${profile.city}, ${profile.state}` : '',
                job_types: profile?.job_types || [],
                work_modes: profile?.work_modes || []
            };
            
            const job = {
                title: extractJobTitle(jobDescription || jobUrl),
                description: jobDescription || '',
                url: jobUrl || '',
                company: extractCompany(jobDescription || jobUrl),
                location: extractLocation(jobDescription || jobUrl),
                salary: extractSalary(jobDescription || '')
            };
            
            try {
                const matchResponse = await fetch('/.netlify/functions/ai-matcher', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userProfile: userProfile,
                        jobs: [job]
                    })
                });
                
                if (matchResponse.ok) {
                    const matchResult = await matchResponse.json();
                    jobData.matchAnalysis = matchResult.rankedJobs?.[0] || {};
                    jobData.recommendations = matchResult.recommendations || {};
                }
            } catch (error) {
                console.warn('AI matching failed:', error);
                jobData.matchAnalysis = { error: 'AI matching unavailable' };
            }
        }
        
        return {
            success: true,
            jobUrl,
            jobDescription,
            profile,
            resume: resume ? { fileName: resume.file_name, uploadDate: resume.uploaded_at } : null,
            ...jobData
        };
        
    } catch (error) {
        console.error('Error analyzing job:', error);
        throw new Error(`Analysis failed: ${error.message}`);
    }
}

function displayJobAnalysisResults(result) {
    const resultsContainer = document.querySelector('.analysis-results');
    if (!resultsContainer) return;
    
    let html = '<div class="job-analysis-results">';
    
    // Ghost Job Detection Results
    if (result.ghostDetection) {
        if (result.ghostDetection.error) {
            html += `
                <div class="alert alert-warning">
                    <h4><i class="fas fa-exclamation-triangle"></i> Ghost Job Detection</h4>
                    <p>Unable to analyze for ghost job indicators: ${result.ghostDetection.error}</p>
                </div>
            `;
        } else if (result.ghostDetection.success) {
            const riskLevel = result.ghostDetection.riskLevel || 'Unknown';
            const riskClass = riskLevel.toLowerCase();
            
            html += `
                <div class="card ${riskClass}-risk">
                    <div class="card-header">
                        <h4><i class="fas fa-ghost"></i> Ghost Job Analysis</h4>
                    </div>
                    <div class="ghost-score ${riskClass}">
                        Risk Level: ${riskLevel} (${result.ghostDetection.riskScore || 0}%)
                    </div>
                    ${result.ghostDetection.redFlags?.length > 0 ? `
                        <div class="red-flags">
                            <h5>🚩 Red Flags:</h5>
                            <ul>
                                ${result.ghostDetection.redFlags.map(flag => `<li>${flag}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    ${result.ghostDetection.recommendations?.length > 0 ? `
                        <div class="recommendations">
                            <h5>💡 Recommendations:</h5>
                            <ul>
                                ${result.ghostDetection.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    }
    
    // Match Analysis Results
    if (result.matchAnalysis) {
        if (result.matchAnalysis.error) {
            html += `
                <div class="alert alert-warning">
                    <h4><i class="fas fa-chart-line"></i> Profile Match Analysis</h4>
                    <p>Unable to analyze job match: ${result.matchAnalysis.error}</p>
                </div>
            `;
        } else if (result.matchAnalysis.matchScore !== undefined) {
            const matchScore = result.matchAnalysis.matchScore;
            const matchLevel = result.matchAnalysis.matchLevel || 'Unknown';
            
            html += `
                <div class="card">
                    <div class="card-header">
                        <h4><i class="fas fa-chart-line"></i> Profile Match Analysis</h4>
                    </div>
                    <div class="match-score">
                        <div class="score-display ${getScoreClass(matchScore)}">
                            Match Score: ${matchScore}% (${matchLevel})
                        </div>
                    </div>
                    ${result.matchAnalysis.matchReasons?.length > 0 ? `
                        <div class="match-reasons">
                            <h5>✅ Why this job matches you:</h5>
                            <ul>
                                ${result.matchAnalysis.matchReasons.map(reason => `<li>${reason}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    ${result.matchAnalysis.applicationAdvice?.length > 0 ? `
                        <div class="application-advice">
                            <h5>📋 Application Advice:</h5>
                            <ul>
                                ${result.matchAnalysis.applicationAdvice.map(advice => `<li>${advice}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    }
    
    // Profile and Resume Status
    html += `
        <div class="card">
            <div class="card-header">
                <h4><i class="fas fa-user"></i> Analysis Based On</h4>
            </div>
            <div class="analysis-basis">
                <p><strong>Profile:</strong> ${result.profile ? '✅ Complete' : '❌ Missing - complete your profile for better analysis'}</p>
                <p><strong>Resume:</strong> ${result.resume ? `✅ ${result.resume.fileName} (uploaded ${new Date(result.resume.uploadDate).toLocaleDateString()})` : '❌ Missing - upload your resume for detailed analysis'}</p>
            </div>
        </div>
    `;
    
    html += '</div>';
    
    resultsContainer.innerHTML = html;
    resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

function getScoreClass(score) {
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-medium';
    return 'score-low';
}

// Helper functions for job data extraction
function extractJobTitle(text) {
    // Simple extraction - in real implementation, you'd use more sophisticated parsing
    const lines = text.split('\n');
    return lines[0] || 'Unknown Position';
}

function extractCompany(text) {
    // Simple extraction - look for common patterns
    const companyMatch = text.match(/company:\s*([^\n]+)/i) || text.match(/at\s+([A-Za-z\s&,]+)/i);
    return companyMatch ? companyMatch[1].trim() : 'Unknown Company';
}

function extractLocation(text) {
    // Look for location patterns
    const locationMatch = text.match(/location:\s*([^\n]+)/i) || text.match(/([A-Za-z\s,]+,\s*[A-Z]{2})/);
    return locationMatch ? locationMatch[1].trim() : 'Unknown Location';
}

function extractSalary(text) {
    // Look for salary patterns
    const salaryMatch = text.match(/\$[\d,]+(?:\s*-\s*\$[\d,]+)?/);
    return salaryMatch ? salaryMatch[0] : null;
}

// Add other form handlers as needed...

// UI Helpers
function showAlert(type, message) {
    const alertContainer = document.getElementById('alertContainer') || createAlertContainer();
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="button-close" data-dismiss="alert">&times;</button>
    `;
    alertContainer.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
}

function createAlertContainer() {
    const container = document.createElement('div');
    container.id = 'alertContainer';
    container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; width: 300px;';
    document.body.appendChild(container);
    return container;
}

// Navigation
function showSection(sectionId) {
    console.log('[Dashboard.js] Showing section:', sectionId);
    
    // Update active states for navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-section') === sectionId) {
            link.classList.add('active');
        }
    });
    
    // Update active states for content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
        if (section.id === sectionId) {
            section.classList.add('active');
            console.log('[Dashboard.js] Section activated:', sectionId);
        }
    });
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('collapsed');
}

// Event Listeners Setup (Forms only - navigation handled in HTML)
function setupEventListeners() {
    console.log('[Dashboard.js] Setting up form event listeners...');

    // Sidebar toggle
    document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);

    // Profile form
    document.getElementById('profileForm')?.addEventListener('submit', handleProfileSubmit);

    // Resume upload
    document.getElementById('resumeForm')?.addEventListener('submit', handleResumeUpload);

    // Job search
    document.getElementById('jobSearchForm')?.addEventListener('submit', handleJobSearch);

    // Application form
    document.getElementById('applicationForm')?.addEventListener('submit', handleApplicationSubmit);
}

// Form Handlers
async function handleResumeUpload(e) {
    e.preventDefault();
    try {
        const { data: { user } } = await window.supabase.auth.getUser();
        const fileInput = e.target.querySelector('input[type="file"]');
        
        if (!fileInput.files.length) {
            throw new Error('No file selected');
        }

        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `resumes/${fileName}`;

        const { error: uploadError } = await window.supabase.storage
            .from('resumes')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { error: updateError } = await window.supabase
            .from('profiles')
            .update({ resume_url: filePath })
            .eq('id', user.id);

        if (updateError) throw updateError;

        showAlert('success', 'Resume uploaded successfully!');
        fileInput.value = ''; // Reset file input
    } catch (error) {
        console.error('Resume upload error:', error);
        showAlert('danger', 'Failed to upload resume');
    }
}

async function handleJobSearch(e) {
    e.preventDefault();
    try {
        const formData = new FormData(e.target);
        const searchParams = Object.fromEntries(formData.entries());

        const { data: jobs, error } = await window.supabase
            .from('job_listings')
            .select('*')
            .ilike('title', `%${searchParams.keywords}%`)
            .ilike('location', `%${searchParams.location}%`);

        if (error) throw error;

        displayJobResults(jobs);
    } catch (error) {
        console.error('Job search error:', error);
        showAlert('danger', 'Failed to search jobs');
    }
}

function displayJobResults(jobs) {
    const resultsContainer = document.getElementById('jobResults');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = jobs.length ? '' : '<p>No jobs found matching your criteria</p>';

    jobs.forEach(job => {
        const jobCard = document.createElement('div');
        jobCard.className = 'job-card';
        jobCard.innerHTML = `
            <h3>${job.title}</h3>
            <p class="company">${job.company}</p>
            <p class="location">${job.location}</p>
            <p class="description">${job.description.substring(0, 150)}...</p>
            <button class="button button-primary apply-btn" data-job-id="${job.id}">Apply Now</button>
        `;
        resultsContainer.appendChild(jobCard);
    });

    // Add event listeners to dynamically created buttons
    document.querySelectorAll('.apply-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            applyForJob(e.target.dataset.jobId);
        });
    });
}

async function handleApplicationSubmit(e) {
    e.preventDefault();
    try {
        const { data: { user } } = await window.supabase.auth.getUser();
        const formData = new FormData(e.target);

        const applicationData = {
            user_id: user.id,
            job_id: formData.get('jobId'),
            cover_letter: formData.get('coverLetter'),
            status: 'pending'
        };

        const { error } = await window.supabase
            .from('job_applications')
            .insert(applicationData);

        if (error) throw error;

        showAlert('success', 'Application submitted successfully!');
        e.target.reset();
        loadJobApplications();
    } catch (error) {
        console.error('Application error:', error);
        showAlert('danger', 'Failed to submit application');
    }
}

// Data Loading Functions
async function loadJobApplications() {
    try {
        const { data: { user } } = await window.supabase.auth.getUser();
        const { data: applications, error } = await window.supabase
            .from('job_applications')
            .select(`
                *,
                job_listings (
                    title,
                    company,
                    location
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        displayApplications(applications);
    } catch (error) {
        console.error('Applications load error:', error);
        showAlert('danger', 'Failed to load applications');
    }
}

function displayApplications(applications) {
    const applicationsList = document.getElementById('applicationsList');
    if (!applicationsList) return;

    applicationsList.innerHTML = applications.length ? '' : '<p>No applications found</p>';

    applications.forEach(app => {
        const appCard = document.createElement('div');
        appCard.className = 'application-card';
        appCard.innerHTML = `
            <h3>${app.job_listings?.title || 'Unknown Position'}</h3>
            <p class="company">${app.job_listings?.company || ''}</p>
            <p class="status">Status: <span class="status-badge">${app.status}</span></p>
            <p class="date">Applied: ${new Date(app.created_at).toLocaleDateString()}</p>
        `;
        applicationsList.appendChild(appCard);
    });
}

async function loadNetworkingContacts() {
    try {
        const { data: { user } } = await window.supabase.auth.getUser();
        const { data: contacts, error } = await window.supabase
            .from('networking_contacts')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        displayContacts(contacts);
    } catch (error) {
        console.error('Contacts load error:', error);
        showAlert('danger', 'Failed to load contacts');
    }
}

function displayContacts(contacts) {
    const contactsList = document.getElementById('contactsList');
    if (!contactsList) return;

    contactsList.innerHTML = contacts.length ? '' : '<p>No contacts found</p>';

    contacts.forEach(contact => {
        const contactCard = document.createElement('div');
        contactCard.className = 'contact-card';
        contactCard.innerHTML = `
            <h3>${contact.name}</h3>
            <p class="position">${contact.position || 'Not specified'}</p>
            <p class="company">${contact.company || ''}</p>
            ${contact.linkedin_url ? 
                `<a href="${contact.linkedin_url}" target="_blank" class="button button-primary">LinkedIn</a>` : 
                '<p class="no-link">No LinkedIn provided</p>'}
        `;
        contactsList.appendChild(contactCard);
    });
}

// Application Function
async function applyForJob(jobId) {
    try {
        const { data: { user } } = await window.supabase.auth.getUser();
        
        const { error } = await window.supabase
            .from('job_applications')
            .insert({
                user_id: user.id,
                job_id: jobId,
                status: 'pending'
            });

        if (error) throw error;

        showAlert('success', 'Application submitted successfully!');
        loadJobApplications();
    } catch (error) {
        console.error('Apply job error:', error);
        showAlert('danger', 'Failed to apply for job');
    }
}

// Make essential functions available globally
window.showSection = showSection;
window.toggleSidebar = toggleSidebar;
window.applyForJob = applyForJob;

// Load profile data
async function loadProfileData() {
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

        if (error) {
            if (error.code === 'PGRST116') {
                // Profile doesn't exist, create default
                return await createDefaultProfile(session.user.id);
            }
            throw error;
        }

        if (data) {
            // Update profile form fields
            document.getElementById('fullName').value = data.full_name || '';
            document.getElementById('email').value = data.email || '';
            document.getElementById('phone').value = data.phone || '';
            document.getElementById('location').value = data.location || '';
            document.getElementById('profilePosition').value = data.position || '';
            document.getElementById('profileUnemployedSince').value = data.unemployed_since || '';
            document.getElementById('experience').value = data.experience || '';
            document.getElementById('education').value = data.education || '';
            document.getElementById('skills').value = data.skills || '';
            document.getElementById('bio').value = data.bio || '';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Create default profile
async function createDefaultProfile(userId) {
    try {
        const defaultProfile = {
            user_id: userId,
            full_name: '',
            email: '',
            phone: '',
            location: '',
            position: '',
            unemployed_since: '',
            experience: '',
            education: '',
            skills: '',
            bio: ''
        };

        const { data, error } = await window.supabase
            .from('profiles')
            .insert([defaultProfile])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error creating default profile:', error);
        return null;
    }
}

// Load job applications
async function loadJobApplications() {
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await window.supabase
            .from('job_applications')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        const applicationsList = document.getElementById('applicationsList');
        if (applicationsList) {
            applicationsList.innerHTML = data.map(app => `
                <div class="application-item">
                    <h4>${app.company_name}</h4>
                    <p>Position: ${app.position}</p>
                    <p>Status: ${app.status}</p>
                    <p>Applied: ${new Date(app.created_at).toLocaleDateString()}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading applications:', error);
    }
}

// Load networking contacts
async function loadNetworkingContacts() {
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await window.supabase
            .from('networking_contacts')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        const contactsList = document.getElementById('contactsList');
        if (contactsList) {
            contactsList.innerHTML = data.map(contact => `
                <div class="contact-item">
                    <h4>${contact.name}</h4>
                    <p>Company: ${contact.company}</p>
                    <p>Position: ${contact.position}</p>
                    <p>Contact: ${contact.contact_info}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading contacts:', error);
    }
}

// Additional form handlers (integrated into main setupEventListeners)
function setupAdditionalForms() {
    // Additional form submission handlers can be added here if needed
    console.log('[Dashboard.js] Additional forms setup complete');
}