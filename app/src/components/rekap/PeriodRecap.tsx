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

  if (status === 'loading') return <p className="text-gray-500">Memuat rekap…</p>
  if (status === 'error' || !recap) return <p className="text-red-600">Gagal memuat rekap.</p>

  const maxOmzet = Math.max(1, ...recap.trend.map((t) => t.omzet))

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-500">Omzet {mode}</p>
        <p className="text-3xl font-extrabold text-gray-900">{formatRupiah(recap.omzet)}</p>
        <p className="mt-1 text-sm text-gray-500">
          {recap.bottles} botol · {recap.transactionCount} transaksi
        </p>
        <div className="mt-2 flex justify-between rounded-lg bg-green-50 px-3 py-2 text-sm font-bold text-green-700">
          <span>Laba kotor</span>
          <span>{formatRupiah(recap.labaKotor)}</span>
        </div>
      </section>

      {repeat && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <p className="mb-1 text-sm font-semibold text-gray-900">Pelanggan Berulang</p>
          <p className="text-3xl font-extrabold text-brand">
            {(repeat.rate * 100).toFixed(0)}%
          </p>
          <p className="text-sm text-gray-500">
            {repeat.repeat} dari {repeat.identified} transaksi ber-pelanggan pernah beli sebelumnya
          </p>
        </section>
      )}

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-bold text-gray-900">Tren Omzet</h2>
        <ul className="flex flex-col gap-1">
          {recap.trend.map((t) => (
            <li key={t.date} className="flex items-center gap-2 text-xs">
              <span className="w-12 shrink-0 text-gray-500">{formatShortDateWIB(t.date)}</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-gray-100">
                <div
                  className="h-full rounded bg-brand"
                  style={{ width: `${(t.omzet / maxOmzet) * 100}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right font-medium text-gray-700">
                {formatRupiah(t.omzet)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {recap.byChannel.length > 0 && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-bold text-gray-900">Perbandingan Kanal</h2>
          <ul className="divide-y divide-gray-100">
            {recap.byChannel.map((c) => (
              <li key={c.channel} className="flex justify-between py-1.5 text-sm">
                <span className="text-gray-700">
                  {CHANNEL_LABELS[c.channel]}{' '}
                  <span className="text-gray-400">· {c.bottles} botol · {c.count} transaksi</span>
                </span>
                <span className="font-semibold text-gray-900">{formatRupiah(c.omzet)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recap.topProducts.length > 0 && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-bold text-gray-900">Produk Terlaris</h2>
          <ol className="divide-y divide-gray-100">
            {recap.topProducts.map((p, idx) => (
              <li key={p.productId} className="flex justify-between py-1.5 text-sm">
                <span className="text-gray-700">
                  {idx + 1}. {p.productName}
                </span>
                <span className="font-semibold text-gray-900">
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
