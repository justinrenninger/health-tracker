'use client';

import { useMemo } from 'react';
import { db, type AppSchema } from '@/lib/instantdb';
import { AppTabs } from '@/components/AppTabs';

type DailyMetric = AppSchema['entities']['dailyMetrics']['shape'];
type TargetRecord = AppSchema['entities']['targets']['shape'];
type UserRecord = AppSchema['entities']['users']['shape'];

const MAX_POINTS = 30;

const formatShortDate = (value?: string | null) => {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

type ChartConfig = {
  key: 'weight' | 'protein' | 'calories' | 'steps';
  label: string;
  accessor: (entry: DailyMetric) => number | null;
  goal?: number | null;
  unit: string;
  color: string;
};

const ChartCard = ({
  label,
  entries,
  accessor,
  goal,
  unit,
  color,
}: ChartConfig & { entries: DailyMetric[] }) => {
  const values = entries.map((entry) => accessor(entry));
  const available = values.filter(
    (value): value is number => typeof value === 'number' && !Number.isNaN(value),
  );
  const safeGoal = goal ?? null;
  const width = 600;
  const height = 220;
  const padding = 32;
  const xStep = entries.length > 1 ? (width - padding * 2) / (entries.length - 1) : 0;
  const maxVal = Math.max(
    safeGoal ?? 0,
    available.length ? Math.max(...available) : 0,
  );
  const denominator = maxVal > 0 ? maxVal : 1;

  const actualPoints = values
    .map((value, index) => {
      if (value == null) return null;
      const x = padding + index * xStep;
      const y =
        height - padding - (value / denominator) * (height - padding * 2);
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(' ');

  const goalPoints =
    safeGoal != null
      ? entries
          .map((_, index) => {
            const x = padding + index * xStep;
            const y =
              height - padding - (safeGoal / denominator) * (height - padding * 2);
            return `${x},${y}`;
          })
          .join(' ')
      : '';

  const latestValue = available.length ? available[available.length - 1] : null;
  const rangeLabel =
    entries.length > 1
      ? `${formatShortDate(entries[0].date)} – ${formatShortDate(
          entries[entries.length - 1].date,
        )}`
      : entries.length === 1
      ? formatShortDate(entries[0].date)
      : 'No data';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {latestValue != null ? `${latestValue.toFixed(unit === 'lbs' ? 1 : 0)} ${unit}` : '—'}
          </p>
          <p className="text-xs text-white/50">{rangeLabel}</p>
        </div>
        {safeGoal != null && (
          <div className="text-right text-xs text-white/60">
            Goal: {safeGoal.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
          </div>
        )}
      </div>
      {entries.length > 0 && actualPoints ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mt-6 h-48 w-full"
          preserveAspectRatio="none"
        >
          {goalPoints && (
            <polyline
              points={goalPoints}
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={2}
              strokeDasharray="6 6"
            />
          )}
          <polyline
            points={actualPoints}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {values.map((value, index) => {
            if (value == null) return null;
            const x = padding + index * xStep;
            const y =
              height - padding - (value / denominator) * (height - padding * 2);
            return (
              <circle key={index} cx={x} cy={y} r={4} fill={color} opacity={0.9} />
            );
          })}
        </svg>
      ) : (
        <p className="mt-6 text-sm text-white/60">
          Not enough data to chart this metric yet.
        </p>
      )}
    </div>
  );
};

export default function ProgressPage() {
  const auth = db.useAuth();

  const query =
    auth.user && auth.user.id
      ? {
          dailyMetrics: {
            $: {
              where: {
                userId: auth.user.id,
              },
              limit: 90,
            },
          },
          targets: {
            $: {
              where: { userId: auth.user.id },
              limit: 1,
            },
          },
          users: {
            $: {
              where: { id: auth.user.id },
              limit: 1,
            },
          },
        }
      : null;

  const { data, isLoading } = db.useQuery(query);

  const metrics = useMemo(() => {
    const list = (data?.dailyMetrics ?? []).filter(
      (entry) => entry.date != null,
    ) as DailyMetric[];
    return list
      .slice()
      .sort((a, b) => {
        const aDate = new Date(`${a.date}T00:00:00`).getTime();
        const bDate = new Date(`${b.date}T00:00:00`).getTime();
        return aDate - bDate;
      })
      .slice(-MAX_POINTS);
  }, [data?.dailyMetrics]);

  const target = data?.targets?.[0] as TargetRecord | undefined;
  const profile = data?.users?.[0] as UserRecord | undefined;

  const chartConfigs: ChartConfig[] = [
    {
      key: 'weight',
      label: 'Weight (lbs)',
      accessor: (entry) => (entry.weight != null ? Number(entry.weight) : null),
      goal: profile?.weightGoal ?? null,
      unit: 'lbs',
      color: '#34d399',
    },
    {
      key: 'protein',
      label: 'Protein (g)',
      accessor: (entry) => (entry.protein != null ? Number(entry.protein) : null),
      goal: target?.protein ?? null,
      unit: 'g',
      color: '#a78bfa',
    },
    {
      key: 'calories',
      label: 'Calories',
      accessor: (entry) => (entry.calories != null ? Number(entry.calories) : null),
      goal: target?.calories ?? null,
      unit: 'kcal',
      color: '#f472b6',
    },
    {
      key: 'steps',
      label: 'Steps',
      accessor: (entry) => (entry.steps != null ? Number(entry.steps) : null),
      goal: target?.steps ?? null,
      unit: 'steps',
      color: '#60a5fa',
    },
  ];

  if (!auth.user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p>Preparing your progress…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-12 pt-6">
      <div className="mx-auto max-w-2xl px-4">
        <AppTabs />

        {isLoading && (
          <p className="mt-8 text-sm text-white/60">Loading recent metrics…</p>
        )}

        {metrics.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-white/80">
              There isn&apos;t enough data to show trends yet. Log a few days
              of entries to unlock this view.
            </p>
          </section>
        ) : (
          <section className="mt-8 grid gap-6">
            {chartConfigs.map(({ key, ...rest }) => (
              <ChartCard key={key} {...rest} entries={metrics} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

