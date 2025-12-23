import { getServerSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import PayPalButton from '@/components/payments/PayPalButton';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

import { hasCandidateAccessServer } from '@/lib/utils/accessCheck';

export default async function PricingPage() {
  const session = await getServerSession();
  
  // Redirect to login if not authenticated
  if (!session?.user?.email) {
    redirect('/login');
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="text-center">
          <p className="text-gray-600">Database not configured</p>
        </div>
      </div>
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Fetch profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, trial_ends_at, is_paid, discount_code, discount_percent, discount_end_date')
    .eq('email', session.user.email)
    .maybeSingle();

  if (error || !profile) {
    // No profile found, show pricing page
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">Early Access – Limited Time Offer</h1>
          <p className="text-lg text-gray-600">
            Start with a 7-day free trial. No payment required today.
          </p>
        </div>

        <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-lg">
          <div className="mb-6 text-center">
            <div className="mb-4">
              <span className="text-5xl font-bold text-gray-900">$29</span>
              <span className="text-xl text-gray-600">.00</span>
            </div>
            <p className="text-sm text-gray-500">One-time early access fee</p>
            <p className="mt-2 text-xs text-gray-500">
              This unlocks full access to JobSynt during our early access phase.
              <br />
              Subscription plans will be introduced later.
            </p>
          </div>

          <div className="mb-6 space-y-3">
            <div className="flex items-start">
              <svg className="mr-2 h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">AI-powered job matching</span>
            </div>
            <div className="flex items-start">
              <svg className="mr-2 h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">Personalized job recommendations</span>
            </div>
            <div className="flex items-start">
              <svg className="mr-2 h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">Priority access to new opportunities</span>
            </div>
            <div className="flex items-start">
              <svg className="mr-2 h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">Resume optimization tools</span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <PayPalButton />
          </div>

          <p className="mt-4 text-center text-xs text-gray-500">
            Secure payment powered by PayPal
          </p>
        </div>
      </div>
    );
  }

  // Check if candidate has access (reuse existing supabase client)
  const hasAccess = await hasCandidateAccessServer(profile.id, supabase);
  if (hasAccess) {
    redirect('/dashboard');
  }

  // Check if trial is active (trial_ends_at > now())
  const now = new Date();
  const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const isTrialActive = trialEndsAt && trialEndsAt > now;
  const trialExpired = trialEndsAt && trialEndsAt <= now;

  // Calculate days remaining in trial
  const getTrialDaysRemaining = (): number | null => {
    if (!isTrialActive || !trialEndsAt) return null;
    const diffTime = trialEndsAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysRemaining = getTrialDaysRemaining();

  // Calculate discounted price if discount is active
  const BASE_PRICE = 29.00;
  const getDiscountedPrice = () => {
    if (!profile?.discount_percent || !profile?.discount_end_date) {
      return BASE_PRICE;
    }
    const endDate = new Date(profile.discount_end_date);
    const now = new Date();
    if (endDate < now) {
      return BASE_PRICE; // Discount expired
    }
    return BASE_PRICE * (1 - profile.discount_percent / 100);
  };

  const finalPrice = getDiscountedPrice();
  const hasActiveDiscount = profile?.discount_percent && profile?.discount_end_date && new Date(profile.discount_end_date) > new Date();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="mb-4 text-4xl font-bold text-gray-900">Early Access – Limited Time Offer</h1>
        <p className="text-lg text-gray-600">
          Start with a 7-day free trial. No payment required today.
        </p>
      </div>

      {/* Trial active message - NO PAYMENT BUTTON */}
      {isTrialActive && (
        <div className="mx-auto max-w-md rounded-lg border border-blue-200 bg-blue-50 p-8 shadow-lg">
          <div className="mb-6 text-center">
            <div className="mb-4">
              <svg className="mx-auto h-16 w-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">You are currently on a free 7-day trial</h2>
            <p className="mb-4 text-gray-700">
              No payment is required until your trial ends.
            </p>
            {daysRemaining !== null && (
              <p className="text-lg font-semibold text-blue-600">
                Full access ends in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Trial expired or no trial - SHOW PAYMENT */}
      {!isTrialActive && (
        <>
          {/* Trial expired banner */}
          {trialExpired && (
            <div className="mx-auto max-w-md mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4 text-center">
              <p className="text-orange-800 font-medium">
                Your 7-day free trial has ended. Unlock full access to continue.
              </p>
            </div>
          )}

          <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-lg">
            <div className="mb-6 text-center">
              <div className="mb-4">
                {hasActiveDiscount && profile.discount_percent ? (
                  <>
                    <div className="mb-2">
                      <span className="text-2xl font-bold text-gray-400 line-through">$29.00</span>
                      <span className="ml-2 text-5xl font-bold text-gray-900">${finalPrice.toFixed(2)}</span>
                    </div>
                    <p className="text-sm font-semibold text-green-600">
                      {profile.discount_percent}% OFF - Code: {profile.discount_code}
                    </p>
                  </>
                ) : (
                  <>
                    <span className="text-5xl font-bold text-gray-900">$29</span>
                    <span className="text-xl text-gray-600">.00</span>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-500">One-time early access fee</p>
              <p className="mt-2 text-xs text-gray-500">
                This unlocks full access to JobSynt during our early access phase.
                <br />
                Subscription plans will be introduced later.
              </p>
            </div>

            <div className="mb-6 space-y-3">
              <div className="flex items-start">
                <svg className="mr-2 h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">AI-powered job matching</span>
              </div>
              <div className="flex items-start">
                <svg className="mr-2 h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Personalized job recommendations</span>
              </div>
              <div className="flex items-start">
                <svg className="mr-2 h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Priority access to new opportunities</span>
              </div>
              <div className="flex items-start">
                <svg className="mr-2 h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">Resume optimization tools</span>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <PayPalButton />
            </div>

            <p className="mt-4 text-center text-xs text-gray-500">
              Secure payment powered by PayPal
            </p>
          </div>
        </>
      )}
    </div>
  );
}

