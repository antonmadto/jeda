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
      <div className="flex items-center gap-2">
        <Link to="/lainnya" aria-label="Kembali" className="text-2xl text-gray-500">
          ‹
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Ekspor Data</h2>
      </div>

      <p className="text-sm text-gray-600">
        Unduh seluruh data (penjualan, item, pengeluaran, produksi) sebagai file Excel untuk arsip
        atau dibuka di komputer.
      </p>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <label className="mb-3 flex items-center justify-between gap-2 text-sm">
          <span className="text-gray-700">Dari tanggal</span>
          <input
            type="date"
            aria-label="Tanggal mulai"
            value={start}
            max={today}
            onChange={(e) => setStart(e.target.value)}
            className="h-11 rounded-lg border border-gray-300 px-2"
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-sm">
          <span className="text-gray-700">Sampai tanggal</span>
          <input
            type="date"
            aria-label="Tanggal akhir"
            value={end}
            max={today}
            onChange={(e) => setEnd(e.target.value)}
            className="h-11 rounded-lg border border-gray-300 px-2"
          />
        </label>
      </div>

      {message && (
        <p role="status" className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">
          {message}
        </p>
      )}

      <button
        type="button"
        disabled={status === 'working'}
        onClick={handleExport}
        className="h-13 rounded-xl bg-green-600 text-base font-bold text-white active:bg-green-700 disabled:opacity-60"
      >
        {status === 'working' ? 'Menyiapkan file…' : 'Unduh Excel'}
      </button>
    </div>
  )
}
