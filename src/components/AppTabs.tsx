'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/log', label: 'Log' },
  { href: '/progress', label: 'Progress' },
  { href: '/settings', label: 'Settings' },
];

export function AppTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-8 border-b border-white/10 pb-3">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative transition ${
              isActive ? 'text-white' : 'text-white/40 hover:text-white/70'
            }`}
            style={{ fontFamily: '"amplitude", sans-serif', fontWeight: 300, fontSize: '18px', letterSpacing: 0 }}
          >
            {tab.label}
            {isActive && (
              <span className="absolute -bottom-3 left-0 right-0 h-0.5" style={{ backgroundColor: '#19E0FF' }} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
