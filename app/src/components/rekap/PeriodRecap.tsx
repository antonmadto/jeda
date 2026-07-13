import { useEffect, useState } from 'react'
import {
  computePeriodRecap,
  computeRepeatRate,
} from '../../lib/reports'
import type { PeriodRecap as PeriodRecapData, RepeatRate } from '../../lib/reports'
import {
  fetchCustomerSaleHistory,
  fetchHppByVariant,
  fetchRangeData,
  fetchVariantMeta,
} from '../../lib/reportsData'
import {
  addDaysWIB,
  dateRangeWIB,
  formatShortDateWIB,
  monthBoundsWIB,
  startOfDayWIB,
  todayWIB,
} from '../../lib/date'
import { formatRupiah } from '../../lib/format'
import { CHANNEL_LABELS } from '../jual/ChannelTabs'

export default function PeriodRecap({ mode }: { mode: 'mingguan' | 'bulanan' }) {
  const [recap, setRecap] = useState<PeriodRecapData | null>(null)
  const [repeat, setRepeat] = useState<RepeatRate | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    setStatus('loading')
    const today = todayWIB()
    const { startDate, endInclusive } =
      mode === 'mingguan'
        ? { startDate: addDaysWIB(today, -6), endInclusive: today }
        : (() => {
            const { start } = monthBoundsWIB(today)
            return { startDate: start, endInclusive: today }
          })()

    Promise.all([
      fetchRangeData(startDate, endInclusive),
      fetchHppByVariant(),
      fetchVariantMeta(),
      mode === 'bulanan' ? fetchCustomerSaleHistory() : Promise.resolve(null),
    ])
      .then(([data, hpp, meta, history]) => {
        const dates = dateRangeWIB(startDate, endInclusive)
        setRecap(computePeriodRecap(data.sales, data.expenses, hpp, meta, dates))
        if (mode === 'bulanan' && history) {
          const { end } = monthBoundsWIB(today)
          setRepeat(
            computeRepeatRate(
              history,
              startOfDayWIB(startDate).toISOString(),
              startOfDayWIB(end).toISOString(),
            ),
          )
        } else {
          setRepeat(null)
        }
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [mode])

  if (status === 'loading') return <p className="text-sm font-medium text-muted">Memuat rekap…</p>
  if (status === 'error' || !recap) return <p className="text-sm font-semibold text-danger">Gagal memuat rekap.</p>

  const maxOmzet = Math.max(1, ...recap.trend.map((t) => t.omzet))

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]">
        <p className="text-xs font-medium text-muted">Omzet {mode}</p>
        <p className="text-[32px] font-extrabold tracking-[-.02em] text-ink">{formatRupiah(recap.omzet)}</p>
        <p className="mt-1 text-xs font-medium text-muted">
          {recap.bottles} botol · {recap.transactionCount} transaksi
        </p>
        <div className="mt-3 flex justify-between rounded-full bg-money-tint px-4 py-2.5 text-sm font-extrabold text-money-dark">
          <span>Laba kotor</span>
          <span>{formatRupiah(recap.labaKotor)}</span>
        </div>
      </section>

      {repeat && (
        <section className="rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]">
          <p className="mb-1 text-base font-extrabold text-ink">Pelanggan Berulang</p>
          <p className="text-[32px] font-extrabold tracking-[-.02em] text-brand">
            {(repeat.rate * 100).toFixed(0)}%
          </p>
          <p className="text-[13.5px] text-muted">
            {repeat.repeat} dari {repeat.identified} transaksi ber-pelanggan pernah beli sebelumnya
          </p>
        </section>
      )}

      <section className="rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]">
        <h2 className="mb-3 text-base font-extrabold text-ink">Tren Omzet</h2>
        <ul className="flex flex-col gap-1.5">
          {recap.trend.map((t) => (
            <li key={t.date} className="flex items-center gap-2 text-xs">
              <span className="w-12 shrink-0 font-semibold text-muted">{formatShortDateWIB(t.date)}</span>
              <div className="h-[18px] flex-1 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${(t.omzet / maxOmzet) * 100}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right font-bold text-ink-2">
                {formatRupiah(t.omzet)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {recap.byChannel.length > 0 && (
        <section className="rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]">
          <h2 className="mb-2 text-base font-extrabold text-ink">Perbandingan Kanal</h2>
          <ul className="divide-y divide-line">
            {recap.byChannel.map((c) => (
              <li key={c.channel} className="flex justify-between py-2 text-[13.5px]">
                <span className="text-ink-2">
                  {CHANNEL_LABELS[c.channel]}{' '}
                  <span className="text-faint">· {c.bottles} botol · {c.count} transaksi</span>
                </span>
                <span className="font-bold text-ink">{formatRupiah(c.omzet)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recap.topProducts.length > 0 && (
        <section className="rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]">
          <h2 className="mb-2 text-base font-extrabold text-ink">Produk Terlaris</h2>
          <ol className="divide-y divide-line">
            {recap.topProducts.map((p, idx) => (
              <li key={p.productId} className="flex justify-between py-2 text-[13.5px]">
                <span className="text-ink-2">
                  {idx + 1}. {p.productName}
                </span>
                <span className="font-bold text-ink">
                  {p.qty} botol · {formatRupiah(p.omzet)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
