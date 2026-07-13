import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatRupiah } from '../../lib/format'
import { formatTimeWIB, startOfTodayWIB } from '../../lib/date'
import { deleteSale } from '../../lib/stock'
import type { Channel } from '../../lib/pricing'
import { CHANNEL_LABELS } from './ChannelTabs'

const PROMO_LABELS: Record<string, string> = {
  jumat_berkah: 'Jumat Berkah',
  sabtu_ceria: 'Sabtu Ceria',
}

export type TodaySaleRow = {
  id: string
  sold_at: string
  channel: Channel
  payment: 'cash' | 'qris'
  status: 'lunas' | 'belum_lunas'
  total: number
  promo_applied: string | null
  customers: { name: string } | null
  sale_items: { variant_id: string; qty: number }[]
}

export default function TodaySales({
  refreshKey,
  onEdit,
  onChanged,
}: {
  refreshKey: number
  onEdit: (sale: TodaySaleRow) => void
  onChanged: () => void
}) {
  const [rows, setRows] = useState<TodaySaleRow[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('sales')
      .select(
        'id, sold_at, channel, payment, status, total, promo_applied, customers (name), sale_items (variant_id, qty)',
      )
      .gte('sold_at', startOfTodayWIB().toISOString())
      .order('sold_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setStatus('error')
        } else {
          setRows((data ?? []) as unknown as TodaySaleRow[])
          setStatus('ready')
        }
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  async function handleDelete(sale: TodaySaleRow) {
    if (!window.confirm('Hapus transaksi ini? Stok jadi akan dikembalikan.')) return
    try {
      await deleteSale(sale.id)
      onChanged()
    } catch {
      window.alert('Gagal menghapus transaksi. Coba lagi.')
    }
  }

  if (status === 'loading') return <p className="text-sm font-medium text-muted">Memuat transaksi…</p>
  if (status === 'error') return <p className="text-sm font-medium text-danger">Gagal memuat transaksi.</p>

  const omzet = rows.reduce((sum, r) => sum + r.total, 0)

  return (
    <section aria-label="Transaksi hari ini">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-extrabold tracking-[.09em] text-label uppercase">
          Transaksi Hari Ini
        </h2>
        {rows.length > 0 && (
          <span className="text-sm font-extrabold text-brand">{formatRupiah(omzet)}</span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-[20px] bg-white px-4 py-6 text-center text-sm font-medium text-faint shadow-[0_2px_10px_rgba(160,60,95,.07)]">
          Belum ada transaksi hari ini.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-[20px] bg-white shadow-[0_2px_10px_rgba(160,60,95,.07)]">
          {rows.map((r) => {
            const bottles = r.sale_items.reduce((sum, i) => sum + i.qty, 0)
            return (
              <li key={r.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-extrabold text-ink">
                    {formatRupiah(r.total)}
                    {r.status === 'belum_lunas' && (
                      <span className="ml-2 rounded-full bg-owe-tint px-2 py-0.5 align-middle text-[11px] font-bold text-owe">
                        Belum lunas
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs font-medium text-muted">
                    {formatTimeWIB(r.sold_at)} · {CHANNEL_LABELS[r.channel]} · {bottles} botol ·{' '}
                    {r.payment === 'cash' ? 'Cash' : 'QRIS'}
                    {r.promo_applied && ` · ${PROMO_LABELS[r.promo_applied] ?? r.promo_applied}`}
                    {r.customers && ` · ${r.customers.name}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(r)}
                  className="h-10 rounded-[12px] bg-tint px-3 text-xs font-bold text-tint-ink active:bg-tint-dark"
                >
                  Koreksi
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r)}
                  className="h-10 rounded-[12px] bg-danger-tint px-3 text-xs font-bold text-danger active:bg-[#F8E2E2]"
                >
                  Hapus
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
