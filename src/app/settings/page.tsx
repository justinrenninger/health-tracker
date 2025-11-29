'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, type AppSchema } from '@/lib/instantdb';
import { AppTabs } from '@/components/AppTabs';

type UserRecord = AppSchema['entities']['users']['shape'];
type TargetRecord = AppSchema['entities']['targets']['shape'];

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

const numberOrUndefined = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const remindersToInput = (reminders?: unknown): string => {
  if (!Array.isArray(reminders)) return '';
  return reminders.join(', ');
};

const remindersFromInput = (value: string): string[] | undefined => {
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
};

export default function SettingsPage() {
  const router = useRouter();
  const auth = db.useAuth();

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
    const displayName = (formData.get('displayName') as string) ?? '';
    const weightGoal = (formData.get('weightGoal') as string) ?? '';
    const remindersInput = (formData.get('reminderTimes') as string) ?? '';
    try {
      await db.transact(
        db.tx.users[auth.user.id].update({
          authId: auth.user.id,
          email: auth.user.email ?? profile?.email,
          displayName: displayName || undefined,
          weightGoal: numberOrUndefined(weightGoal),
          reminderTimes: remindersFromInput(remindersInput),
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
      await db.transact(
        db.tx.targets[`targets-${auth.user.id}`].update({
          userId: auth.user.id,
          effectiveDate: new Date().toISOString().slice(0, 10),
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
      displayName: profile?.displayName ?? '',
      weightGoal: profile?.weightGoal?.toString() ?? '',
      reminderTimes: remindersToInput(profile?.reminderTimes),
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

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Profile & reminders</h2>
              <p className="text-sm text-white/70">
                Name, weight goal, and notification windows.
              </p>
            </div>
            {isLoading && (
              <p className="text-xs text-white/50">Loading current values…</p>
            )}
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleProfileSave}>
            <label className="flex flex-col gap-2 text-sm font-medium text-white/80">
              Display name
              <input
                name="displayName"
                type="text"
                defaultValue={profileDefaults.displayName}
                placeholder="Coach, athlete, etc."
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-base text-white outline-none transition focus:border-indigo-400"
              />
            </label>
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
            <label className="flex flex-col gap-2 text-sm font-medium text-white/80">
              Reminder times (comma separated, 24h clock)
              <input
                name="reminderTimes"
                type="text"
                defaultValue={profileDefaults.reminderTimes}
                placeholder="07:30, 20:30"
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

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Daily targets</h2>
              <p className="text-sm text-white/70">
                Customize the default metrics you see on the log.
              </p>
            </div>
          </div>
          <form className="mt-6 space-y-4" onSubmit={handleTargetsSave}>
            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  { key: 'steps', label: 'Steps per day' },
                  { key: 'calories', label: 'Calories (kcal)' },
                  { key: 'protein', label: 'Protein (g)' },
                  { key: 'workoutsPerDay', label: 'Workouts per day' },
                ] as const
              ).map((field) => (
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

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Sign out</h2>
              <p className="text-sm text-white/70">
                Log out if you want to switch accounts or take a break.
              </p>
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

