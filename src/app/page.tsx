import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto flex h-full max-w-4xl flex-col items-center justify-center px-6 py-24 text-center">
        <p className="rounded-full border border-white/10 px-4 py-1 text-sm uppercase tracking-[0.2em] text-indigo-300">
          Health Tracker
        </p>
        <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">
          Track steps, nutrition, workouts, and weight in one place.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-white/70">
          InstantDB-backed insights, daily reminders, and weekly summaries help
          you hit your targets faster. Sign in to start logging today.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/login"
            className="rounded-full bg-indigo-500 px-6 py-3 text-base font-medium text-white transition hover:bg-indigo-400"
          >
            Sign in to continue
          </Link>
          <Link
            href="/log"
            className="rounded-full border border-white/20 px-6 py-3 text-base font-medium text-white/80 transition hover:border-white/60 hover:text-white"
          >
            Preview dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
