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
      <div role="radiogroup" aria-label="Rentang rekap" className="grid grid-cols-3 gap-1 rounded-2xl bg-track p-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={mode === m.key}
            onClick={() => setMode(m.key)}
            className={`h-11 rounded-[13px] text-sm ${
              mode === m.key
                ? 'bg-white font-extrabold text-ink shadow-[0_2px_8px_rgba(160,60,95,.12)]'
                : 'font-bold text-[#A17F8F]'
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
        className="h-11 self-start rounded-[12px] border-[1.5px] border-border-soft bg-white px-3 text-sm font-semibold text-ink"
      />

      {status === 'loading' && <p className="text-sm font-medium text-muted">Memuat rekap…</p>}
      {status === 'error' && <p className="text-sm font-semibold text-danger">Gagal memuat rekap.</p>}
      {status === 'ready' && recap && (
        <>
          <DailyRecapCard ref={cardRef} recap={recap} dateStr={dateStr} />

          {flash && (
            <p role="status" className="rounded-[12px] bg-money-tint px-3 py-2 text-sm font-semibold text-money-dark">
              {flash}
            </p>
          )}

          <button
            type="button"
            disabled={sharing}
            onClick={share}
            className="h-[54px] rounded-2xl bg-money text-base font-extrabold text-white shadow-[0_6px_16px_rgba(46,155,104,.25)] active:bg-money-dark disabled:opacity-60"
          >
            {sharing ? 'Menyiapkan gambar…' : 'Bagikan Rekap ke WhatsApp'}
          </button>

          <ExpenseQuickAdd dateStr={dateStr} onChanged={() => setRefreshKey((k) => k + 1)} />
        </>
      )}
    </div>
  )
}
