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
      <h2 className="text-[22px] font-extrabold tracking-[-.01em] text-ink">Lainnya</h2>

      <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_2px_10px_rgba(160,60,95,.07)]">
        <Link
          to="/lainnya/piutang"
          className="flex h-[58px] items-center justify-between border-b border-line px-[18px]"
        >
          <span className="font-bold text-ink">Piutang</span>
          <span className="flex items-center gap-2">
            {receivablesCount > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-white">
                {receivablesCount}
              </span>
            )}
            <span className="text-[#C4B1BA]">›</span>
          </span>
        </Link>
        <Link
          to="/lainnya/pelanggan"
          className="flex h-[58px] items-center justify-between border-b border-line px-[18px]"
        >
          <span className="font-bold text-ink">Pelanggan</span>
          <span className="text-[#C4B1BA]">›</span>
        </Link>
        <Link
          to="/lainnya/aset"
          className="flex h-[58px] items-center justify-between border-b border-line px-[18px]"
        >
          <span className="font-bold text-ink">Aset Usaha</span>
          <span className="text-[#C4B1BA]">›</span>
        </Link>
        <Link
          to="/lainnya/ekspor"
          className="flex h-[58px] items-center justify-between px-[18px]"
        >
          <span className="font-bold text-ink">Ekspor Data (Excel)</span>
          <span className="text-[#C4B1BA]">›</span>
        </Link>
      </div>

      <div className="flex items-center gap-3 rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-light font-extrabold text-brand">
          {(email ?? '—').charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-muted">Masuk sebagai</p>
          <p className="truncate font-bold text-ink">{email ?? '—'}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="h-[50px] rounded-2xl bg-tint font-bold text-tint-ink active:bg-tint-dark"
      >
        Keluar
      </button>
    </section>
  )
}
