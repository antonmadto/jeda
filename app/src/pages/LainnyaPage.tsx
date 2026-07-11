import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useReceivablesStore } from '../store/receivables'

export default function LainnyaPage() {
  const [email, setEmail] = useState<string | null>(null)
  const receivablesCount = useReceivablesStore((s) => s.count)
  const refreshReceivables = useReceivablesStore((s) => s.refresh)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null)
    })
    refreshReceivables()
  }, [refreshReceivables])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold text-gray-900">Lainnya</h2>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <Link
          to="/lainnya/piutang"
          className="flex min-h-14 items-center justify-between border-b border-gray-100 px-4 py-3"
        >
          <span className="font-medium text-gray-900">Piutang</span>
          <span className="flex items-center gap-2">
            {receivablesCount > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
                {receivablesCount}
              </span>
            )}
            <span className="text-gray-400">›</span>
          </span>
        </Link>
        <Link
          to="/lainnya/pelanggan"
          className="flex min-h-14 items-center justify-between px-4 py-3"
        >
          <span className="font-medium text-gray-900">Pelanggan</span>
          <span className="text-gray-400">›</span>
        </Link>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-500">Masuk sebagai</p>
        <p className="font-medium text-gray-900">{email ?? '—'}</p>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="h-12 rounded-lg border border-gray-300 bg-white font-semibold text-gray-700 active:bg-gray-100"
      >
        Keluar
      </button>
    </section>
  )
}
