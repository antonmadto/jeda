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
      <div className="flex items-center gap-2">
        <Link to="/lainnya/pelanggan" aria-label="Kembali" className="text-2xl text-gray-500">
          ‹
        </Link>
        <h2 className="truncate text-xl font-bold text-gray-900">{name || 'Pelanggan'}</h2>
      </div>

      {status === 'loading' && <p className="text-gray-500">Memuat riwayat…</p>}
      {status === 'error' && <p className="text-red-600">Gagal memuat riwayat.</p>}

      {status === 'ready' && (
        <>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            {phone && <p className="mb-2 text-sm text-gray-500">{phone}</p>}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-gray-500">Total belanja</p>
                <p className="text-lg font-bold text-gray-900">{formatRupiah(totalSpent)}</p>
              </div>
              <div>
                <p className="text-gray-500">Piutang</p>
                <p
                  className={`text-lg font-bold ${outstanding > 0 ? 'text-amber-700' : 'text-gray-900'}`}
                >
                  {formatRupiah(outstanding)}
                </p>
              </div>
            </div>
          </div>

          <h3 className="text-sm font-semibold tracking-wide text-gray-500 uppercase">
            Riwayat Beli ({history.length})
          </h3>
          {history.length === 0 ? (
            <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-gray-400 shadow-sm">
              Belum ada transaksi.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {history.map((h) => (
                <li key={h.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">{formatRupiah(h.total)}</p>
                    {h.status === 'belum_lunas' ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                        Belum lunas
                      </span>
                    ) : (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                        Lunas
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatDateWIB(h.soldAt)} · {CHANNEL_LABELS[h.channel]}
                  </p>
                  {h.itemsSummary && (
                    <p className="mt-1 text-sm text-gray-600">{h.itemsSummary}</p>
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
