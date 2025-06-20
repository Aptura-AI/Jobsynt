// Use the global supabase client
const supabase = window.supabase;

// Error handling
async function handleAPIError(error, context) {
    console.error(`Error in ${context}:`, error);
    
    if (error.status === 429) {
        showAlert('error', 'Too many requests. Please try again later.');
        return null;
    }
    
    if (error.status === 401) {
        await handleAuthError();
        return null;
    }
    
    showAlert('error', 'An unexpected error occurred. Please try again.');
    return null;
}

async function handleAuthError() {
    const { error } = await supabase.auth.signOut();
    if (!error) {
        window.location.href = APP_CONSTANTS.AUTH.ROUTES.LOGIN;
    }
}

// UI Helpers
function showAlert(type, message) {
    const alertContainer = document.getElementById('alertContainer') || createAlertContainer();
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="button-close" data-bs-dismiss="alert"></button>
    `;
    alertContainer.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
}

function createAlertContainer() {
    const container = document.createElement('div');
    container.id = 'alertContainer';
    container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999;';
    document.body.appendChild(container);
    return container;
}

// Profile Management
async function loadProfileData() {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError) throw authError;
        if (!user) {
            window.location.href = APP_CONSTANTS.AUTH.ROUTES.LOGIN;
            return;
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();
            
        if (profileError) throw profileError;
        
        if (profile) {
            populateProfileForm(profile, user);
        }
    } catch (error) {
        await handleAPIError(error, 'loadProfileData');
    }
}

function populateProfileForm(profile, user) {
    // Personal Info
    document.getElementById('firstName').value = user.user_metadata?.first_name || '';
    document.getElementById('lastName').value = user.user_metadata?.last_name || '';
    document.getElementById('phone').value = profile.phone || '';
    document.getElementById('city').value = profile.city || '';
    document.getElementById('state').value = profile.state || '';
    document.getElementById('country').value = profile.country || 'United States';
    document.getElementById('visaStatus').value = profile.visa_status || '';
    
    // Professional Info
    document.getElementById('currentTitle').value = profile.current_title || '';
    document.getElementById('experience').value = profile.experience_level || '';
    document.getElementById('targetRole').value = profile.target_role || '';
    document.getElementById('industry').value = profile.target_industry || '';
    document.getElementById('minSalary').value = profile.min_salary || '';
    document.getElementById('maxSalary').value = profile.max_salary || '';
    document.getElementById('skills').value = profile.skills?.join(', ') || '';
    
    // Work Preferences
    const workPrefs = profile.work_preferences || {};
    document.getElementById('remote').checked = workPrefs.remote || false;
    document.getElementById('hybrid').checked = workPrefs.hybrid || false;
    document.getElementById('onsite').checked = workPrefs.onsite || false;
}

// Navigation
function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
}

// Mobile Menu
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication status
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        window.location.href = APP_CONSTANTS.AUTH.ROUTES.LOGIN;
        return;
    }

    // Load profile data
    await loadProfileData();
    
    // Show default section
    showSection('dashboard');
    
    // Setup form listeners
    setupFormListeners();
    
    // Initialize components
    initializeComponents();
    
    // Setup auth state change listener
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            window.location.href = APP_CONSTANTS.AUTH.ROUTES.LOGIN;
        }
    });
});

function setupFormListeners() {
    // Profile form submission
    document.getElementById('profileForm')?.addEventListener('submit', handleProfileSubmit);
    
    // Resume upload
    document.getElementById('resumeFile')?.addEventListener('change', handleResumeUpload);
    
    // Job search form
    document.getElementById('jobSearchForm')?.addEventListener('submit', handleJobSearch);
    
    // Application form
    document.getElementById('addApplicationForm')?.addEventListener('submit', handleApplicationSubmit);
    
    // Company form
    document.getElementById('addCompanyForm')?.addEventListener('submit', handleCompanySubmit);
}

function initializeComponents() {
    // Initialize charts
    initializeCharts();
    
    // Initialize chatbot
    initializeChatbot();
    
    // Initialize ghost detector
    initializeGhostDetector();
}

// Make functions available globally
window.showSection = showSection;
window.toggleSidebar = toggleSidebar;
window.removeCompany = removeCompany;
window.handleChatbotKeyPress = handleChatbotKeyPress;
window.sendChatbotMessage = sendChatbotMessage;
window.sendFloatingChatbotMessage = sendFloatingChatbotMessage;
window.toggleChatbot = toggleChatbot;
window.askQuestion = askQuestion;
window.hideAddCompanyModal = hideAddCompanyModal;
window.showAddCompanyModal = showAddCompanyModal;
window.confirmExportData = confirmExportData;
window.confirmDeleteAccount = confirmDeleteAccount;

async function handleProfileSubmit(e) {
    e.preventDefault();
    showLoading('profileForm');
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        const formData = {
            user_id: user.id,
            current_title: document.getElementById('currentTitle').value,
            experience_level: document.getElementById('experience').value,
            target_role: document.getElementById('targetRole').value,
            target_industry: document.getElementById('industry').value,
            skills: document.getElementById('skills').value.split(',').map(s => s.trim()).filter(Boolean),
            preferred_locations: [
                document.getElementById('city').value,
                document.getElementById('state').value
            ].filter(Boolean),
            work_preferences: {
                remote: document.getElementById('remote').checked,
                hybrid: document.getElementById('hybrid').checked,
                onsite: document.getElementById('onsite').checked
            }
        };

        const { error } = await supabase
            .from('profiles')
            .upsert(formData);

        if (error) throw error;

        showAlert('success', 'Profile updated successfully!');
    } catch (error) {
        await handleAPIError(error, 'handleProfileSubmit');
    } finally {
        hideLoading('profileForm');
    }
}

// Job Applications
async function handleApplicationSubmit(e) {
    e.preventDefault();
    showLoading('addApplicationForm');
    
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        const companyData = {
            user_id: user.id,
            name: document.getElementById('appCompany').value,
            industry: document.getElementById('industry').value
        };

        // First create/get company
        const { data: company, error: companyError } = await supabase
            .from('companies')
            .upsert(companyData)
            .select()
            .single();

        if (companyError) throw companyError;

        const applicationData = {
            user_id: user.id,
            company_id: company.id,
            job_title: document.getElementById('appJobTitle').value,
            job_url: document.getElementById('appJobUrl').value,
            status: document.getElementById('appStatus').value,
            application_date: document.getElementById('appDate').value,
            salary_range: document.getElementById('appSalary').value,
            notes: document.getElementById('appNotes').value,
            location: document.getElementById('appLocation').value
        };

        const { error: applicationError } = await supabase
            .from('job_applications')
            .insert(applicationData);

        if (applicationError) throw applicationError;

        showAlert('success', 'Application added successfully!');
        document.getElementById('addApplicationForm').reset();
        loadApplications('all');
    } catch (error) {
        await handleAPIError(error, 'handleApplicationSubmit');
    } finally {
        hideLoading('addApplicationForm');
    }
}

// Ghost Job Detection
async function analyzeJob(url) {
    showLoading('analysisResult');
    
    try {
        const response = await fetch('/api/analyze-job', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.GPT.apiKey}`
            },
            body: JSON.stringify({ 
                url,
                model: API_CONFIG.GPT.model,
                max_tokens: API_CONFIG.GPT.maxTokens
            })
        });

        if (!response.ok) throw new Error('Failed to analyze job');
        
        const analysis = await response.json();
        
        // Save to Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from('ghost_job_reports').insert({
                user_id: user.id,
                job_url: url,
                detection_score: analysis.score,
                reasons: analysis.indicators,
                is_confirmed: false
            });
        }

        displayAnalysisResults(analysis);
    } catch (error) {
        await handleAPIError(error, 'analyzeJob');
    } finally {
        hideLoading('analysisResult');
    }
}

// Loading States
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('loading');
        const spinner = document.createElement('div');
        spinner.className = 'spinner-overlay';
        spinner.innerHTML = '<div class="spinner-border text-primary"></div>';
        element.appendChild(spinner);
    }
}

function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('loading');
        const spinner = element.querySelector('.spinner-overlay');
        if (spinner) spinner.remove();
    }
}

async function handleResumeUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    showLoading('resumeUpload');

    try {
        const formData = new FormData();
        formData.append('resume', file);

        const response = await fetch('/api/upload-resume', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Failed to upload resume');

        const data = await response.json();
        showAlert('success', 'Resume uploaded successfully!');
    } catch (error) {
        await handleAPIError(error, 'handleResumeUpload');
    } finally {
        hideLoading('resumeUpload');
    }
}

async function handleJobSearch(e) {
    e.preventDefault();
    showLoading('jobSearch');

    try {
        const query = document.getElementById('jobSearchQuery').value;
        const response = await fetch('/api/search-jobs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) throw new Error('Failed to search jobs');

        const data = await response.json();
        displayJobResults(data);
    } catch (error) {
        await handleAPIError(error, 'handleJobSearch');
    } finally {
        hideLoading('jobSearch');
    }
}

async function handleCompanySubmit(e) {
    e.preventDefault();
    showLoading('addCompanyForm');

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        const formData = {
            user_id: user.id,
            name: document.getElementById('companyName').value,
            industry: document.getElementById('companyIndustry').value
        };

        const { data: company, error: companyError } = await supabase
            .from('companies')
            .upsert(formData)
            .select()
            .single();

        if (companyError) throw companyError;

        showAlert('success', 'Company added successfully!');
        document.getElementById('addCompanyForm').reset();
        loadCompanies();
    } catch (error) {
        await handleAPIError(error, 'handleCompanySubmit');
    } finally {
        hideLoading('addCompanyForm');
    }
}

async function handleCompanyRemove(companyId) {
    showLoading('removeCompany');

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        const { error: removeError } = await supabase
            .from('companies')
            .delete()
            .eq('id', companyId)
            .eq('user_id', user.id);

        if (removeError) throw removeError;

        showAlert('success', 'Company removed successfully!');
        loadCompanies();
    } catch (error) {
        await handleAPIError(error, 'handleCompanyRemove');
    } finally {
        hideLoading('removeCompany');
    }
}

async function handleResumeDownload(resumeId) {
    showLoading('downloadResume');

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        const response = await fetch('/api/download-resume', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ resume_id: resumeId })
        });

        if (!response.ok) throw new Error('Failed to download resume');

        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `resume_${resumeId}.pdf`;
        link.click();
        URL.revokeObjectURL(link.href);

        showAlert('success', 'Resume downloaded successfully!');
    } catch (error) {
        await handleAPIError(error, 'handleResumeDownload');
    } finally {
        hideLoading('downloadResume');
    }
}

async function handleApplicationRemove(applicationId) {
    showLoading('removeApplication');

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        const { error: removeError } = await supabase
            .from('job_applications')
            .delete()
            .eq('id', applicationId)
            .eq('user_id', user.id);

        if (removeError) throw removeError;

        showAlert('success', 'Application removed successfully!');
        loadApplications('all');
    } catch (error) {
        await handleAPIError(error, 'handleApplicationRemove');
    } finally {
        hideLoading('removeApplication');
    }
}

async function handleCompanyRemove(companyId) {
    showLoading('removeCompany');

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        const { error: removeError } = await supabase
            .from('companies')
            .delete()
            .eq('id', companyId)
            .eq('user_id', user.id);

        if (removeError) throw removeError;

        showAlert('success', 'Company removed successfully!');
        loadCompanies();
    } catch (error) {
        await handleAPIError(error, 'handleCompanyRemove');
    } finally {
        hideLoading('removeCompany');
    }
}

async function handleResumeDownload(resumeId) {
    showLoading('downloadResume');

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        const response = await fetch('/api/download-resume', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ resume_id: resumeId })
        });

        if (!response.ok) throw new Error('Failed to download resume');

        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `resume_${resumeId}.pdf`;
        link.click();
        URL.revokeObjectURL(link.href);

        showAlert('success', 'Resume downloaded successfully!');
    } catch (error) {
        await handleAPIError(error, 'handleResumeDownload');
    } finally {
        hideLoading('downloadResume');
    }
}

async function handleApplicationRemove(applicationId) {
    showLoading('removeApplication');

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        const { error: removeError } = await supabase
            .from('job_applications')
            .delete()
            .eq('id', applicationId)
            .eq('user_id', user.id);

        if (removeError) throw removeError;

        showAlert('success', 'Application removed successfully!');
        loadApplications('all');
    } catch (error) {
        await handleAPIError(error, 'handleApplicationRemove');
    } finally {
        hideLoading('removeApplication');
    }
} 