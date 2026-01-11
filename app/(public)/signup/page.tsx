'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Input from '@/components/Input';
import Button from '@/components/Button';
import OAuthButton from '@/components/OAuthButton';
import Link from 'next/link';
import { isInviteSignup } from '@/lib/auth-config.client';

function InviteOnlyMessage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-ink">Registrations Temporarily Closed</h1>
        <div className="mt-6 space-y-4 text-slate-700">
          <p>
            Jobsynt is currently operating in testing mode and we have received a strong response from candidates.
          </p>
          <p>
            To ensure quality and stability during this phase, new candidate registrations are available by invitation only.
          </p>
          <p>
            If you are interested in joining Jobsynt, please email us at{' '}
            <a href="mailto:info@jobsynt.com" className="font-semibold text-primary hover:underline">
              info@jobsynt.com
            </a>{' '}
            with a brief introduction, and we will reach out if a spot becomes available.
          </p>
          <p className="text-sm text-slate-500">
            Existing invite links will continue to work as expected.
          </p>
        </div>
        <div className="mt-8 pt-6 border-t border-slate-200">
          <p className="text-sm text-slate-600">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function SignupForm() {
  const [mounted, setMounted] = useState(false);
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    setSearchParams(params);
    const emailFromUrl = params.get('email') || '';
    if (emailFromUrl) {
      setEmail(emailFromUrl);
    }
  }, []);

  if (!mounted || !searchParams) {
    return null;
  }

  // Check if this is an invite signup
  const isInvite = isInviteSignup(searchParams);

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

  // Show invite-only message if not an invite signup
  if (!isInvite) {
    return <InviteOnlyMessage />;
  }

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
  return <SignupForm />;
}

