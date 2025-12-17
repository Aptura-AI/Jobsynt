'use client';

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Input from '@/components/Input';
import Button from '@/components/Button';
import OAuthButton from '@/components/OAuthButton';
import Link from 'next/link';

function SignupForm() {
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get('email') || '';
  
  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [loading, setLoading] = useState(false);

  // Update email if URL parameter changes
  useEffect(() => {
    if (emailFromUrl) {
      setEmail(emailFromUrl);
    }
  }, [emailFromUrl]);

  const handlePasswordSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageType('error');
        setMessage(data.message || 'Unable to sign up');
      } else {
        setMessageType('success');
        setMessage(data.message || 'Account created successfully! You can now log in.');
      }
    } catch (err) {
      setMessageType('error');
      setMessage((err as Error).message || 'Unable to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold text-ink">Sign up</h1>
      <p className="mt-2 text-muted">Create your Jobsynt account.</p>

      {/* OAuth Buttons */}
      <div className="mt-6 space-y-3">
        <OAuthButton provider="google" />
        <OAuthButton provider="linkedin" />
      </div>

      {/* Divider */}
      <div className="my-6 flex items-center gap-4">
        <div className="flex-1 border-t border-slate-200"></div>
        <span className="text-sm text-muted">OR</span>
        <div className="flex-1 border-t border-slate-200"></div>
      </div>

      {/* Password Signup Form */}
      <form className="space-y-4" onSubmit={handlePasswordSignup}>
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
      </form>

      {/* Messages */}
      {message && (
        <div className={`mt-4 rounded-md p-3 text-sm ${messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

      {/* Login Link */}
      <div className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-12">Loading...</div>}>
      <SignupForm />
    </Suspense>
  );
}

