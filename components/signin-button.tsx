// components/signin-button.tsx
'use client';
import { signIn } from 'next-auth/react';

export default function SignInButton() {
  return (
    <button 
      onClick={() => signIn('google')}
      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
    >
      Sign in with Google
    </button>
  );
}