'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Input from '@/components/Input';
import Button from '@/components/Button';
import OAuthButton from '@/components/OAuthButton';
import Link from 'next/link';

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [loading, setLoading] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
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
        console.error('Login failed:', data);
      } else {
        console.log('Login successful:', data);
        // Small delay to ensure cookie is set before redirect
        setTimeout(() => {
          // Role-aware redirect using window.location.href
          if (data?.role === 'admin') {
            window.location.href = '/admin';
          } else {
            window.location.href = '/dashboard';
          }
        }, 100);
      }
    } catch (err) {
      setMessageType('error');
      setMessage((err as Error).message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold text-ink">Login</h1>
      <p className="mt-2 text-muted">Access your Jobsynt account.</p>

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

      {/* Password Login Form */}
      <form className="space-y-4" onSubmit={handlePasswordLogin}>
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" loading={loading} className="w-full">
          Login
        </Button>
      </form>

      {/* Messages */}
      {message && (
        <div className={`mt-4 rounded-md p-3 text-sm ${messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-12">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

