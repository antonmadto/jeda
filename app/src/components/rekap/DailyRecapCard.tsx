import { forwardRef } from 'react'
import type { DailyRecap } from '../../lib/reports'
import { formatRupiah } from '../../lib/format'
import { formatDateWIB } from '../../lib/date'
import { CHANNEL_LABELS } from '../jual/ChannelTabs'

// Kartu satu halaman yang dirancang untuk di-screenshot / dibagikan pemilik tiap malam.
const DailyRecapCard = forwardRef<HTMLDivElement, { recap: DailyRecap; dateStr: string }>(
  ({ recap, dateStr }, ref) => {
    const labaPositif = recap.labaKotor >= 0
    return (
      <div ref={ref} className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="bg-brand px-4 py-3 text-white">
          <p className="text-sm opacity-90">Rekap Harian JE&amp;DA</p>
          <p className="text-lg font-bold">{formatDateWIB(dateStr)}</p>
        </div>

        <div className="px-4 py-4">
          <div className="mb-4 text-center">
            <p className="text-sm text-gray-500">Omzet</p>
            <p className="text-4xl font-extrabold text-gray-900">{formatRupiah(recap.omzet)}</p>
            <p className="mt-1 text-sm text-gray-500">
              {recap.bottles} botol · {recap.transactionCount} transaksi
            </p>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-gray-500">Cash</p>
              <p className="font-bold text-gray-900">{formatRupiah(recap.cash)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-gray-500">QRIS</p>
              <p className="font-bold text-gray-900">{formatRupiah(recap.qris)}</p>
            </div>
          </div>

          {recap.byChannel.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Per Kanal
              </p>
              <ul className="divide-y divide-gray-100 rounded-lg bg-gray-50 px-3">
                {recap.byChannel.map((c) => (
                  <li key={c.channel} className="flex justify-between py-1.5 text-sm">
                    <span className="text-gray-700">
                      {CHANNEL_LABELS[c.channel]}{' '}
                      <span className="text-gray-400">· {c.bottles} botol</span>
                    </span>
                    <span className="font-semibold text-gray-900">{formatRupiah(c.omzet)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recap.topProducts.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                Terlaris
              </p>
              <ol className="divide-y divide-gray-100 rounded-lg bg-gray-50 px-3">
                {recap.topProducts.map((p, idx) => (
                  <li key={p.productId} className="flex justify-between py-1.5 text-sm">
                    <span className="text-gray-700">
                      {idx + 1}. {p.productName}
                    </span>
                    <span className="font-semibold text-gray-900">{p.qty} botol</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="space-y-1 border-t border-gray-100 pt-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>HPP terjual</span>
              <span>−{formatRupiah(recap.hppSold)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Pengeluaran</span>
              <span>−{formatRupiah(recap.totalExpenses)}</span>
            </div>
            <div
              className={`mt-1 flex justify-between rounded-lg px-3 py-2 text-base font-bold ${
                labaPositif ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              <span>Laba kotor</span>
              <span data-testid="laba-kotor">{formatRupiah(recap.labaKotor)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  },
)

DailyRecapCard.displayName = 'DailyRecapCard'
export default DailyRecapCard
