import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchReceivables, markSalePaid } from '../lib/customersData'
import type { ReceivableRow } from '../lib/customersData'
import { ageInDays } from '../lib/customerStats'
import { useReceivablesStore } from '../store/receivables'
import { formatRupiah } from '../lib/format'
import { formatDateWIB } from '../lib/date'
import { CHANNEL_LABELS } from '../components/jual/ChannelTabs'

export default function PiutangPage() {
  const [rows, setRows] = useState<ReceivableRow[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busyId, setBusyId] = useState<string | null>(null)
  const refreshReceivables = useReceivablesStore((s) => s.refresh)

  const load = useCallback(() => {
    setStatus('loading')
    fetchReceivables()
      .then((r) => {
        setRows(r)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function markPaid(row: ReceivableRow) {
    if (!window.confirm(`Tandai lunas piutang ${formatRupiah(row.total)}${row.customerName ? ` dari ${row.customerName}` : ''}?`)) return
    setBusyId(row.id)
    try {
      await markSalePaid(row.id)
      setRows((rs) => rs.filter((r) => r.id !== row.id))
      refreshReceivables()
    } catch {
      window.alert('Gagal menandai lunas. Coba lagi.')
    } finally {
      setBusyId(null)
    }
  }

  const totalOutstanding = rows.reduce((sum, r) => sum + r.total, 0)
  const now = new Date().toISOString()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          to="/lainnya"
          aria-label="Kembali"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-2xl text-ink-2 shadow-[0_2px_10px_rgba(160,60,95,.07)]"
        >
          ‹
        </Link>
        <h2 className="text-[22px] font-extrabold tracking-[-.01em] text-ink">Piutang</h2>
      </div>

      {status === 'loading' && <p className="text-muted">Memuat piutang…</p>}
      {status === 'error' && <p className="text-danger">Gagal memuat piutang.</p>}

      {status === 'ready' && (
        <>
          {rows.length === 0 ? (
            <p className="rounded-[20px] bg-white px-4 py-8 text-center text-faint shadow-[0_2px_10px_rgba(160,60,95,.07)]">
              Tidak ada piutang. Semua transaksi sudah lunas. 🎉
            </p>
          ) : (
            <>
              <div className="rounded-[20px] bg-owe-tint px-[18px] py-4">
                <p className="text-[13px] font-semibold text-owe">Total piutang</p>
                <p className="text-[28px] font-extrabold tracking-[-.02em] text-owe-deep">
                  {formatRupiah(totalOutstanding)}
                </p>
                <p className="text-[13px] text-owe">{rows.length} transaksi belum lunas</p>
              </div>

              <ul className="flex flex-col gap-2">
                {rows.map((r) => {
                  const days = ageInDays(r.soldAt, now)
                  return (
                    <li
                      key={r.id}
                      className="rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-extrabold text-ink">
                            {r.customerName ?? 'Tanpa nama'}
                          </p>
                          <p className="text-xs font-medium text-muted">
                            {formatDateWIB(r.soldAt)} · {CHANNEL_LABELS[r.channel]} · {r.bottles} botol
                          </p>
                          <p className="mt-0.5 text-xs font-bold text-owe">
                            {days === 0 ? 'Hari ini' : `${days} hari lalu`}
                          </p>
                        </div>
                        <p className="text-lg font-extrabold text-ink">{formatRupiah(r.total)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => markPaid(r)}
                        className="mt-3 h-[46px] w-full rounded-[14px] bg-money font-bold text-white shadow-[0_6px_16px_rgba(46,155,104,.25)] active:bg-money-dark disabled:opacity-60"
                      >
                        {busyId === r.id ? 'Menyimpan…' : 'Tandai Lunas'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
