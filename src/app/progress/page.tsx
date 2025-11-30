'use client';

import { useMemo, useState, useCallback } from 'react';
import { db } from '@/lib/instantdb';
import { AppTabs } from '@/components/AppTabs';
type DailyMetric = {
  id?: string;
  userId?: string;
  date?: string | Date;
  entryKey?: string | null;
  steps?: number | null;
  calories?: number | null;
  protein?: number | null;
  workoutMinutes?: number | null;
  weight?: number | null;
  source?: string | null;
  manual?: boolean | null;
  autoSyncedAt?: string | Date | null;
  notes?: string | null;
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

type UserRecord = {
  id?: string;
  authId?: string;
  displayName?: string | null;
  email?: string | null;
  weightGoal?: number | null;
  reminderTimes?: unknown;
};

const MAX_POINTS = 400;

const VIEW_WINDOWS = {
  weekly: 7,
  monthly: 30,
  yearly: 365,
} as const;

type ViewRange = keyof typeof VIEW_WINDOWS;

const formatShortDate = (value?: string | Date | null) => {
  const date = normalizeDate(value);
  if (!date) return '';
  return date.toLocaleDateString(undefined, {
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

type TimelinePoint = {
  label: string;
  value: number | null;
  date?: Date;
};

const normalizeDate = (value?: string | Date | null) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const isoPart = value.includes('T') ? value.slice(0, 10) : value;
    const [yearStr, monthStr, dayStr] = isoPart.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const ChartCard = ({
  label,
  entries,
  accessor,
  goal,
  unit,
  color,
  range,
}: ChartConfig & { entries: DailyMetric[]; range: ViewRange }) => {
  const sortedEntries = useMemo(
    () =>
      entries
        .slice()
        .filter((entry) => entry.date != null)
        .sort((a, b) => {
          const aDate = normalizeDate(a.date)?.getTime() ?? 0;
          const bDate = normalizeDate(b.date)?.getTime() ?? 0;
          return aDate - bDate;
        }),
    [entries],
  );

  const reversedEntries = useMemo(() => [...sortedEntries].reverse(), [sortedEntries]);

  const findLatestEntryBetween = useCallback(
    (start: Date, end: Date) =>
      reversedEntries.find((entry) => {
        const date = normalizeDate(entry.date);
        return date && date >= start && date <= end;
      }),
    [reversedEntries],
  );

  const timeline = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (range === 'weekly') {
      const points: TimelinePoint[] = [];
      for (let offset = 6; offset >= 0; offset -= 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - offset);
        const entry = findLatestEntryBetween(date, date);
        points.push({
          label: formatShortDate(date) ?? '',
          value: entry ? accessor(entry) : null,
          date,
        });
      }
      return points;
    }

    if (range === 'monthly') {
      const points: TimelinePoint[] = [];
      const start = new Date(today);
      start.setDate(today.getDate() - 27);
      start.setHours(0, 0, 0, 0);

      for (let week = 0; week < 4; week += 1) {
        const bucketStart = new Date(start);
        bucketStart.setDate(start.getDate() + week * 7);
        const bucketEnd = new Date(bucketStart);
        bucketEnd.setDate(bucketEnd.getDate() + 6);
        const entry = findLatestEntryBetween(bucketStart, bucketEnd);
        points.push({
          label: `Week ${week + 1}`,
          value: entry ? accessor(entry) : null,
          date: bucketEnd,
        });
      }
      return points;
    }

    const points: TimelinePoint[] = [];
    const startMonth = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    startMonth.setHours(0, 0, 0, 0);

    for (let i = 0; i < 12; i += 1) {
      const monthStart = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
      const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
      const entry = findLatestEntryBetween(monthStart, monthEnd);
      points.push({
        label: monthStart.toLocaleString(undefined, { month: 'short' }),
        value: entry ? accessor(entry) : null,
        date: monthEnd,
      });
    }
    return points;
  }, [accessor, findLatestEntryBetween, range]);

  const values = timeline.map((point) => point.value);
  const available = values.filter(
    (value): value is number => typeof value === 'number' && !Number.isNaN(value),
  );
  const safeGoal = goal ?? null;
  const width = 600;
  const height = 220;
  const padding = 32;
  const xStep = timeline.length > 1 ? (width - padding * 2) / (timeline.length - 1) : 0;
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
      ? timeline
          .map((_, index) => {
            const x = padding + index * xStep;
            const y =
              height - padding - (safeGoal / denominator) * (height - padding * 2);
            return `${x},${y}`;
          })
          .join(' ')
      : '';

  const timelineDates = timeline
    .map((point) => point.date)
    .filter((date): date is Date => Boolean(date));

  const rangeLabel =
    timelineDates.length > 1
      ? `${formatShortDate(timelineDates[0])} – ${formatShortDate(
          timelineDates[timelineDates.length - 1],
        )}`
      : timelineDates.length === 1
      ? formatShortDate(timelineDates[0])
      : 'No data';

  const latestValue = available.length ? available[available.length - 1] : null;
  const tickColumns = timeline.length;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">{label}</p>
          <p
            className="mt-1 text-white"
            style={{
              fontFamily: '"amplitude-extra-compressed", sans-serif',
              fontWeight: 700,
              fontSize: '48px',
              letterSpacing: 0,
            }}
          >
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
      {timeline.length > 0 && actualPoints ? (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="mt-6 h-48 w-full"
            preserveAspectRatio="none"
          >
            <line
              x1={padding}
              y1={height - padding}
              x2={width - padding}
              y2={height - padding}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={1}
            />
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
          <div
            className="mt-3 grid text-[11px] uppercase text-white/40"
            style={{
              gridTemplateColumns: `repeat(${tickColumns}, minmax(0, 1fr))`,
            }}
          >
            {timeline.map((point, index) => (
              <span
                key={`${label}-tick-${index}`}
                className="text-center"
                style={{
                  fontFamily: '"amplitude", sans-serif',
                  fontWeight: 300,
                  letterSpacing: range === 'weekly' ? '0.1em' : '0.2em',
                }}
              >
                {point.label}
              </span>
            ))}
          </div>
        </>
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
  const [viewRange, setViewRange] = useState<ViewRange>('weekly');

  const query =
    auth.user && auth.user.id
      ? {
          dailyMetrics: {
            $: {
              where: {
                userId: auth.user.id,
              },
              limit: MAX_POINTS,
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
    const sorted = list
      .slice()
      .sort((a, b) => {
        const aDate = new Date(`${a.date}T00:00:00`).getTime();
        const bDate = new Date(`${b.date}T00:00:00`).getTime();
        return aDate - bDate;
      });
    const windowDays = VIEW_WINDOWS[viewRange];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (windowDays - 1));
    return sorted.filter((entry) => {
      const entryDate = new Date(`${entry.date}T00:00:00`);
      return entryDate >= cutoff;
    });
  }, [data?.dailyMetrics, viewRange]);

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
          <>
            <div className="mt-8 flex items-center gap-3">
              {(
                [
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                  { id: 'yearly', label: 'Yearly' },
                ] as { id: ViewRange; label: string }[]
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setViewRange(id)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${
                    viewRange === id
                      ? 'border-cyan-300/60 bg-cyan-300/10 text-white'
                      : 'border-white/20 text-white/60 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <section className="mt-6 grid gap-6">
              {chartConfigs.map(({ key, ...rest }) => (
                <ChartCard key={key} {...rest} entries={metrics} range={viewRange} />
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

