'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function ResetPasswordForm() {
  const [mounted, setMounted] = useState(false);
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    setSearchParams(params);
    const emailFromUrl = params.get('email') || '';
    const code = params.get('code');
    if (emailFromUrl) {
      setEmail(emailFromUrl);
    }
    setVerifying(!!code);
  }, []);

  if (!mounted || !searchParams) {
    return null;
  }

  const emailFromUrl = searchParams.get('email') || '';
  const code = searchParams.get('code');
  const type = searchParams.get('type'); // 'recovery' for password reset

  // Auto-verify email if code is present (from Supabase password reset link)
  useEffect(() => {
    if (code && supabaseUrl && supabaseAnonKey) {
      const verifyEmail = async () => {
        try {
          const supabase = createClient(supabaseUrl, supabaseAnonKey);
          
          // Exchange code for session (this verifies email and creates session)
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError || !data.session) {
            setMessage('Invalid or expired verification link. Please request a new password reset.');
            setMessageType('error');
            setVerifying(false);
            return;
          }

          // Email verified and session created, show password reset form
          setVerifying(false);
          setMessage('Email verified! Please set your password.');
          setMessageType('success');
        } catch (error) {
          console.error('Verification error:', error);
          setMessage('Error verifying email. Please try again.');
          setMessageType('error');
          setVerifying(false);
        }
      };

      verifyEmail();
    } else if (!code && emailFromUrl) {
      // No code but email provided - show form to request reset link
      setVerifying(false);
    } else {
      setVerifying(false);
    }
  }, [code, emailFromUrl]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || password.length < 6) {
      setMessage('Password must be at least 6 characters');
      setMessageType('error');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      setMessageType('error');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // If we have a code, we already have a session from exchangeCodeForSession
      // Just update the password
      if (code) {
        const { error } = await supabase.auth.updateUser({
          password: password,
        });

        if (error) {
          throw error;
        }

        // After password update, ensure profile is linked
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user) {
          // Profile linking happens automatically via ensureProfileExists in auth callback
          // But since we're not using callback, we need to link manually
          try {
            await fetch('/api/auth/link-profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: sessionData.session.user.email }),
            });
          } catch (linkError) {
            console.error('Error linking profile:', linkError);
            // Continue anyway - profile might already be linked
          }
        }

        // Password reset successful - redirect to candidates page
        setMessage('Password set successfully! Redirecting...');
        setMessageType('success');

        // Wait a moment then redirect
        setTimeout(() => {
          window.location.href = `/candidates?email=${encodeURIComponent(email)}&verified=true`;
        }, 1500);
      } else {
        // No code - try to reset password for email
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password?email=${encodeURIComponent(email)}&type=recovery`,
        });

        if (error) {
          throw error;
        }

        setMessage('Password reset email sent! Check your inbox.');
        setMessageType('success');
        setLoading(false);
        return;
      }

    } catch (error: any) {
      console.error('Password reset error:', error);
      setMessage(error.message || 'Failed to reset password. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="card p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted">Verifying your email...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold text-ink">Set Your Password</h1>
      <p className="mt-2 text-muted">
        {code ? 'Your email has been verified. Please set your password to continue.' : 'Enter your email to receive a password reset link.'}
      </p>

      <form className="mt-6 space-y-4" onSubmit={handlePasswordReset}>
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!!code} // Disable if code is present (email already verified)
          className={code ? 'bg-gray-50' : ''}
        />

        {code && (
          <>
            <Input
              label="New Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              placeholder="At least 6 characters"
            />
            <Input
              label="Confirm Password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
            />
          </>
        )}

        <Button type="submit" loading={loading} className="w-full">
          {code ? 'Set Password' : 'Send Reset Link'}
        </Button>
      </form>

      {message && (
        <div className={`mt-4 rounded-md p-3 text-sm ${
          messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message}
        </div>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}

