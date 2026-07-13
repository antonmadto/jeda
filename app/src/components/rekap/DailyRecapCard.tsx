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
      <div ref={ref} className="overflow-hidden rounded-[24px] bg-white shadow-[0_4px_16px_rgba(160,60,95,.1)]">
        <div className="bg-brand px-5 py-4 text-white">
          <p className="text-[13px] font-semibold opacity-85">Rekap Harian JE&amp;DA</p>
          <p className="text-lg font-extrabold">{formatDateWIB(dateStr)}</p>
        </div>

        <div className="px-5 py-5">
          <div className="mb-4 text-center">
            <p className="text-xs font-medium text-muted">Omzet</p>
            <p className="text-[38px] font-extrabold tracking-[-.02em] text-ink">{formatRupiah(recap.omzet)}</p>
            <p className="mt-1 text-xs font-medium text-muted">
              {recap.bottles} botol · {recap.transactionCount} transaksi
            </p>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 text-[13.5px]">
            <div className="rounded-[14px] bg-bg-soft px-3 py-2.5">
              <p className="text-xs font-medium text-muted">Cash</p>
              <p className="font-bold text-ink">{formatRupiah(recap.cash)}</p>
            </div>
            <div className="rounded-[14px] bg-bg-soft px-3 py-2.5">
              <p className="text-xs font-medium text-muted">QRIS</p>
              <p className="font-bold text-ink">{formatRupiah(recap.qris)}</p>
            </div>
          </div>

          {recap.byChannel.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-[11px] font-extrabold tracking-[.09em] text-label uppercase">
                Per Kanal
              </p>
              <ul className="divide-y divide-[#F0E2E8] rounded-[14px] bg-bg-soft px-3">
                {recap.byChannel.map((c) => (
                  <li key={c.channel} className="flex justify-between py-2 text-[13.5px]">
                    <span className="text-ink-2">
                      {CHANNEL_LABELS[c.channel]}{' '}
                      <span className="text-faint">· {c.bottles} botol</span>
                    </span>
                    <span className="font-bold text-ink">{formatRupiah(c.omzet)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recap.topProducts.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-[11px] font-extrabold tracking-[.09em] text-label uppercase">
                Terlaris
              </p>
              <ol className="divide-y divide-[#F0E2E8] rounded-[14px] bg-bg-soft px-3">
                {recap.topProducts.map((p, idx) => (
                  <li key={p.productId} className="flex justify-between py-2 text-[13.5px]">
                    <span className="text-ink-2">
                      {idx + 1}. {p.productName}
                    </span>
                    <span className="font-bold text-ink">{p.qty} botol</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="space-y-1.5 border-t border-line pt-3 text-[13.5px]">
            <div className="flex justify-between font-medium text-ink-2">
              <span>HPP terjual</span>
              <span>−{formatRupiah(recap.hppSold)}</span>
            </div>
            <div className="flex justify-between font-medium text-ink-2">
              <span>Pengeluaran</span>
              <span>−{formatRupiah(recap.totalExpenses)}</span>
            </div>
            <div
              className={`mt-1 flex justify-between rounded-[14px] px-3 py-2.5 text-base font-extrabold ${
                labaPositif ? 'bg-money-tint text-money-dark' : 'bg-danger-tint text-danger'
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
