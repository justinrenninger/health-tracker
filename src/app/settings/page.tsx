'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/instantdb';
import { id as instantId } from '@instantdb/react';
import { AppTabs } from '@/components/AppTabs';
type UserRecord = {
  id?: string;
  authId?: string;
  displayName?: string | null;
  email?: string | null;
  weightGoal?: number | null;
  reminderTimes?: unknown;
};

type TargetRecord = {
  id?: string;
  userId?: string;
  effectiveDate?: string | Date;
  steps?: number | null;
  calories?: number | null;
  protein?: number | null;
  workoutsPerDay?: number | null;
};

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

const DAILY_DEFAULTS = {
  steps: 10_000,
  calories: 1800,
  protein: 165,
  workoutsPerDay: 1,
};

const TARGET_FIELD_OPTIONS = [
  { key: 'steps', label: 'Steps per day' },
  { key: 'calories', label: 'Calories (kcal)' },
  { key: 'protein', label: 'Protein (g)' },
  { key: 'workoutsPerDay', label: 'Workouts per day' },
] as const;

type TargetFieldKey = (typeof TARGET_FIELD_OPTIONS)[number]['key'];

const numberOrUndefined = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export default function SettingsPage() {
  const router = useRouter();
  const auth = db.useAuth();
  const targetIdRef = useRef<string | null>(null);

  const query =
    auth.user && auth.user.id
      ? {
          users: {
            $: {
              where: { id: auth.user.id },
              limit: 1,
            },
          },
          targets: {
            $: {
              where: { userId: auth.user.id },
              limit: 1,
            },
          },
        }
      : null;

  const { data, isLoading } = db.useQuery(query);
  const profile = data?.users?.[0] as UserRecord | undefined;
  const target = data?.targets?.[0] as TargetRecord | undefined;
  useEffect(() => {
    if (target?.id) {
      targetIdRef.current = target.id;
    }
  }, [target?.id]);

  const [profileStatus, setProfileStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [profileMessage, setProfileMessage] = useState('');
  const [targetsStatus, setTargetsStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [targetsMessage, setTargetsMessage] = useState('');
  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      router.replace('/login');
    }
  }, [auth.isLoading, auth.user, router]);

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    if (!auth.user) return;
    event.preventDefault();
    setProfileStatus('saving');
    setProfileMessage('');
    const formData = new FormData(event.currentTarget);
    const weightGoal = (formData.get('weightGoal') as string) ?? '';
    try {
      await db.transact(
        db.tx.users[auth.user.id].update({
          authId: auth.user.id,
          weightGoal: numberOrUndefined(weightGoal),
        }),
      );
      setProfileStatus('saved');
      setProfileMessage('Profile saved.');
    } catch (err: unknown) {
      setProfileStatus('error');
      setProfileMessage(getErrorMessage(err, 'Unable to save profile.'));
    }
  };

  const handleTargetsSave = async (event: FormEvent<HTMLFormElement>) => {
    if (!auth.user) return;
    event.preventDefault();
    setTargetsStatus('saving');
    setTargetsMessage('');
    const formData = new FormData(event.currentTarget);
    try {
      const targetId = target?.id ?? targetIdRef.current ?? instantId();
      targetIdRef.current = targetId;
      await db.transact(
        db.tx.targets[targetId].update({
          userId: auth.user.id,
          effectiveDate: new Date(),
          steps: numberOrUndefined((formData.get('steps') as string) ?? ''),
          calories: numberOrUndefined((formData.get('calories') as string) ?? ''),
          protein: numberOrUndefined((formData.get('protein') as string) ?? ''),
          workoutsPerDay: numberOrUndefined(
            (formData.get('workoutsPerDay') as string) ?? '',
          ),
        }),
      );
      setTargetsStatus('saved');
      setTargetsMessage('Daily targets updated.');
    } catch (err: unknown) {
      setTargetsStatus('error');
      setTargetsMessage(getErrorMessage(err, 'Unable to save targets.'));
    }
  };

  const handleSignOut = async () => {
    await db.auth.signOut();
    router.replace('/');
  };

  const profileDefaults = useMemo(
    () => ({
      weightGoal: profile?.weightGoal?.toString() ?? '',
    }),
    [profile],
  );

  const targetsDefaults = useMemo(
    () => ({
      steps: (target?.steps ?? DAILY_DEFAULTS.steps).toString(),
      calories: (target?.calories ?? DAILY_DEFAULTS.calories).toString(),
      protein: (target?.protein ?? DAILY_DEFAULTS.protein).toString(),
      workoutsPerDay: (
        target?.workoutsPerDay ?? DAILY_DEFAULTS.workoutsPerDay
      ).toString(),
    }),
    [target],
  );

  if (!auth.user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p>Preparing your settings…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-12 pt-6">
      <div className="mx-auto max-w-2xl px-4">
        <AppTabs />

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                className="text-white uppercase"
                style={{
                  fontFamily: '"amplitude-extra-compressed", sans-serif',
                  fontWeight: 700,
                  fontSize: '48px',
                  letterSpacing: 0,
                }}
              >
                Goal
              </h2>
            </div>
            {isLoading && (
              <p className="text-xs text-white/50">Loading current values…</p>
            )}
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleProfileSave}>
            <label className="flex flex-col gap-2 text-sm font-medium text-white/80">
              Weight goal (lbs)
              <input
                name="weightGoal"
                type="number"
                inputMode="decimal"
                defaultValue={profileDefaults.weightGoal}
                placeholder="180"
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base text-white outline-none transition focus:border-indigo-400"
              />
            </label>
            <button
              type="submit"
              disabled={profileStatus === 'saving'}
              className="rounded-2xl bg-indigo-500 px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {profileStatus === 'saving' ? 'Saving…' : 'Save profile'}
            </button>
            {profileMessage && (
              <p
                className={`text-sm ${
                  profileStatus === 'error' ? 'text-red-300' : 'text-green-300'
                }`}
              >
                {profileMessage}
              </p>
            )}
          </form>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                className="text-white uppercase"
                style={{
                  fontFamily: '"amplitude-extra-compressed", sans-serif',
                  fontWeight: 700,
                  fontSize: '48px',
                  letterSpacing: 0,
                }}
              >
                Daily Targets
              </h2>
            </div>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleTargetsSave}>
            <div className="grid gap-4 md:grid-cols-2">
              {TARGET_FIELD_OPTIONS.map((field) => (
                <label
                  key={field.key}
                  className="flex flex-col gap-2 text-sm font-medium text-white/80"
                >
                  {field.label}
                  <input
                    name={field.key}
                    type="number"
                    inputMode="decimal"
                    defaultValue={targetsDefaults[field.key]}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base text-white outline-none transition focus:border-indigo-400"
                  />
                </label>
              ))}
            </div>
            <button
              type="submit"
              disabled={targetsStatus === 'saving'}
              className="rounded-2xl bg-indigo-500 px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {targetsStatus === 'saving' ? 'Saving…' : 'Save targets'}
            </button>
            {targetsMessage && (
              <p
                className={`text-sm ${
                  targetsStatus === 'error' ? 'text-red-300' : 'text-green-300'
                }`}
              >
                {targetsMessage}
              </p>
            )}
          </form>
        </section>

        {/* Integrations removed */}

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2
                className="text-white uppercase"
                style={{
                  fontFamily: '"amplitude-extra-compressed", sans-serif',
                  fontWeight: 700,
                  fontSize: '48px',
                  letterSpacing: 0,
                }}
              >
                Sign Out
              </h2>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-2xl bg-white px-6 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              Sign out
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

