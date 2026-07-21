import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchFinanceData } from '../lib/financeData'
import { buildInvestorReport, investorReportFilename } from '../lib/investorReport'
import type { InvestorReport } from '../lib/investorReport'
import { downloadBlob } from '../lib/download'
import { formatRupiah } from '../lib/format'
import { formatDateWIB, todayWIB } from '../lib/date'
import { EXPENSE_CATEGORIES } from '../lib/reports'

// Periode default: awal bulan dua bulan sebelum bulan WIB berjalan s.d. hari ini
// (efektif tiga bulan terakhir).
function defaultStart(today: string): string {
  const [y, m] = today.split('-').map(Number)
  const idx = y * 12 + (m - 1) - 2
  const yy = Math.floor(idx / 12)
  const mm = (idx % 12) + 1
  return `${yy}-${String(mm).padStart(2, '0')}-01`
}

const EXPENSE_LABEL: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.key, c.label]),
)

/** Persen gaya id-ID (koma desimal), sama dengan PDF — mis. 63.3 → "63,3%". */
function pctText(v: number): string {
  return `${v.toLocaleString('id-ID')}%`
}

function monthLabel(mk: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${mk}-01T00:00:00+07:00`))
}

type Status = 'loading' | 'ready' | 'error'

export default function LaporanPage() {
  const today = todayWIB()
  const [start, setStart] = useState(defaultStart(today))
  const [end, setEnd] = useState(today)
  const [status, setStatus] = useState<Status>('loading')
  const [report, setReport] = useState<InvestorReport | null>(null)
  const [isEmpty, setIsEmpty] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [jsonBusy, setJsonBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // Ambil data + susun laporan untuk rentang saat ini, perbarui pratinjau, dan
  // KEMBALIKAN laporan segar. Dipakai oleh "Terapkan" DAN kedua tombol unduh:
  // unduhan selalu re-fetch dulu supaya layar ≡ PDF ≡ JSON pada saat unduh
  // (tidak diam-diam membawa angka lama yang di-stamp saat "Terapkan" pagi hari).
  const load = useCallback(async (s: string, e: string): Promise<InvestorReport | null> => {
    if (s > e) {
      setStatus('error')
      setMessage('Tanggal mulai tidak boleh setelah tanggal akhir.')
      return null
    }
    setStatus('loading')
    setMessage(null)
    try {
      const bundle = await fetchFinanceData(s, e)
      const built = buildInvestorReport({
        sales: bundle.sales,
        expenses: bundle.expenses,
        assets: bundle.assets,
        hppByVariant: bundle.hppByVariant,
        customerHistory: bundle.customerHistory,
        range: bundle.range,
        generatedAt: new Date().toISOString(),
      })
      setReport(built)
      // "kosong" = tidak ada data PERIODE (penjualan/pengeluaran); aset dikecualikan
      // karena selalu diambil penuh dan bukan data periode.
      setIsEmpty(bundle.sales.length === 0 && bundle.expenses.length === 0)
      setStatus('ready')
      return built
    } catch {
      setStatus('error')
      setMessage('Gagal memuat data laporan. Periksa koneksi lalu coba lagi.')
      return null
    }
  }, [])

  useEffect(() => {
    load(start, end)
    // hanya sekali di mount; perubahan periode lewat tombol "Terapkan".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePdf() {
    setPdfBusy(true)
    setMessage(null)
    try {
      const fresh = await load(start, end)
      if (!fresh) return // pesan error sudah diset oleh load
      const { shareInvestorReportPdf } = await import('../lib/investorReportPdf')
      const res = await shareInvestorReportPdf(fresh)
      setMessage(res === 'shared' ? 'PDF dibagikan.' : 'PDF diunduh.')
    } catch {
      setMessage('Gagal membuat PDF. Coba lagi.')
    } finally {
      setPdfBusy(false)
    }
  }

  async function handleJson() {
    setJsonBusy(true)
    setMessage(null)
    try {
      const fresh = await load(start, end)
      if (!fresh) return // pesan error sudah diset oleh load
      const blob = new Blob([JSON.stringify(fresh, null, 2)], { type: 'application/json' })
      downloadBlob(blob, investorReportFilename('json', fresh.period))
      setMessage('JSON diunduh.')
    } finally {
      setJsonBusy(false)
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
        <h2 className="text-[22px] font-extrabold tracking-[-.01em] text-ink">Laporan Investor</h2>
      </div>

      <p className="text-[13.5px] text-ink-2">
        Laporan keuangan ringkas (laba rugi akrual, unit economics, tren, arus kas, piutang, aset)
        untuk diperlihatkan ke calon investor. Unduh sebagai PDF atau JSON dengan angka identik.
      </p>

      {/* Pemilih periode */}
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
        <label className="mb-3 flex items-center justify-between gap-2 text-sm">
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
        <button
          type="button"
          onClick={() => load(start, end)}
          disabled={status === 'loading'}
          className="h-11 w-full rounded-[12px] bg-tint font-bold text-tint-ink active:bg-tint-dark disabled:opacity-60"
        >
          {status === 'loading' ? 'Memuat…' : 'Terapkan periode'}
        </button>
      </div>

      {message && (
        <p role="status" className="rounded-[12px] bg-bg-soft px-3 py-2.5 text-sm text-ink-2">
          {message}
        </p>
      )}

      {status === 'loading' && <p className="text-muted">Menyiapkan laporan…</p>}
      {status === 'error' && !report && (
        <p className="text-danger">Gagal memuat laporan.</p>
      )}

      {report && (
        <>
          {isEmpty && (
            <p className="rounded-[12px] bg-bg-soft px-3 py-2.5 text-sm text-ink-2">
              Belum ada data pada periode ini. Laporan tetap bisa diunduh (semua nilai nol).
            </p>
          )}

          <ReportPreview report={report} />

          <div className="flex flex-col gap-2">
            {/* Kedua tombol memuat ulang data dulu (angka segar saat unduh),
                jadi keduanya dikunci selama salah satu proses berjalan. */}
            <button
              type="button"
              disabled={pdfBusy || jsonBusy}
              onClick={handlePdf}
              className="h-[54px] rounded-2xl bg-brand text-base font-extrabold text-white shadow-[0_6px_16px_rgba(226,81,126,.28)] active:bg-brand-dark disabled:opacity-60"
            >
              {pdfBusy ? 'Memuat data & menyiapkan PDF…' : 'Unduh PDF'}
            </button>
            <button
              type="button"
              disabled={pdfBusy || jsonBusy}
              onClick={handleJson}
              className="h-[54px] rounded-2xl bg-money text-base font-extrabold text-white shadow-[0_6px_16px_rgba(46,155,104,.25)] active:bg-money-dark disabled:opacity-60"
            >
              {jsonBusy ? 'Memuat data & menyiapkan JSON…' : 'Unduh JSON'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pratinjau (dirender dari objek InvestorReport yang sama dengan PDF & JSON)
// ---------------------------------------------------------------------------

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]">
      <h3 className="mb-3 text-[15px] font-extrabold text-ink">{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-1 ${strong ? 'font-extrabold' : ''}`}>
      <span className={strong ? 'text-ink' : 'text-ink-2'}>{label}</span>
      <span className={value < 0 ? 'text-danger' : 'text-ink'}>{formatRupiah(value)}</span>
    </div>
  )
}

function ReportPreview({ report }: { report: InvestorReport }) {
  const { businessProfile: bp, ringkasanEksekutif: rs, labaRugi: pl } = report
  const summary: { label: string; value: string; danger?: boolean }[] = [
    { label: 'Omzet', value: formatRupiah(rs.omzet) },
    { label: 'Laba kotor', value: formatRupiah(rs.labaKotor), danger: rs.labaKotor < 0 },
    { label: 'Laba bersih', value: formatRupiah(rs.labaBersih), danger: rs.labaBersih < 0 },
    { label: 'Margin kotor', value: pctText(rs.marginKotorPct) },
    { label: 'Margin bersih', value: pctText(rs.marginBersihPct) },
    { label: 'Transaksi', value: rs.totalTransaksi.toLocaleString('id-ID') },
    { label: 'Botol', value: rs.totalBotol.toLocaleString('id-ID') },
    { label: 'Arus kas bersih', value: formatRupiah(rs.netCash), danger: rs.netCash < 0 },
    { label: 'Piutang', value: formatRupiah(rs.piutangTotal) },
  ]

  return (
    <div className="flex flex-col gap-3">
      <Card title="Profil Usaha">
        <p className="text-[13.5px] text-ink-2">{bp.deskripsi}</p>
        <p className="mt-2 text-xs text-muted">
          {bp.nama} · {bp.jenisUsaha} · {bp.lokasi} · {bp.jumlahOperator} operator
        </p>
        <p className="mt-1 text-xs text-muted">
          Periode {formatDateWIB(report.period.start)} — {formatDateWIB(report.period.end)}
        </p>
      </Card>

      <Card title="Ringkasan Eksekutif">
        <div className="grid grid-cols-2 gap-2">
          {summary.map((c) => (
            <div key={c.label} className="rounded-[14px] bg-bg-soft px-3 py-2">
              <p className="text-[11px] text-muted">{c.label}</p>
              <p className={`text-[15px] font-extrabold ${c.danger ? 'text-danger' : 'text-ink'}`}>
                {c.value}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Laba Rugi (Akrual)">
        <div className="text-sm">
          <Row label="Omzet" value={pl.omzet} />
          <Row label="HPP terjual" value={-pl.cogs} />
          <Row label="Laba kotor" value={pl.labaKotor} strong />
          {pl.opexByCategory.map((o) => (
            <Row
              key={o.category}
              label={`Opex — ${EXPENSE_LABEL[o.category] ?? o.category}`}
              value={-o.amount}
            />
          ))}
          <Row label="Total opex" value={-pl.opex} />
          <Row label="Depresiasi" value={-pl.depresiasi} />
          <div className="my-1 border-t border-line" />
          <Row label="Laba bersih" value={pl.labaBersih} strong />
        </div>
      </Card>

      <Card title="Unit Economics per Kanal">
        {report.unitEconomics.length === 0 ? (
          <p className="text-sm text-muted">Belum ada penjualan pada periode ini.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {report.unitEconomics.map((c) => (
              <li key={c.channel} className="rounded-[14px] bg-bg-soft px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">{c.channelLabel}</span>
                  <span className="font-extrabold text-ink">{formatRupiah(c.omzet)}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {c.bottles.toLocaleString('id-ID')} botol · laba kotor{' '}
                  {formatRupiah(c.labaKotor)} · margin {pctText(c.marginPct)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Tren Bulanan">
        <ul className="flex flex-col gap-1.5">
          {report.trenBulanan.map((p) => (
            <li key={p.month} className="flex items-center justify-between gap-2 text-sm">
              <span className="w-20 shrink-0 text-ink-2">{monthLabel(p.month)}</span>
              <span className="flex-1 text-right font-bold text-ink">{formatRupiah(p.omzet)}</span>
              <span
                className={`w-16 text-right text-xs ${
                  p.omzetGrowthPct == null
                    ? 'text-muted'
                    : p.omzetGrowthPct < 0
                      ? 'text-danger'
                      : 'text-money-dark'
                }`}
              >
                {p.omzetGrowthPct == null
                  ? '—'
                  : `${p.omzetGrowthPct > 0 ? '+' : ''}${pctText(p.omzetGrowthPct)}`}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Arus Kas & Piutang">
        <div className="text-sm">
          <Row label="Kas masuk" value={report.arusKas.cashIn} />
          <Row label="Kas keluar" value={-report.arusKas.cashOut} />
          <Row label="Arus kas bersih" value={report.arusKas.netCash} strong />
          <div className="my-1 border-t border-line" />
          <Row label="Piutang 0–7 hari" value={report.piutang.bucket0to7} />
          <Row label="Piutang 8–30 hari" value={report.piutang.bucket8to30} />
          <Row label="Piutang di atas 30 hari" value={report.piutang.bucketOver30} />
          <Row label="Total piutang" value={report.piutang.total} strong />
        </div>
      </Card>

      <Card title="Aset Usaha">
        {report.aset.items.length === 0 ? (
          <p className="text-sm text-muted">Belum ada aset tercatat.</p>
        ) : (
          <ul className="mb-2 flex flex-col gap-1.5">
            {report.aset.items.map((a, i) => (
              <li
                key={`${a.name}-${a.purchasedAt}-${i}`}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-bold text-ink">{a.name}</span>
                  {!a.isActive && <span className="text-muted"> (nonaktif)</span>}
                  <span className="block text-xs text-muted">
                    Beli {formatDateWIB(a.purchasedAt)}
                  </span>
                </span>
                <span className="shrink-0 font-bold text-ink">{formatRupiah(a.cost)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="text-sm">
          <Row label="Total nilai aset aktif" value={report.aset.totalNilaiAktif} strong />
          <Row label="Depresiasi periode ini" value={report.aset.akumulasiDepresiasiPeriode} />
        </div>
      </Card>

      <Card title="Metodologi">
        <div className="flex flex-col gap-3">
          {report.metodologi.map((sec) => (
            <div key={sec.judul}>
              <p className="text-[13.5px] font-bold text-ink">{sec.judul}</p>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-[12.5px] text-ink-2">
                {sec.isi.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <p className="px-1 text-xs text-muted">{report.disclaimer}</p>
    </div>
  )
}
