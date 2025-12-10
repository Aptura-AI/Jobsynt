'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Input from '@/components/Input';
import Button from '@/components/Button';
import Link from 'next/link';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [showMagicLinkSuccess, setShowMagicLinkSuccess] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setShowMagicLinkSuccess(false);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageType('error');
        setMessage(data.message || 'Invalid credentials');
      } else {
        // Safe redirect: validate route and prevent open redirect attacks
        const next = searchParams.get('next');
        const redirectTo = next?.startsWith('/') ? next : '/';
        router.push(redirectTo);
      }
    } catch (err) {
      setMessageType('error');
      setMessage((err as Error).message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setMessageType('error');
      setMessage('Please enter your email address');
      return;
    }
    setMagicLinkLoading(true);
    setMessage(null);
    setShowMagicLinkSuccess(false);
    try {
      const res = await fetch('/api/login/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessageType('error');
        setMessage(data.message || 'Unable to send magic link');
      } else {
        setMessageType('success');
        setMessage(data.message || 'Check your email for the magic link');
        setShowMagicLinkSuccess(true);
      }
    } catch (err) {
      setMessageType('error');
      setMessage((err as Error).message || 'Unable to send magic link');
    } finally {
      setMagicLinkLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold text-ink">Login</h1>
      <p className="mt-2 text-muted">Access your Jobsynt account.</p>

      {/* Password Login Form */}
      <form className="mt-6 space-y-4" onSubmit={handlePasswordLogin}>
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" loading={loading}>
          Login
        </Button>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-4">
        <div className="flex-1 border-t border-slate-200"></div>
        <span className="text-sm text-muted">OR</span>
        <div className="flex-1 border-t border-slate-200"></div>
      </div>

      {/* Magic Link Option */}
      <form onSubmit={handleMagicLink} className="space-y-4">
        <div>
          <Input
            label="Sign in with email (passwordless)"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={magicLinkLoading}
          />
          <p className="mt-1 text-xs text-muted">We'll send you a magic link to sign in</p>
        </div>
        <Button type="submit" variant="ghost" loading={magicLinkLoading} className="w-full">
          Send magic link
        </Button>
      </form>

      {/* Messages */}
      {message && (
        <div className={`mt-4 rounded-md p-3 text-sm ${messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

      {showMagicLinkSuccess && (
        <div className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-700">
          <p className="font-semibold">Check your inbox!</p>
          <p className="mt-1">Click the link in the email to sign in. The link will expire in 1 hour.</p>
        </div>
      )}

      {/* Signup Link */}
      <div className="mt-6 text-center text-sm text-muted">
        Don't have an account?{' '}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          Sign up
        </Link>
      </div>
    </div>
  );
}

