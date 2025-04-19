// pages/auth/error.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const ErrorPage = () => {
  const router = useRouter();

  useEffect(() => {
    // Redirect to homepage after 5 seconds
    setTimeout(() => {
      router.push('/');
    }, 5000);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-black text-white p-6">
      <h1 className="text-5xl font-bold text-center text-red-600 mb-6">Sign-In Error</h1>
      <p className="text-lg text-center text-gray-400 mb-8">There was an issue during sign-in. Please try again later.</p>
      <p className="text-gray-400">Redirecting to homepage...</p>
    </div>
  );
};

export default ErrorPage;
