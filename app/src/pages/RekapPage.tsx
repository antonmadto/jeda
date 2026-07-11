import { useCallback, useEffect, useRef, useState } from 'react'
import { computeDailyRecap } from '../lib/reports'
import type { DailyRecap } from '../lib/reports'
import { fetchDailyData, fetchHppByVariant, fetchVariantMeta } from '../lib/reportsData'
import { shareNodeAsPng } from '../lib/shareImage'
import { todayWIB } from '../lib/date'
import DailyRecapCard from '../components/rekap/DailyRecapCard'
import ExpenseQuickAdd from '../components/rekap/ExpenseQuickAdd'
import PeriodRecap from '../components/rekap/PeriodRecap'

type Mode = 'harian' | 'mingguan' | 'bulanan'

const MODES: { key: Mode; label: string }[] = [
  { key: 'harian', label: 'Harian' },
  { key: 'mingguan', label: 'Mingguan' },
  { key: 'bulanan', label: 'Bulanan' },
]

export default function RekapPage() {
  const [mode, setMode] = useState<Mode>('harian')
  const [dateStr, setDateStr] = useState(todayWIB())

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Rentang rekap" className="grid grid-cols-3 gap-1 rounded-xl bg-gray-200 p-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={mode === m.key}
            onClick={() => setMode(m.key)}
            className={`h-11 rounded-lg text-sm font-semibold ${
              mode === m.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'harian' ? (
        <DailyView dateStr={dateStr} onDateChange={setDateStr} />
      ) : (
        <PeriodRecap mode={mode} />
      )}
    </div>
  )
}

function DailyView({
  dateStr,
  onDateChange,
}: {
  dateStr: string
  onDateChange: (d: string) => void
}) {
  const [recap, setRecap] = useState<DailyRecap | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [refreshKey, setRefreshKey] = useState(0)
  const [sharing, setSharing] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setStatus('loading')
    Promise.all([fetchDailyData(dateStr), fetchHppByVariant(), fetchVariantMeta()])
      .then(([data, hpp, meta]) => {
        setRecap(computeDailyRecap(data.sales, data.expenses, hpp, meta))
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [dateStr])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  async function share() {
    if (!cardRef.current) return
    setSharing(true)
    try {
      const result = await shareNodeAsPng(cardRef.current, `rekap-${dateStr}.png`, 'Rekap Harian JE&DA')
      if (result === 'downloaded') {
        setFlash('Gambar rekap tersimpan ✓')
        setTimeout(() => setFlash(null), 2500)
      }
    } catch {
      window.alert('Gagal membuat gambar. Coba lagi.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="date"
        aria-label="Tanggal rekap"
        value={dateStr}
        max={todayWIB()}
        onChange={(e) => onDateChange(e.target.value)}
        className="h-11 self-start rounded-lg border border-gray-300 bg-white px-3"
      />

      {status === 'loading' && <p className="text-gray-500">Memuat rekap…</p>}
      {status === 'error' && <p className="text-red-600">Gagal memuat rekap.</p>}
      {status === 'ready' && recap && (
        <>
          <DailyRecapCard ref={cardRef} recap={recap} dateStr={dateStr} />

          {flash && (
            <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              {flash}
            </p>
          )}

          <button
            type="button"
            disabled={sharing}
            onClick={share}
            className="h-13 rounded-xl bg-green-600 text-base font-bold text-white active:bg-green-700 disabled:opacity-60"
          >
            {sharing ? 'Menyiapkan gambar…' : 'Bagikan Rekap ke WhatsApp'}
          </button>

          <ExpenseQuickAdd dateStr={dateStr} onChanged={() => setRefreshKey((k) => k + 1)} />
        </>
      )}
    </div>
  )
}
