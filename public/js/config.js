// Wait for supabase to be available
document.addEventListener('DOMContentLoaded', () => {
    if (typeof supabase === 'undefined') {
      console.error('Supabase library not loaded!');
      return;
    }
    
    // Supabase configuration
    const SUPABASE_URL = 'https://yhrwamhdiiggsapmfwas.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocndhbWhkaWlnZ3NhcG1md2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMDI1ODIsImV4cCI6MjA2MDU3ODU4Mn0.K8nMLX_MTR2IlfIaviyfex8fWuZ1qL07Gg_xIG3TYsE';
    
    // Initialize Supabase only if not already initialized
    if (!window.supabase) {
        window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true
            }
        });
        console.log('Supabase initialized from config.js');
    }
  });