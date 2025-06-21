const Razorpay = require('razorpay');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const { plan, user_id, user_email } = JSON.parse(event.body);

        if (!plan || !user_id) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Plan and user ID are required'
                })
            };
        }

        // Define subscription plans
        const plans = {
            professional: {
                amount: 2900, // ₹29.00 (in paise)
                currency: 'INR',
                name: 'Professional Plan',
                description: 'Welcome to Professional! 20 daily job matches, advanced features, and AI cover letters. Thank you for choosing Jobsynt AI!',
                features: ['20 jobs per day', 'Advanced matching', 'Email notifications', 'Priority support']
            },
            executive: {
                amount: 7900, // ₹79.00 (in paise)
                currency: 'INR',
                name: 'Executive Plan',
                description: 'Welcome to Executive! Premium tier with 30 daily matches, dedicated support, and all advanced features. Thank you!',
                features: ['30 jobs per day', 'Premium matching', 'Instant notifications', 'Dedicated support', 'Resume optimization']
            }
        };

        const selectedPlan = plans[plan.toLowerCase()];
        if (!selectedPlan) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid plan selected'
                })
            };
        }

        // Create Razorpay subscription
        const subscription = await razorpay.subscriptions.create({
            plan_id: process.env[`RAZORPAY_${plan.toUpperCase()}_PLAN_ID`],
            customer_notify: 1,
            quantity: 1,
            total_count: 12, // 12 months
            addons: [],
            notes: {
                user_id: user_id,
                plan: plan.toLowerCase(),
                upgrade_timestamp: new Date().toISOString()
            }
        });

        // Create Razorpay order for immediate payment
        const order = await razorpay.orders.create({
            amount: selectedPlan.amount,
            currency: selectedPlan.currency,
            receipt: `order_${user_id}_${Date.now()}`,
            notes: {
                user_id: user_id,
                plan: plan.toLowerCase(),
                subscription_id: subscription.id
            }
        });

        // Log the payment attempt
        await supabase
            .from('payment_attempts')
            .insert({
                user_id: user_id,
                plan: plan.toLowerCase(),
                razorpay_order_id: order.id,
                razorpay_subscription_id: subscription.id,
                amount: selectedPlan.amount,
                status: 'pending',
                created_at: new Date().toISOString()
            });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                order_id: order.id,
                subscription_id: subscription.id,
                amount: selectedPlan.amount,
                currency: selectedPlan.currency,
                plan_details: selectedPlan,
                razorpay_key: process.env.RAZORPAY_KEY_ID
            })
        };

    } catch (error) {
        console.error('❌ Payment session creation error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Failed to create payment session',
                message: error.message
            })
        };
    }
}; 