import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCustomersWithStats } from '../lib/customersData'
import type { CustomerWithStat } from '../lib/customersData'
import { formatRupiah } from '../lib/format'
import { formatDateWIB } from '../lib/date'

export default function PelangganPage() {
  const [rows, setRows] = useState<CustomerWithStat[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    fetchCustomersWithStats()
      .then((r) => {
        setRows(r)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link to="/lainnya" aria-label="Kembali" className="text-2xl text-gray-500">
          ‹
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Pelanggan</h2>
      </div>

      {status === 'loading' && <p className="text-gray-500">Memuat pelanggan…</p>}
      {status === 'error' && <p className="text-red-600">Gagal memuat pelanggan.</p>}

      {status === 'ready' &&
        (rows.length === 0 ? (
          <p className="rounded-xl bg-white px-4 py-8 text-center text-gray-400 shadow-sm">
            Belum ada pelanggan. Pelanggan ditambah saat mencatat penjualan.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((c) => (
              <li key={c.customerId}>
                <Link
                  to={`/lainnya/pelanggan/${c.customerId}`}
                  className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <p className="text-sm text-gray-500">
                      {c.transactionCount} transaksi
                      {c.lastPurchaseISO && ` · terakhir ${formatDateWIB(c.lastPurchaseISO)}`}
                    </p>
                    {c.outstanding > 0 && (
                      <p className="mt-0.5 text-xs font-semibold text-amber-700">
                        Piutang {formatRupiah(c.outstanding)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatRupiah(c.totalSpent)}</p>
                    <p className="text-xs text-gray-400">total belanja</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
