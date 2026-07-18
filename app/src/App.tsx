import { Component, Suspense, lazy, useEffect, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { formatDateWIB, todayWIB } from './lib/date'
import { useReceivablesStore } from './store/receivables'
import BottomNav from './components/BottomNav'
import LoginPage from './pages/LoginPage' // eager: layar pertama saat belum login

// Retry sekali kalau chunk gagal dimuat (chunk basi setelah deploy + service worker autoUpdate).
function lazyWithRetry<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory()
      sessionStorage.removeItem('chunk-reloaded')
      return mod
    } catch (err) {
      if (!sessionStorage.getItem('chunk-reloaded')) {
        sessionStorage.setItem('chunk-reloaded', '1')
        window.location.reload()
      }
      throw err
    }
  })
}

const JualPage = lazyWithRetry(() => import('./pages/JualPage'))
const StokPage = lazyWithRetry(() => import('./pages/StokPage'))
const RekapPage = lazyWithRetry(() => import('./pages/RekapPage'))
const LainnyaPage = lazyWithRetry(() => import('./pages/LainnyaPage'))
const PiutangPage = lazyWithRetry(() => import('./pages/PiutangPage'))
const PelangganPage = lazyWithRetry(() => import('./pages/PelangganPage'))
const PelangganDetailPage = lazyWithRetry(() => import('./pages/PelangganDetailPage'))
const ExportPage = lazyWithRetry(() => import('./pages/ExportPage'))
const AsetPage = lazyWithRetry(() => import('./pages/AsetPage'))

function PageFallback() {
  return <div className="flex min-h-[60vh] items-center justify-center text-muted">Memuat…</div>
}

// Menangkap error render/chunk lazi yang gagal (Suspense tidak menangkap error).
// Ditempatkan di dalam <main> agar header & BottomNav tetap ada sebagai jalur pemulihan.
class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center text-muted">
          <p>Gagal memuat halaman ini. Coba muat ulang.</p>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem('chunk-reloaded')
              window.location.reload()
            }}
            className="min-h-11 rounded-full bg-brand px-5 font-bold text-white shadow-[0_6px_16px_rgba(226,81,126,.28)] active:bg-brand-dark"
          >
            Muat ulang
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function AppShell() {
  const refreshReceivables = useReceivablesStore((s) => s.refresh)
  useEffect(() => {
    refreshReceivables()
  }, [refreshReceivables])

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-surface">
      <header className="sticky top-0 z-10 border-b border-line-2 bg-[rgba(251,246,247,.92)] px-5 pt-3.5 pb-2.5 backdrop-blur-[8px]">
        <div className="flex items-center gap-3">
          <img src="/logo-pink.png" alt="" className="h-[38px] w-[38px] rounded-[12px]" />
          <div>
            <h1 className="text-[17px] font-extrabold tracking-[-.01em] text-ink">JE&amp;DA</h1>
            <p className="text-xs font-medium text-muted">{formatDateWIB(todayWIB())}</p>
          </div>
          <div className="flex-1" />
          <span className="rounded-full bg-money-tint px-3 py-1.5 text-xs font-bold text-money-dark">
            Buka
          </span>
        </div>
      </header>
      <main className="flex-1 px-4 py-4 pb-24">
        {/* Boundary + Suspense HANYA membungkus Routes agar header & BottomNav tetap ter-mount */}
        <RouteErrorBoundary>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/jual" replace />} />
              <Route path="/jual" element={<JualPage />} />
              <Route path="/stok" element={<StokPage />} />
              <Route path="/rekap" element={<RekapPage />} />
              <Route path="/lainnya" element={<LainnyaPage />} />
              <Route path="/lainnya/piutang" element={<PiutangPage />} />
              <Route path="/lainnya/pelanggan" element={<PelangganPage />} />
              <Route path="/lainnya/pelanggan/:id" element={<PelangganDetailPage />} />
              <Route path="/lainnya/aset" element={<AsetPage />} />
              <Route path="/lainnya/ekspor" element={<ExportPage />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </main>
      <BottomNav />
    </div>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface text-muted">
        Memuat…
      </div>
    )
  }
  if (!session) return <LoginPage />
  return <AppShell />
}

export default App
