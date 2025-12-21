import { getServerSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PayPalButton from '@/components/payments/PayPalButton';

export default async function PricingPage() {
  const session = await getServerSession();
  
  // Redirect to login if not authenticated
  if (!session?.user?.email) {
    redirect('/login');
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="mb-4 text-4xl font-bold text-gray-900">Upgrade to Premium</h1>
        <p className="text-lg text-gray-600">
          Get full access to JobSynt's AI-powered job matching platform
        </p>
      </div>

      <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mb-4">
            <span className="text-5xl font-bold text-gray-900">$29</span>
            <span className="text-xl text-gray-600">.00</span>
          </div>
          <p className="text-sm text-gray-500">One-time payment</p>
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

