exports.handler = async (event, context) => {
  try {
    // Test environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const siteUrl = process.env.URL;
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        message: 'Function is working!',
        timestamp: new Date().toISOString(),
        environment: {
          supabaseUrl: supabaseUrl ? 'Set ✓' : 'Missing ✗',
          serviceKey: serviceKey ? 'Set ✓' : 'Missing ✗',
          siteUrl: siteUrl ? 'Set ✓' : 'Optional - Not Required'
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
}; 