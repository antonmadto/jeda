import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchExportData } from '../lib/exportData'
import { monthBoundsWIB, todayWIB } from '../lib/date'

export default function ExportPage() {
  const today = todayWIB()
  const [start, setStart] = useState(monthBoundsWIB(today).start)
  const [end, setEnd] = useState(today)
  const [status, setStatus] = useState<'idle' | 'working'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleExport() {
    if (start > end) {
      setMessage('Tanggal mulai tidak boleh setelah tanggal akhir.')
      return
    }
    setStatus('working')
    setMessage(null)
    try {
      const data = await fetchExportData(start, end)
      if (data.totalRows === 0) {
        setMessage('Tidak ada data pada rentang ini.')
        setStatus('idle')
        return
      }
      const { buildAndDownloadXlsx } = await import('../lib/exportExcel')
      await buildAndDownloadXlsx(data, `jeda-laporan-${start}-sd-${end}.xlsx`)
      setMessage(`Berhasil mengunduh ${data.totalRows} baris data.`)
    } catch {
      setMessage('Gagal membuat file. Periksa koneksi lalu coba lagi.')
    } finally {
      setStatus('idle')
    }
  }

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
        <h2 className="text-[22px] font-extrabold tracking-[-.01em] text-ink">Ekspor Data</h2>
      </div>

      <p className="text-[13.5px] text-ink-2">
        Unduh seluruh data (penjualan, item, pengeluaran, produksi) sebagai file Excel untuk arsip
        atau dibuka di komputer.
      </p>

      <div className="rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]">
        <label className="mb-3 flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-ink-2">Dari tanggal</span>
          <input
            type="date"
            aria-label="Tanggal mulai"
            value={start}
            max={today}
            onChange={(e) => setStart(e.target.value)}
            className="h-11 rounded-[12px] border-[1.5px] border-border-soft px-3 text-ink"
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-ink-2">Sampai tanggal</span>
          <input
            type="date"
            aria-label="Tanggal akhir"
            value={end}
            max={today}
            onChange={(e) => setEnd(e.target.value)}
            className="h-11 rounded-[12px] border-[1.5px] border-border-soft px-3 text-ink"
          />
        </label>
      </div>

      {message && (
        <p role="status" className="rounded-[12px] bg-bg-soft px-3 py-2.5 text-sm text-ink-2">
          {message}
        </p>
      )}

      <button
        type="button"
        disabled={status === 'working'}
        onClick={handleExport}
        className="h-[54px] rounded-2xl bg-money text-base font-extrabold text-white shadow-[0_6px_16px_rgba(46,155,104,.25)] active:bg-money-dark disabled:opacity-60"
      >
        {status === 'working' ? 'Menyiapkan file…' : 'Unduh Excel'}
      </button>
    </div>
  )
}
