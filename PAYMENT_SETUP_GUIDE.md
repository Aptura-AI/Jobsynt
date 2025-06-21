# 💳 Payment Setup Guide - Razorpay Integration

## Overview
This guide will help you set up Razorpay payment processing for your Jobsynt AI subscription system. Razorpay is perfect for India-based businesses and accepts international payments.

## 🚀 Quick Setup Steps

### 1. Create Razorpay Account
1. Go to [razorpay.com](https://razorpay.com) and create an account
2. Complete KYC verification with Indian documents
3. Navigate to your Razorpay Dashboard

### 2. Get API Keys
1. In Razorpay Dashboard, go to **Settings > API Keys**
2. Generate and copy your **Key ID** and **Key Secret**
3. Note: Start with Test Mode keys for development

### 3. Create Subscription Plans
In Razorpay Dashboard:

#### Professional Plan (₹29/month)
1. Go to **Subscriptions > Plans**
2. Click **Create Plan**
3. Plan Details:
   - Plan Name: "Professional Plan"
   - Amount: ₹29.00
   - Billing Cycle: Monthly
   - Description: "Welcome to Professional! 20 daily job matches, advanced features, and AI cover letters. Thank you for choosing Jobsynt AI!"
4. Copy the **Plan ID** (starts with `plan_`)

#### Executive Plan (₹79/month)
1. Go to **Subscriptions > Plans**
2. Click **Create Plan**
3. Plan Details:
   - Plan Name: "Executive Plan"
   - Amount: ₹79.00
   - Billing Cycle: Monthly
   - Description: "Welcome to Executive! Premium tier with 30 daily matches, dedicated support, and all advanced features. Thank you!"
4. Copy the **Plan ID** (starts with `plan_`)

### 4. Set Up Webhook
1. Go to **Settings > Webhooks**
2. Click **Create Webhook**
3. Webhook URL: `https://your-domain.netlify.app/.netlify/functions/razorpay-webhook`
4. Select these events:
   - `payment.captured`
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.cancelled`
   - `subscription.completed`
5. Copy the **Webhook Secret**

### 5. Environment Variables
Add these to your Netlify environment variables:

```bash
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_... # Your Razorpay Key ID
RAZORPAY_KEY_SECRET=... # Your Razorpay Key Secret
RAZORPAY_WEBHOOK_SECRET=... # Your Webhook Secret

# Plan IDs from Razorpay Dashboard
RAZORPAY_PROFESSIONAL_PLAN_ID=plan_... # Professional Plan ID
RAZORPAY_EXECUTIVE_PLAN_ID=plan_... # Executive Plan ID
```

### 6. Database Setup
Run the SQL from `SUPABASE_SUBSCRIPTION_TABLES.sql` in your Supabase SQL editor to create the necessary tables.

## 🔧 Testing

### Test Mode
- Use Razorpay test keys (start with `rzp_test_`)
- Test card numbers: `4111111111111111` (Visa)
- Any future expiry date and any 3-digit CVV
- Test UPI: `success@razorpay`

### Production Mode
- Switch to live keys (start with `rzp_live_`)
- Complete account activation and KYC
- Real payments will be processed

## 📱 How It Works

### User Flow
1. User clicks "Upgrade Now" button
2. System creates Razorpay order and subscription
3. Razorpay checkout modal opens on your site
4. User completes payment (Cards, UPI, Wallets, NetBanking)
5. Webhook updates user subscription in database

### Technical Flow
1. `upgradeToPlan()` → calls `create-payment-session.js`
2. Razorpay order and subscription created
3. Razorpay checkout opens as modal
4. User completes payment
5. Razorpay sends webhook to `razorpay-webhook.js`
6. System updates `user_subscriptions` table

## 🛡️ Security Features

- ✅ Razorpay handles all payment processing (PCI DSS compliant)
- ✅ Webhook signature verification
- ✅ Modal-based checkout (user stays on your site)
- ✅ No sensitive data stored in your database
- ✅ SSL encryption for all transactions

## 🎯 Plan Features

### Free Tier (Default)
- 10 jobs per day
- Basic job matching
- Resume analysis
- Ghost job detection

### Professional Plan (₹29/month)
- 20 jobs per day
- Advanced job matching
- Full resume optimization
- Priority applications
- AI cover letters
- Email notifications

### Executive Plan (₹79/month)
- 30 jobs per day
- Premium job matching
- Advanced ghost detection
- Dedicated support
- LinkedIn optimization
- All Professional features

## 💰 Payment Methods Supported

- **Credit/Debit Cards** - Visa, Mastercard, Rupay, Amex
- **UPI** - All UPI apps (GPay, PhonePe, Paytm, etc.)
- **Net Banking** - 50+ banks supported
- **Wallets** - Paytm, Mobikwik, Freecharge, etc.
- **International Cards** - For global customers

## 🔄 Subscription Management

### Cancellation
Users can cancel through Razorpay Customer Portal or contact support.

### Upgrades/Downgrades
Handle through Razorpay's subscription management.

### Failed Payments
Razorpay automatically retries failed payments and sends notifications.

## 📊 Analytics

Track these metrics in Razorpay Dashboard:
- Monthly Recurring Revenue (MRR)
- Payment success rate
- Popular payment methods
- Customer analytics

## 🆘 Troubleshooting

### Common Issues

**"Payment session creation failed"**
- Check Razorpay API keys are correct
- Verify plan IDs exist in Razorpay
- Check network connectivity

**"Webhook not receiving events"**
- Verify webhook URL is correct
- Check webhook secret matches
- Ensure endpoint is publicly accessible

**"User subscription not updating"**
- Check webhook events are being received
- Verify database permissions
- Check Supabase logs for errors

### Debug Mode
Add this to your environment for detailed logging:
```bash
DEBUG_PAYMENTS=true
```

## 📞 Support

- Razorpay Documentation: [razorpay.com/docs](https://razorpay.com/docs)
- Razorpay Support: Available in Dashboard
- Test your integration thoroughly before going live

## 🇮🇳 India-Specific Benefits

- ✅ **GST Compliant** - Automatic GST handling
- ✅ **Indian Regulations** - Fully compliant with RBI guidelines
- ✅ **Local Support** - Indian customer support team
- ✅ **Multiple Languages** - Hindi, English, and regional languages
- ✅ **Instant Settlements** - Same-day settlements available

## 🚀 Go Live Checklist

- [ ] Test payments work in test mode
- [ ] Webhook receives all events correctly
- [ ] User subscriptions update properly
- [ ] Complete KYC verification
- [ ] Switch to live Razorpay keys
- [ ] Test with small real payment
- [ ] Monitor for first 24 hours

---

**Ready to accept payments in India!** 🇮🇳

Your users can now upgrade to paid plans with secure Razorpay processing, supporting all popular Indian payment methods. 