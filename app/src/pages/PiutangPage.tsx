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
      <div className="flex items-center gap-2">
        <Link to="/lainnya" aria-label="Kembali" className="text-2xl text-gray-500">
          ‹
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Piutang</h2>
      </div>

      {status === 'loading' && <p className="text-gray-500">Memuat piutang…</p>}
      {status === 'error' && <p className="text-red-600">Gagal memuat piutang.</p>}

      {status === 'ready' && (
        <>
          {rows.length === 0 ? (
            <p className="rounded-xl bg-white px-4 py-8 text-center text-gray-400 shadow-sm">
              Tidak ada piutang. Semua transaksi sudah lunas. 🎉
            </p>
          ) : (
            <>
              <div className="rounded-xl bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-700">Total piutang</p>
                <p className="text-2xl font-extrabold text-amber-800">
                  {formatRupiah(totalOutstanding)}
                </p>
                <p className="text-sm text-amber-700">{rows.length} transaksi belum lunas</p>
              </div>

              <ul className="flex flex-col gap-2">
                {rows.map((r) => {
                  const days = ageInDays(r.soldAt, now)
                  return (
                    <li key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900">
                            {r.customerName ?? 'Tanpa nama'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDateWIB(r.soldAt)} · {CHANNEL_LABELS[r.channel]} · {r.bottles} botol
                          </p>
                          <p className="mt-0.5 text-xs font-medium text-amber-700">
                            {days === 0 ? 'Hari ini' : `${days} hari lalu`}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-gray-900">{formatRupiah(r.total)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => markPaid(r)}
                        className="mt-3 h-11 w-full rounded-lg bg-green-600 font-semibold text-white active:bg-green-700 disabled:opacity-60"
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
