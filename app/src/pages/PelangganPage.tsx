import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchCustomersWithStats } from '../lib/customersData'
import type { CustomerWithStat } from '../lib/customersData'
import { formatRupiah } from '../lib/format'
import { formatDateWIB } from '../lib/date'

const AVATAR_STYLES = [
  'bg-brand-light text-brand',
  'bg-money-tint text-money-dark',
  'bg-owe-tint text-owe',
]

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
      <div className="flex items-center gap-3">
        <Link
          to="/lainnya"
          aria-label="Kembali"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-2xl text-ink-2 shadow-[0_2px_10px_rgba(160,60,95,.07)]"
        >
          ‹
        </Link>
        <h2 className="text-[22px] font-extrabold tracking-[-.01em] text-ink">Pelanggan</h2>
      </div>

      {status === 'loading' && <p className="text-muted">Memuat pelanggan…</p>}
      {status === 'error' && <p className="text-danger">Gagal memuat pelanggan.</p>}

      {status === 'ready' &&
        (rows.length === 0 ? (
          <p className="rounded-[20px] bg-white px-4 py-8 text-center text-faint shadow-[0_2px_10px_rgba(160,60,95,.07)]">
            Belum ada pelanggan. Pelanggan ditambah saat mencatat penjualan.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((c, i) => (
              <li key={c.customerId}>
                <Link
                  to={`/lainnya/pelanggan/${c.customerId}`}
                  className="flex items-center gap-3 rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-extrabold ${AVATAR_STYLES[i % 3]}`}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-ink">{c.name}</p>
                    <p className="text-xs font-medium text-muted">
                      {c.transactionCount} transaksi
                      {c.lastPurchaseISO && ` · terakhir ${formatDateWIB(c.lastPurchaseISO)}`}
                    </p>
                    {c.outstanding > 0 && (
                      <p className="mt-0.5 text-xs font-bold text-owe">
                        Piutang {formatRupiah(c.outstanding)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-ink">{formatRupiah(c.totalSpent)}</p>
                    <p className="text-xs text-faint">total belanja</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
