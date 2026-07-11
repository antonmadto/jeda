import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useReceivablesStore } from './store/receivables'
import BottomNav from './components/BottomNav'
import LoginPage from './pages/LoginPage'
import JualPage from './pages/JualPage'
import StokPage from './pages/StokPage'
import RekapPage from './pages/RekapPage'
import LainnyaPage from './pages/LainnyaPage'
import PiutangPage from './pages/PiutangPage'
import PelangganPage from './pages/PelangganPage'
import PelangganDetailPage from './pages/PelangganDetailPage'

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
        <Routes>
          <Route path="/" element={<Navigate to="/jual" replace />} />
          <Route path="/jual" element={<JualPage />} />
          <Route path="/stok" element={<StokPage />} />
          <Route path="/rekap" element={<RekapPage />} />
          <Route path="/lainnya" element={<LainnyaPage />} />
          <Route path="/lainnya/piutang" element={<PiutangPage />} />
          <Route path="/lainnya/pelanggan" element={<PelangganPage />} />
          <Route path="/lainnya/pelanggan/:id" element={<PelangganDetailPage />} />
        </Routes>
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
