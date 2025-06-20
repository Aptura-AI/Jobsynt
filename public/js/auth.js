// Auth state management
let currentUser = null;
let authInitialized = false;

console.log("[Auth] Initializing...");

// Initialize auth state
async function initializeAuth() {
    try {
        // Wait for Supabase to be initialized
        if (!window.supabase) {
            console.error('[Auth] Supabase client not initialized');
            return false;
        }

        const { data: { session }, error } = await window.supabase.auth.getSession();
        if (error) {
            console.error('[Auth] Auth check failed:', error);
            // Only redirect if we're on dashboard page
            if (window.location.pathname === '/dashboard.html') {
                window.location.replace('/');
            }
            return false;
        }
        
        if (session) {
            currentUser = session.user;
            console.log('[Auth] User session restored:', currentUser.email);
            
            // Only redirect if we're on the index page and not already redirected
            if ((window.location.pathname === '/' || window.location.pathname === '/index.html') && !sessionStorage.getItem('redirecting')) {
                console.log('[Auth] Redirecting to dashboard from index page');
                sessionStorage.setItem('redirecting', 'true');
                window.location.replace('/dashboard.html');
                return false;
            }
        } else {
            // If no session and we're on dashboard, redirect to index
            if (window.location.pathname === '/dashboard.html' && !sessionStorage.getItem('redirecting')) {
                console.log('[Auth] No session, redirecting to index');
                sessionStorage.setItem('redirecting', 'true');
                window.location.replace('/');
                return false;
            }
        }
        
        // Clear redirect flag after successful initialization
        sessionStorage.removeItem('redirecting');
        
        authInitialized = true;
        return true;
    } catch (error) {
        console.error('[Auth] Auth initialization error:', error);
        return false;
    }
}

// Handle auth state changes
function setupAuthStateListener() {
    if (!window.supabase) {
        console.error('[Auth] Supabase client not initialized');
        return;
    }

    window.supabase.auth.onAuthStateChange((event, session) => {
        console.log(`[Auth] State changed: ${event}`, session);
        if (event === 'SIGNED_IN') {
            currentUser = session.user;
            updateAuthUI();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            updateAuthUI();
            window.location.href = '/';
        }
    });
}

// Update auth UI based on current state
async function updateAuthUI() {
    try {
        if (!window.supabase) {
            console.error('[Auth] Supabase client not initialized');
            return;
        }

        const { data: { session } } = await window.supabase.auth.getSession();
        const loginButton = document.getElementById('loginButton');
        const signupButton = document.getElementById('signupButton');
        const logoutButton = document.getElementById('logoutButton');
        const userMenu = document.getElementById('userMenu');
        const userEmail = document.getElementById('userEmail');
        
        if (session) {
            currentUser = session.user;
            if (loginButton) loginButton.style.display = 'none';
            if (signupButton) signupButton.style.display = 'none';
            if (logoutButton) logoutButton.style.display = 'block';
            if (userMenu) userMenu.style.display = 'block';
            if (userEmail) userEmail.textContent = currentUser.email;
        } else {
            currentUser = null;
            if (loginButton) loginButton.style.display = 'block';
            if (signupButton) signupButton.style.display = 'block';
            if (logoutButton) logoutButton.style.display = 'none';
            if (userMenu) userMenu.style.display = 'none';
        }
    } catch (error) {
        console.error('[Auth] Error updating UI:', error);
    }
}

// Setup logout handling
function setupLogout() {
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                const { error } = await window.supabase.auth.signOut();
                if (!error) {
                    window.location.href = '/index.html';
                } else {
                    console.error('[Auth] Logout error:', error);
                }
            } catch (error) {
                console.error('[Auth] Logout error:', error);
            }
        });
    }
}

// Initialize auth when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Auth] DOM loaded, initializing auth...');
    
    // Prevent initialization if already done
    if (authInitialized) {
        console.log('[Auth] Already initialized, skipping');
        return;
    }
    
    await initializeAuth();
    setupAuthStateListener();
    setupLogout();
    
    // Only initialize auth modal on index page
    if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        // Get auth modal elements
        const authModal = document.getElementById('authModal');
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        const loginLink = document.getElementById('loginLink');
        const signupLink = document.getElementById('signupLink');
        const closeModal = document.getElementById('closeModal');

        if (!authModal || !loginForm || !signupForm || !loginLink || !signupLink || !closeModal) {
            console.error('[Auth] Auth modal elements not found');
            return;
        }

        // Show login form by default
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';

        // Toggle between login and signup forms
        loginLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
        });

        signupLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.style.display = 'none';
            signupForm.style.display = 'block';
        });

        // Close modal
        closeModal.addEventListener('click', () => {
            authModal.style.display = 'none';
        });

        // Handle login
        loginForm.addEventListener('submit', handleLogin);

        // Handle signup
        signupForm.addEventListener('submit', handleSignup);
    }

    // Check auth state and update UI
    updateAuthUI();
});

// Supabase Authentication Functions
async function signInWithGoogle() {
    try {
        if (!window.supabase) {
            throw new Error('Supabase client not initialized');
        }
        const { data, error } = await window.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/dashboard.html'
            }
        });
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Google sign in error:', error);
        alert(error.message);
    }
}

async function signInWithLinkedIn() {
    try {
        if (!window.supabase) {
            throw new Error('Supabase client not initialized');
        }
        const { data, error } = await window.supabase.auth.signInWithOAuth({
            provider: 'linkedin',
            options: {
                redirectTo: window.location.origin + '/dashboard.html'
            }
        });
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('LinkedIn sign in error:', error);
        alert(error.message);
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    try {
        const email = document.getElementById('loginEmail')?.value;
        const password = document.getElementById('loginPassword')?.value;

        if (!email || !password) {
            throw new Error('Please fill in all fields');
        }

        console.log('[Auth] Attempting login for:', email);
        const { data, error } = await window.supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        
        // Check if we got a valid session
        if (!data.session) {
            throw new Error('No session returned');
        }
        
        console.log('[Auth] Login successful, redirecting to dashboard');
        window.location.href = '/dashboard.html';
    } catch (error) {
        console.error('[Auth] Login error:', error);
        alert(`Login failed: ${error.message}`);
    }
}

// Handle signup
async function handleSignup(e) {
    e.preventDefault();
    try {
        const email = document.getElementById('signupEmail')?.value;
        const password = document.getElementById('signupPassword')?.value;
        const confirmPassword = document.getElementById('confirmPassword')?.value;

        if (!email || !password || !confirmPassword) {
            throw new Error('Please fill in all fields');
        }

        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }

        console.log('[Auth] Attempting signup for:', email);
        const { data, error } = await window.supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/dashboard.html`
            }
        });

        if (error) throw error;

        alert('Signup successful! Please check your email for verification.');
        document.getElementById('signupForm').reset();
        document.getElementById('loginLink').click();
    } catch (error) {
        console.error('[Auth] Signup error:', error);
        alert(`Signup failed: ${error.message}`);
    }
}

// Set up form handlers
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const googleButton = document.getElementById('googleSignIn');
const linkedinButton = document.getElementById('linkedinSignIn');

if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}

if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
}

if (googleButton) {
    googleButton.addEventListener('click', signInWithGoogle);
}

if (linkedinButton) {
    linkedinButton.addEventListener('click', signInWithLinkedIn);
}

// Check for existing session
async function checkSession() {
    try {
        if (!window.supabase) {
            throw new Error('Supabase client not initialized');
        }
        const { data: { session }, error } = await window.supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
            // Redirect to dashboard if already logged in
            if (window.location.pathname !== '/dashboard.html') {
                window.location.href = '/dashboard.html';
            }
        } else {
            // Redirect to home if not logged in and on dashboard
            if (window.location.pathname === '/dashboard.html') {
                window.location.href = '/';
            }
        }
    } catch (error) {
        console.error('Session check error:', error);
    }
}

// Check session on load
checkSession();

// Rest of your existing auth.js code... 