/**
 * Not Found Page Component (App Router)
 * 
 * This handles 404 errors for routes that don't exist.
 * It renders a complete HTML page (not inside layout) to avoid context dependencies.
 * Server component - safe for static export.
 */

export default function NotFound() {
  // Render complete HTML to avoid layout context dependencies during static generation
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>404 - Page Not Found | Jobsynt</title>
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#fff' }}>
        <div style={{ maxWidth: '600px', margin: '100px auto', padding: '20px', textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '4rem', fontWeight: 'bold', marginBottom: '1rem', color: '#000' }}>404</h1>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: '#000' }}>Page not found</h2>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="/"
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                textDecoration: 'none',
                fontSize: '1rem',
              }}
            >
              Go home
            </a>
            <a
              href="/jobs"
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'transparent',
                color: '#0070f3',
                border: '1px solid #0070f3',
                borderRadius: '4px',
                textDecoration: 'none',
                fontSize: '1rem',
              }}
            >
              Browse Jobs
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

