import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  fetchCustomer,
  fetchCustomerHistory,
} from '../lib/customersData'
import type { CustomerSaleHistoryRow } from '../lib/customersData'
import { formatRupiah } from '../lib/format'
import { formatDateWIB } from '../lib/date'
import { CHANNEL_LABELS } from '../components/jual/ChannelTabs'

export default function PelangganDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [name, setName] = useState<string>('')
  const [phone, setPhone] = useState<string | null>(null)
  const [history, setHistory] = useState<CustomerSaleHistoryRow[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!id) return
    Promise.all([fetchCustomer(id), fetchCustomerHistory(id)])
      .then(([customer, rows]) => {
        if (customer) {
          setName(customer.name)
          setPhone(customer.phone)
        }
        setHistory(rows)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [id])

  const totalSpent = history.reduce((sum, h) => sum + h.total, 0)
  const outstanding = history
    .filter((h) => h.status === 'belum_lunas')
    .reduce((sum, h) => sum + h.total, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          to="/lainnya/pelanggan"
          aria-label="Kembali"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-2xl text-ink-2 shadow-[0_2px_10px_rgba(160,60,95,.07)]"
        >
          ‹
        </Link>
        <h2 className="truncate text-[22px] font-extrabold tracking-[-.01em] text-ink">
          {name || 'Pelanggan'}
        </h2>
      </div>

      {status === 'loading' && <p className="text-muted">Memuat riwayat…</p>}
      {status === 'error' && <p className="text-danger">Gagal memuat riwayat.</p>}

      {status === 'ready' && (
        <>
          <div className="rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]">
            {phone && <p className="mb-2 text-sm font-medium text-muted">{phone}</p>}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-[14px] bg-bg-soft p-3">
                <p className="text-xs font-medium text-muted">Total belanja</p>
                <p className="text-lg font-extrabold text-ink">{formatRupiah(totalSpent)}</p>
              </div>
              <div className="rounded-[14px] bg-owe-tint p-3">
                <p className="text-xs font-medium text-owe">Piutang</p>
                <p className="text-lg font-extrabold text-owe-deep">
                  {formatRupiah(outstanding)}
                </p>
              </div>
            </div>
          </div>

          <h3 className="text-[11px] font-extrabold tracking-[.09em] text-label uppercase">
            Riwayat Beli ({history.length})
          </h3>
          {history.length === 0 ? (
            <p className="rounded-[20px] bg-white px-4 py-6 text-center text-sm text-faint shadow-[0_2px_10px_rgba(160,60,95,.07)]">
              Belum ada transaksi.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-extrabold text-ink">{formatRupiah(h.total)}</p>
                    {h.status === 'belum_lunas' ? (
                      <span className="rounded-full bg-owe-tint px-2.5 py-0.5 text-xs font-bold text-owe">
                        Belum lunas
                      </span>
                    ) : (
                      <span className="rounded-full bg-money-tint px-2.5 py-0.5 text-xs font-bold text-money-dark">
                        Lunas
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-muted">
                    {formatDateWIB(h.soldAt)} · {CHANNEL_LABELS[h.channel]}
                  </p>
                  {h.itemsSummary && (
                    <p className="mt-1 text-[13.5px] text-ink-2">{h.itemsSummary}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
