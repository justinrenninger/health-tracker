'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/instantdb';
import { id as instantId } from '@instantdb/react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppTabs } from '@/components/AppTabs';
import Image from 'next/image';

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

type MetricField = 'steps' | 'calories' | 'protein' | 'workoutMinutes' | 'weight';

const isoDateString = (date: Date) => date.toISOString().slice(0, 10);

const parseIsoDate = (value: string) => new Date(`${value}T00:00:00`);

const addDays = (value: string, delta: number) => {
  const next = parseIsoDate(value);
  next.setDate(next.getDate() + delta);
  return isoDateString(next);
};

const getRelativeLabel = (value: string, today: string) => {
  const diffMs = parseIsoDate(value).getTime() - parseIsoDate(today).getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'TODAY';
  if (diffDays === -1) return 'YESTERDAY';
  if (diffDays === 1) return 'TOMORROW';
  return parseIsoDate(value).toLocaleDateString(undefined, {
    weekday: 'long',
  }).toUpperCase();
};

const formatCarouselDate = (value: string) =>
  parseIsoDate(value)
    .toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    .replace(' ', ' ')
    .toUpperCase();

type StatusColor = 'green' | 'yellow' | 'red';
type GoalStatus = { color: StatusColor; message: string };

const formatNumber = (value?: number, decimals = 0) =>
  value != null ? value.toLocaleString(undefined, { maximumFractionDigits: decimals }) : '';

// Add units to display values without affecting input editing
const formatWithUnit = (field: MetricField, value: string): string => {
  if (!value || value === '—') return value;
  switch (field) {
    case 'protein':
      return `${value}g`;
    case 'weight':
      return `${value} lbs`;
    case 'workoutMinutes':
      return `${value} min`;
    default:
      return value;
  }
};

// Remove any trailing units before numeric parsing
const stripUnits = (value: string): string => value.replace(/\s*(g|lbs|min)\s*$/i, '').trim();

const formatWithCommas = (value: string) => {
  if (!value) return '';
  const parts = value.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

const numericOrNull = (value: string) => {
  const trimmed = stripUnits(value.replace(/,/g, '')).trim();
  if (trimmed === '' || trimmed === '0') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
};

const getWeightStatus = (current?: number, previous?: number): GoalStatus => {
  if (current == null) return { color: 'yellow', message: 'No data' };
  if (previous == null) return { color: 'yellow', message: 'No prior day' };
  const diff = current - previous;
  if (diff > 0.2) return { color: 'red', message: '↑ Increased' };
  if (diff < -0.2) return { color: 'green', message: '↓ Decreased' };
  return { color: 'yellow', message: '→ Stable' };
};

const getProteinStatus = (actual?: number, goal?: number): GoalStatus => {
  if (actual == null) return { color: 'yellow', message: 'Not logged' };
  const g = goal ?? DAILY_DEFAULTS.protein;
  if (actual >= g) return { color: 'green', message: '✓ Met goal' };
  if (actual >= g - 20) return { color: 'yellow', message: '~ Close' };
  return { color: 'red', message: '✗ Below' };
};

const getCaloriesStatus = (actual?: number, goal?: number): GoalStatus => {
  if (actual == null) return { color: 'yellow', message: 'Not logged' };
  const g = goal ?? DAILY_DEFAULTS.calories;
  if (actual <= g) return { color: 'green', message: '✓ At/below' };
  if (actual <= g + 100) return { color: 'yellow', message: '~ Close' };
  return { color: 'red', message: '✗ Over' };
};

const WORKOUT_GOAL_MINUTES = 20;
const WORKOUT_NEAR_THRESHOLD = 10;

const getWorkoutStatus = (minutes?: number, goal = WORKOUT_GOAL_MINUTES): GoalStatus => {
  if (minutes == null || minutes <= 0) {
    return { color: 'red', message: '✗ Incomplete' };
  }

  if (minutes >= goal) {
    return { color: 'green', message: '✓ Complete' };
  }

  if (minutes >= WORKOUT_NEAR_THRESHOLD) {
    return { color: 'yellow', message: '~ Almost there' };
  }

  return { color: 'red', message: '✗ Below goal' };
};

const getStepsStatus = (actual?: number, goal?: number): GoalStatus => {
  if (actual == null) return { color: 'yellow', message: 'Not logged' };
  const g = goal ?? DAILY_DEFAULTS.steps;
  if (actual >= g) return { color: 'green', message: '✓ Met goal' };
  if (actual >= g - 500) return { color: 'yellow', message: '~ Close' };
  return { color: 'red', message: '✗ Under' };
};

export default function LogPage() {
  const router = useRouter();
  const auth = db.useAuth();
  const [localDate, setLocalDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => isoDateString(new Date()));
  const [lastSavedEntry, setLastSavedEntry] = useState<DailyMetric | null>(null);
  const [carouselDirection, setCarouselDirection] = useState<1 | -1>(1);
  const [editingField, setEditingField] = useState<MetricField | null>(null);
  const [editValues, setEditValues] = useState<Record<MetricField, string>>({
    steps: '',
    calories: '',
    protein: '',
    workoutMinutes: '',
    weight: '',
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');
  const inputRefs = useRef<Record<MetricField, HTMLInputElement | null>>({
    steps: null,
    calories: null,
    protein: null,
    workoutMinutes: null,
    weight: null,
  });
  const todayString = isoDateString(localDate);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const timeout = nextMidnight.getTime() - now.getTime();
    const timer = setTimeout(() => {
      const freshDate = new Date();
      const newToday = isoDateString(freshDate);
      setLocalDate(freshDate);
      setSelectedDate((prev) => (prev >= newToday ? newToday : prev));
    }, timeout);
    return () => clearTimeout(timer);
  }, [localDate]);

  const query =
    auth.user && auth.user.id
      ? {
          dailyMetrics: {
            $: {
              where: {
                userId: auth.user.id,
                date: new Date(selectedDate),
              },
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

  const { data } = db.useQuery(query);
  const existingEntry = data?.dailyMetrics?.[0] as DailyMetric | undefined;
  const personalTarget = data?.targets?.[0] as TargetRecord | undefined;

  const previousQuery =
    auth.user && auth.user.id
      ? {
          dailyMetrics: {
            $: {
              where: {
                userId: auth.user.id,
                date: new Date(addDays(selectedDate, -1)),
              },
              limit: 1,
            },
          },
        }
      : null;
  const { data: prevData } = db.useQuery(previousQuery);
  const previousEntry = prevData?.dailyMetrics?.[0] as DailyMetric | undefined;

  const targetValues = useMemo(
    () => ({
      steps: personalTarget?.steps ?? DAILY_DEFAULTS.steps,
      calories: personalTarget?.calories ?? DAILY_DEFAULTS.calories,
      protein: personalTarget?.protein ?? DAILY_DEFAULTS.protein,
      workoutsPerDay:
        personalTarget?.workoutsPerDay ?? DAILY_DEFAULTS.workoutsPerDay,
    }),
    [personalTarget],
  );

  useEffect(() => {
    if (!auth.isLoading && !auth.user) {
      router.replace('/login');
    }
  }, [auth.isLoading, auth.user, router]);

  const summaryEntry = useMemo(() => {
    const candidates: DailyMetric[] = [];
    if (lastSavedEntry) candidates.push(lastSavedEntry);
    if (existingEntry) candidates.push(existingEntry);
    return (
      candidates.find((entry) => {
        if (!entry?.date) return false;
        const entryDate =
          typeof entry.date === 'string'
            ? entry.date.slice(0, 10)
            : new Date(entry.date).toISOString().slice(0, 10);
        return entryDate === selectedDate;
      }) ?? null
    );
  }, [existingEntry, lastSavedEntry, selectedDate]);

  // Get current values from entry or use empty strings
  const getCurrentValue = (field: MetricField): string => {
    if (editingField === field) {
      return editValues[field];
    }
    // Only return saved entry value, don't fallback to previous day
    const value = summaryEntry?.[field];
    return value != null ? value.toString() : '';
  };

  const metricStatusData = useMemo(() => {
    const stepsValue = numericOrNull(getCurrentValue('steps'));
    const weightValue = numericOrNull(getCurrentValue('weight'));
    const caloriesValue = numericOrNull(getCurrentValue('calories'));
    const proteinValue = numericOrNull(getCurrentValue('protein'));
    const workoutValue = numericOrNull(getCurrentValue('workoutMinutes'));

    return [
      {
        key: 'steps' as MetricField,
        label: 'Steps',
        hasCheckmark: stepsValue != null && stepsValue > 0,
        valueText: stepsValue != null && stepsValue > 0 ? formatNumber(stepsValue) : '',
        hasValue: stepsValue != null && stepsValue > 0,
        placeholderText: previousEntry?.steps != null ? formatNumber(previousEntry.steps) : '',
        goalText: `${Math.round(targetValues.steps / 1000)}k`,
        status: getStepsStatus(stepsValue ?? undefined, targetValues.steps),
      },
      {
        key: 'weight' as MetricField,
        label: 'Weight',
        hasCheckmark: weightValue != null && weightValue > 0,
        valueText: weightValue != null && weightValue > 0 ? formatNumber(weightValue, 1) : '',
        hasValue: weightValue != null && weightValue > 0,
        placeholderText: previousEntry?.weight != null ? formatNumber(previousEntry.weight, 1) : '',
        goalText: `${formatNumber(personalTarget?.weightGoal ?? 160)} lbs`,
        status: getWeightStatus(weightValue ?? undefined, previousEntry?.weight ?? undefined),
      },
      {
        key: 'calories' as MetricField,
        label: 'Calories',
        hasCheckmark: caloriesValue != null && caloriesValue > 0,
        valueText: caloriesValue != null && caloriesValue > 0 ? formatNumber(caloriesValue) : '',
        hasValue: caloriesValue != null && caloriesValue > 0,
        placeholderText: formatNumber(previousEntry?.calories),
        goalText: `${formatNumber(targetValues.calories)}`,
        status: getCaloriesStatus(caloriesValue ?? undefined, targetValues.calories),
      },
      {
        key: 'protein' as MetricField,
        label: 'Protein (g)',
        hasCheckmark: proteinValue != null && proteinValue > 0,
        valueText: proteinValue != null && proteinValue > 0 ? formatNumber(proteinValue) : '',
        hasValue: proteinValue != null && proteinValue > 0,
        placeholderText: previousEntry?.protein != null ? formatNumber(previousEntry.protein) : '',
        goalText: `${formatNumber(targetValues.protein)}g`,
        status: getProteinStatus(proteinValue ?? undefined, targetValues.protein),
      },
      {
        key: 'workoutMinutes' as MetricField,
        label: 'Workout',
        hasCheckmark: workoutValue != null && workoutValue > 0,
        valueText: workoutValue != null && workoutValue > 0 ? formatNumber(workoutValue) : '',
        hasValue: workoutValue != null && workoutValue > 0,
        placeholderText:
          previousEntry?.workoutMinutes != null ? formatNumber(previousEntry.workoutMinutes) : '',
        goalText: '20 min / day',
        status: getWorkoutStatus(workoutValue ?? undefined, WORKOUT_GOAL_MINUTES),
      },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetValues, previousEntry, personalTarget, summaryEntry, editingField, editValues, getCurrentValue]);

  const handleFieldClick = (field: MetricField) => {
    // Only use the saved value if it exists, otherwise start with empty string
    const savedValue = summaryEntry?.[field];
    let currentValue = savedValue != null ? savedValue.toString() : '';
    
    if (currentValue) {
      currentValue =
        field === 'weight' ? currentValue : formatWithCommas(currentValue);
    }
    
    setEditValues((prev) => ({ ...prev, [field]: currentValue }));
    setEditingField(field);
    setTimeout(() => {
      inputRefs.current[field]?.focus();
      if (currentValue) {
        inputRefs.current[field]?.select();
      }
    }, 0);
  };

  const handleFieldChange = (field: MetricField, value: string) => {
    const numericValue = stripUnits(value).replace(/[^\d.]/g, '');
    const formattedValue =
      field === 'weight' ? numericValue : formatWithCommas(numericValue);
    
    setEditValues((prev) => ({ ...prev, [field]: formattedValue }));
  };

  const handleFieldBlur = async () => {
    setEditingField(null);
    await saveEntry();
  };

  const handleFieldKeyDown = (field: MetricField, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRefs.current[field]?.blur();
    } else if (e.key === 'Escape') {
      setEditingField(null);
      // Reset to saved value on escape
      const savedValue =
        summaryEntry?.[field] != null
          ? summaryEntry[field]?.toString() ?? ''
          : '';
      const formatted =
        savedValue && field !== 'weight'
          ? formatWithCommas(savedValue)
          : savedValue;
      setEditValues((prev) => ({ ...prev, [field]: formatted }));
    }
  };

  const saveEntry = async () => {
    if (!auth.user) return;
    
    setSaveStatus('saving');
    setSaveMessage('');
    const entryId = existingEntry?.id ?? instantId();
    
    try {
      // Preserve existing values and only update the edited ones
      const updatedEntry: DailyMetric = {
        ...(existingEntry ?? { id: entryId }),
        id: entryId,
        userId: auth.user.id,
        date: new Date(selectedDate).toISOString(),
        entryKey: existingEntry?.entryKey ?? `${auth.user.id}-${selectedDate}`,
        steps: numericOrNull(getCurrentValue('steps')) ?? undefined,
        calories: numericOrNull(getCurrentValue('calories')) ?? undefined,
        protein: numericOrNull(getCurrentValue('protein')) ?? undefined,
        workoutMinutes: numericOrNull(getCurrentValue('workoutMinutes')) ?? undefined,
        weight: numericOrNull(getCurrentValue('weight')) ?? undefined,
        manual: true,
        source: 'manual',
      };

      await db.transact(db.tx.dailyMetrics[entryId].update(updatedEntry));
      setSaveStatus('saved');
      setSaveMessage('Saved!');
      setLastSavedEntry(updatedEntry);
      
      setTimeout(() => {
        setSaveStatus('idle');
        setSaveMessage('');
      }, 2000);
    } catch (err: unknown) {
      setSaveStatus('error');
      setSaveMessage(getErrorMessage(err, 'Unable to save right now.'));
    }
  };

  const canGoNext = selectedDate < todayString;
  const relativeLabel = getRelativeLabel(selectedDate, todayString);

  const handleShiftDate = (delta: number) => {
    if (delta > 0 && !canGoNext) return;
    setCarouselDirection(delta > 0 ? 1 : -1);
    setSelectedDate((prev) => addDays(prev, delta));
    setEditingField(null);
    setSaveStatus('idle');
    setSaveMessage('');
  };

  const prevDate = addDays(selectedDate, -1);
  const nextDate = addDays(selectedDate, 1);

  const statusColors: Record<StatusColor, string> = {
    green: 'bg-[#19FF94]',
    yellow: 'bg-[#FFC107]',
    red: 'bg-[#FF5252]',
  };

  if (auth.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-white/60">Loading...</p>
      </main>
    );
  }

  if (!auth.user) {
    return null;
  }

  return (
    <main className="min-h-screen pb-12 pt-6">
      <div className="mx-auto max-w-2xl px-4">
        <AppTabs />

        {/* Date Carousel */}
        <section className="flex flex-col items-center py-8">
          <p className="uppercase text-white/50" style={{ fontFamily: '"amplitude", sans-serif', fontWeight: 300, fontSize: '18px', letterSpacing: 0 }}>
            {relativeLabel}
          </p>
          <div className="relative flex w-full items-center justify-between" style={{ paddingBottom: '12px' }}>
            <button
              type="button"
              onClick={() => handleShiftDate(-1)}
              className="absolute left-0 text-white/40 transition hover:text-white"
            >
              <Image src="/arrow-left-right.svg" alt="Previous" width={14} height={24} style={{ transform: 'rotate(180deg)' }} />
            </button>

            <div className="flex w-full items-center justify-center gap-6">
              <span
                className="uppercase"
                style={{ 
                  fontFamily: '"amplitude-extra-compressed", sans-serif', 
                  fontWeight: 700, 
                  fontSize: '46px',
                  letterSpacing: 0,
                  opacity: 0.5,
                  background: 'linear-gradient(to top, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 1) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}
              >
                {formatCarouselDate(prevDate)}
              </span>

              <div className="relative overflow-hidden" style={{ width: '220px', height: '60px' }}>
                <AnimatePresence initial={false} custom={carouselDirection}>
                  <motion.span
                    key={selectedDate}
                    custom={carouselDirection}
                    initial={{ x: carouselDirection > 0 ? 200 : -200, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: carouselDirection > 0 ? -200 : 200, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="absolute inset-0 flex items-center justify-center uppercase text-white"
                    style={{ fontFamily: '"amplitude-extra-compressed", sans-serif', fontWeight: 700, fontSize: '70px', letterSpacing: 0 }}
                  >
                    {formatCarouselDate(selectedDate)}
                  </motion.span>
                </AnimatePresence>
              </div>

              <span
                className="uppercase"
                style={{ 
                  fontFamily: '"amplitude-extra-compressed", sans-serif', 
                  fontWeight: 700, 
                  fontSize: '46px',
                  letterSpacing: 0,
                  opacity: canGoNext ? 0.5 : 0,
                  background: 'linear-gradient(to top, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 1) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  visibility: canGoNext ? 'visible' : 'hidden'
                }}
              >
                {formatCarouselDate(nextDate)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleShiftDate(1)}
              disabled={!canGoNext}
              className="absolute right-0 text-white/40 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
            >
              <Image src="/arrow-left-right.svg" alt="Next" width={14} height={24} />
            </button>
          </div>

          {/* Chevron indicator with horizontal lines */}
          <div className="flex w-full items-center justify-center">
            <div className="h-px flex-1 bg-white/20" style={{ marginTop: '12px' }} />
            <Image src="/arrow-up.svg" alt="" width={53} height={14} />
            <div className="h-px flex-1 bg-white/20" style={{ marginTop: '12px' }} />
          </div>
        </section>

        {/* Metrics Display - Inline Editable */}
        <section className="mt-6 space-y-6">
          {metricStatusData.map((metric) => {
            const displayValue = metric.hasValue
              ? formatWithUnit(metric.key, metric.valueText)
              : metric.placeholderText
              ? formatWithUnit(metric.key, metric.placeholderText)
              : '—';

            return (
            <div
              key={metric.key}
              className="flex items-start justify-between border-b border-white/10 pb-3"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-white/60" style={{ fontFamily: '"amplitude", sans-serif', fontWeight: 300, fontSize: '20px', letterSpacing: 0 }}>
                    {metric.label}
                  </span>
                  {metric.hasCheckmark && (
                    <Image src="/checkmark.svg" alt="Complete" width={19} height={19} />
                  )}
                </div>
                
                <div className="relative overflow-visible" style={{ minHeight: '80px', width: '100%', maxWidth: '600px' }}>
                  {editingField === metric.key ? (
                    <input
                      ref={(el) => { inputRefs.current[metric.key] = el; }}
                      type="text"
                      inputMode="decimal"
                      value={editValues[metric.key]}
                      onChange={(e) => handleFieldChange(metric.key, e.target.value)}
                      onBlur={() => handleFieldBlur()}
                      onKeyDown={(e) => handleFieldKeyDown(metric.key, e)}
                      className="w-full bg-transparent leading-none text-white outline-none"
                      style={{ 
                        fontFamily: '"amplitude-extra-compressed", sans-serif', 
                        fontWeight: 700, 
                        letterSpacing: '0.02em',
                        padding: 0,
                        margin: 0,
                        border: 'none',
                        height: 'auto',
                        lineHeight: '1',
                        fontSize: '70px',
                        minWidth: '400px',
                        textTransform: 'none'
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleFieldClick(metric.key)}
                      className="absolute top-0 left-0 text-left leading-none transition hover:text-white/80"
                      style={{ 
                        fontFamily: '"amplitude-extra-compressed", sans-serif', 
                        fontWeight: 700, 
                        letterSpacing: '0.02em',
                        padding: 0,
                        margin: 0,
                        border: 'none',
                        background: 'transparent',
                        lineHeight: '1',
                        fontSize: '70px',
                        textTransform: 'none',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {metric.hasValue ? (
                        <span className="text-white">{displayValue}</span>
                      ) : (
                        <span className="text-white/20">{displayValue}</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`px-3 py-1.5 font-medium ${metric.hasValue ? statusColors[metric.status.color] : 'bg-white/40'} text-black`}
                  style={{ fontFamily: '"amplitude", sans-serif', fontWeight: 300, fontSize: '18px' }}
                >
                  {metric.goalText}
                </span>
              </div>
            </div>
          )})}

          {saveMessage && (
            <p
              className={`text-center text-sm ${
                saveStatus === 'error' ? 'text-rose-300' : 'text-emerald-300'
              }`}
              style={{ fontFamily: '"amplitude", sans-serif', fontWeight: 300 }}
            >
              {saveMessage}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
