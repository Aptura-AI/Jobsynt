const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Add security headers middleware
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self' https://yhrwamhdiiggsapmfwas.supabase.co https://accounts.google.com; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' cdnjs.cloudflare.com cdn.jsdelivr.net https://yhrwamhdiiggsapmfwas.supabase.co; " +
        "style-src 'self' 'unsafe-inline' cdnjs.cloudflare.com; " +
        "img-src 'self' data: blob:; " +
        "connect-src 'self' https://yhrwamhdiiggsapmfwas.supabase.co https://accounts.google.com https://api.linkedin.com; " +
        "font-src 'self' cdnjs.cloudflare.com; " +
        "frame-src 'self' https://accounts.google.com"
    );
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Serve static files from the public directory with proper MIME types
app.use('/public', express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Serve static files from root directory
app.use(express.static(__dirname, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve dashboard.html for the dashboard route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 