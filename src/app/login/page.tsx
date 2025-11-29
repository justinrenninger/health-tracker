'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/instantdb';

type Phase = 'request' | 'verify';

type InstantErrorPayload = {
  body?: {
    message?: string;
  };
};

const getErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'object' && err !== null) {
    const maybeBody = (err as InstantErrorPayload).body;
    if (maybeBody?.message) {
      return maybeBody.message;
    }
  }
  return fallback;
};

export default function LoginPage() {
  const { isLoading, user, error } = db.useAuth();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  );
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (user) {
      router.replace('/log');
    }
  }, [user, router]);

  const handleRequestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('loading');
    setStatusMessage('');
    try {
      await db.auth.sendMagicCode({ email });
      setPhase('verify');
      setStatus('success');
      setStatusMessage('Magic code sent! Check your inbox.');
    } catch (err: unknown) {
      setStatus('error');
      setStatusMessage(
        getErrorMessage(err, 'Unable to send magic code right now.'),
      );
    }
  };

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('loading');
    setStatusMessage('');
    try {
      await db.auth.signInWithMagicCode({ email, code });
      setStatus('success');
      setStatusMessage('Success! Redirecting…');
      router.replace('/log');
    } catch (err: unknown) {
      setStatus('error');
      setStatusMessage(getErrorMessage(err, 'Invalid code, please try again.'));
    }
  };

  const isPending = status === 'loading';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-xl shadow-indigo-500/10">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">
          Login
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          Sign in to Health Tracker
        </h1>
        <p className="mt-2 text-sm text-white/70">
          We use passwordless magic codes. Enter your email to receive a code,
          then verify to continue.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error.message}
          </div>
        )}

        {phase === 'request' && (
          <form className="mt-8 space-y-4" onSubmit={handleRequestCode}>
            <label className="flex flex-col gap-2 text-sm font-medium text-white/80">
              Email address
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base text-white outline-none transition focus:border-indigo-400"
              />
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-2xl bg-indigo-500 px-4 py-3 text-base font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Sending code…' : 'Send magic code'}
            </button>
          </form>
        )}

        {phase === 'verify' && (
          <form className="mt-8 space-y-4" onSubmit={handleVerifyCode}>
            <label className="flex flex-col gap-2 text-sm font-medium text-white/80">
              6-digit code
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base text-white outline-none transition focus:border-indigo-400"
              />
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-2xl bg-indigo-500 px-4 py-3 text-base font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Verifying…' : 'Verify and sign in'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase('request');
                setCode('');
                setStatus('idle');
                setStatusMessage('');
              }}
              className="w-full rounded-2xl border border-white/10 px-4 py-3 text-base font-medium text-white/80 transition hover:border-white/30 hover:text-white"
            >
              Use a different email
            </button>
          </form>
        )}

        {statusMessage && (
          <p
            className={`mt-4 text-sm ${
              status === 'error' ? 'text-red-300' : 'text-green-300'
            }`}
          >
            {statusMessage}
          </p>
        )}

        {isLoading && (
          <p className="mt-6 text-center text-sm text-white/60">
            Checking your session…
          </p>
        )}
      </div>
    </main>
  );
}

