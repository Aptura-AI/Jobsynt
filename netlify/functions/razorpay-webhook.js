const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Razorpay-Signature',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // Verify webhook signature
        const signature = event.headers['x-razorpay-signature'];
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(event.body)
            .digest('hex');

        if (signature !== expectedSignature) {
            console.error('❌ Invalid webhook signature');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid signature' })
            };
        }

        const payload = JSON.parse(event.body);
        const eventType = payload.event;
        
        console.log('🔔 Razorpay webhook received:', eventType);

        // Handle different event types
        switch (eventType) {
            case 'payment.captured':
                await handlePaymentCaptured(payload.payload.payment.entity);
                break;
            
            case 'subscription.activated':
                await handleSubscriptionActivated(payload.payload.subscription.entity);
                break;
            
            case 'subscription.charged':
                await handleSubscriptionCharged(payload.payload.payment.entity);
                break;
            
            case 'subscription.cancelled':
                await handleSubscriptionCancelled(payload.payload.subscription.entity);
                break;
            
            case 'subscription.completed':
                await handleSubscriptionCompleted(payload.payload.subscription.entity);
                break;
            
            default:
                console.log(`Unhandled event type: ${eventType}`);
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ received: true })
        };

    } catch (error) {
        console.error('❌ Webhook error:', error);
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Handle successful payment capture
async function handlePaymentCaptured(payment) {
    const userId = payment.notes?.user_id;
    const plan = payment.notes?.plan;
    const subscriptionId = payment.notes?.subscription_id;
    
    console.log(`✅ Payment captured for user ${userId}, plan: ${plan}`);

    if (!userId || !plan) {
        console.error('❌ Missing user_id or plan in payment notes');
        return;
    }

    try {
        // Update user subscription in database
        const { data, error } = await supabase
            .from('user_subscriptions')
            .upsert({
                user_id: userId,
                plan: plan,
                razorpay_subscription_id: subscriptionId,
                razorpay_customer_id: payment.customer_id,
                status: 'active',
                current_period_start: new Date().toISOString(),
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        if (error) throw error;

        // Update user job preferences with new limits
        const jobLimits = getJobLimits(plan);
        await supabase
            .from('user_job_preferences')
            .upsert({
                user_id: userId,
                subscription_plan: plan,
                job_limit: jobLimits.daily_limit,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        // Update payment attempt status
        await supabase
            .from('payment_attempts')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('razorpay_order_id', payment.order_id);

        console.log(`✅ User ${userId} upgraded to ${plan} plan successfully`);

    } catch (error) {
        console.error('❌ Error updating subscription:', error);
    }
}

// Handle subscription activation
async function handleSubscriptionActivated(subscription) {
    const userId = subscription.notes?.user_id;
    const plan = subscription.notes?.plan;
    
    console.log(`✅ Subscription activated for user ${userId}, plan: ${plan}`);

    try {
        await supabase
            .from('user_subscriptions')
            .update({
                status: 'active',
                razorpay_subscription_id: subscription.id,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

    } catch (error) {
        console.error('❌ Error activating subscription:', error);
    }
}

// Handle successful subscription charge
async function handleSubscriptionCharged(payment) {
    const subscriptionId = payment.subscription_id;
    
    try {
        await supabase
            .from('user_subscriptions')
            .update({
                status: 'active',
                last_payment_date: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_subscription_id', subscriptionId);

        console.log(`✅ Subscription charged: ${subscriptionId}`);

    } catch (error) {
        console.error('❌ Error updating payment status:', error);
    }
}

// Handle subscription cancellation
async function handleSubscriptionCancelled(subscription) {
    const userId = subscription.notes?.user_id;
    
    try {
        await supabase
            .from('user_subscriptions')
            .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_subscription_id', subscription.id);

        // Reset job limits to free tier
        if (userId) {
            await supabase
                .from('user_job_preferences')
                .update({
                    subscription_plan: 'free',
                    job_limit: 10,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);
        }

        console.log(`✅ Subscription cancelled: ${subscription.id}`);

    } catch (error) {
        console.error('❌ Error handling cancellation:', error);
    }
}

// Handle subscription completion
async function handleSubscriptionCompleted(subscription) {
    const userId = subscription.notes?.user_id;
    
    try {
        await supabase
            .from('user_subscriptions')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('razorpay_subscription_id', subscription.id);

        console.log(`✅ Subscription completed: ${subscription.id}`);

    } catch (error) {
        console.error('❌ Error handling completion:', error);
    }
}

// Get job limits based on plan
function getJobLimits(plan) {
    switch (plan?.toLowerCase()) {
        case 'professional':
            return { daily_limit: 20 };
        case 'executive':
            return { daily_limit: 30 };
        default:
            return { daily_limit: 10 };
    }
}
