import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useReceivablesStore } from '../store/receivables'

const tabs: { to: string; label: string; icon: ReactNode }[] = [
  {
    to: '/jual',
    label: 'Jual',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
  },
  {
    to: '/stok',
    label: 'Stok',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    ),
  },
  {
    to: '/rekap',
    label: 'Rekap',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d="M3 3v16a2 2 0 0 0 2 2h16" />
        <path d="M7 15v-4" />
        <path d="M12 15V7" />
        <path d="M17 15v-6" />
      </svg>
    ),
  },
  {
    to: '/lainnya',
    label: 'Lainnya',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <circle cx="12" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const receivablesCount = useReceivablesStore((s) => s.count)
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4">
        {tabs.map((tab) => {
          const badge = tab.to === '/lainnya' && receivablesCount > 0 ? receivablesCount : 0
          return (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  `relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                    isActive ? 'text-brand' : 'text-gray-500'
                  }`
                }
              >
                <span className="relative">
                  {tab.icon}
                  {badge > 0 && (
                    <span
                      aria-label={`${badge} piutang`}
                      className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
                    >
                      {badge}
                    </span>
                  )}
                </span>
                {tab.label}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
