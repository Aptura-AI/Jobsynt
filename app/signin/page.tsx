'use client';

import { signIn } from 'next-auth/react';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
      <h1 className="text-3xl font-bold mb-6">Welcome to Jobsynt 👋</h1>
      <p className="mb-4 text-center">Your AI Job Agent. Sign in to get started.</p>
      <div className="space-y-4">
        <button
          onClick={() => signIn('google')}
          className="px-6 py-2 rounded bg-purple-600 hover:bg-purple-700 transition"
        >
          Sign in with Google
        </button>
        <button
          onClick={() => signIn('linkedin')}
          className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 transition"
        >
          Sign in with LinkedIn
        </button>
      </div>
    </div>
  );
}
