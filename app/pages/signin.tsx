// pages/signin.tsx
'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const SignInPage = () => {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignIn = async (provider: string) => {
    setLoading(true);
    await signIn(provider);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-black text-white p-6">
      <h1 className="text-5xl font-bold text-center text-purple-600 mb-6">Welcome to JobSynt</h1>
      <p className="text-lg text-center text-gray-400 mb-8">Your AI-powered job agent. Sign in to get started.</p>

      <div className="space-y-4">
        <button
          className="bg-purple-600 text-white px-8 py-4 rounded-full text-xl w-full"
          onClick={() => handleSignIn('google')}
          disabled={loading}
        >
          Sign in with Google
        </button>
        
        <button
          className="bg-blue-700 text-white px-8 py-4 rounded-full text-xl w-full"
          onClick={() => handleSignIn('linkedin')}
          disabled={loading}
        >
          Sign in with LinkedIn
        </button>
      </div>

      {loading && <p className="mt-4 text-gray-400">Signing in...</p>}
    </div>
  );
};

export default SignInPage;
