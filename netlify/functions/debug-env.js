exports.handler = async (event, context) => {
  try {
    // Get all environment variables that start with SUPABASE
    const envVars = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (key.includes('SUPABASE') || key === 'URL') {
        envVars[key] = value ? `${value.substring(0, 10)}...` : 'undefined';
      }
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Environment variables debug',
        timestamp: new Date().toISOString(),
        availableVars: envVars,
        totalEnvVars: Object.keys(process.env).length
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
        error: error.message
      })
    };
  }
}; 