// Simple scraper status function
exports.handler = async (event, context) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    };

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    try {
        const userId = event.queryStringParameters?.user_id || "test";
        
        const status = {
            timestamp: new Date().toISOString(),
            user_id: userId,
            overall_health: "needs_attention",
            database_status: "no_credentials",
            environment_check: {
                supabase_url: !!process.env.SUPABASE_URL,
                supabase_key: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY),
                site_url: !!process.env.URL,
                jsearch_api: !!process.env.JSEARCH_API_KEY
            },
            recommendations: ["This is a simplified status check"]
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(status, null, 2)
        };

    } catch (error) {
        console.error("Status check error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: "Failed to check scraper status",
                message: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};