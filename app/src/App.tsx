import { Component, Suspense, lazy, useEffect, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
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

function PageFallback() {
  return <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Memuat…</div>
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
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center text-gray-500">
          <p>Gagal memuat halaman ini. Coba muat ulang.</p>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem('chunk-reloaded')
              window.location.reload()
            }}
            className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-white"
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
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-brand px-4 py-3 text-white shadow">
        <h1 className="text-lg font-bold">JE&amp;DA</h1>
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
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 text-gray-500">
        Memuat…
      </div>
    )
  }
  if (!session) return <LoginPage />
  return <AppShell />
}

export default App
