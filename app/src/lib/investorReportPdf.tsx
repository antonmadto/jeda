// Renderer PDF laporan investor (Fase 8c). Modul ini HANYA di-import secara
// dinamis (di dalam handler unduh LaporanPage), sehingga @react-pdf/renderer
// tidak pernah masuk bundle utama. Komponen dokumen mengonsumsi objek
// InvestorReport apa adanya dan tidak menghitung apa pun (formatRupiah/label
// murni tampilan). Font default Helvetica, tanpa embed font kustom.
//
// oxlint-disable react/only-export-components -- modul ini sengaja mengekspor
// fungsi unduh + komponen dokumen internal; hanya di-import dinamis (bukan
// permukaan fast-refresh).

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import { formatRupiah } from './format'
import { downloadBlob } from './download'
import { investorReportFilename } from './investorReport'
import type {
  InvestorReport,
  ChannelEconomicsReport,
  AssetLine,
  MethodologySection,
} from './investorReport'
import type { ProfitLoss, MonthlyTrendPoint, PiutangAging } from './finance'
import { EXPENSE_CATEGORIES } from './reports'

// --- helper tampilan (bukan perhitungan) ----------------------------------

const WIB = 'Asia/Jakarta'

function formatDateTimeWIB(iso: string): string {
  const d = new Date(iso)
  const tgl = new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
  const jam = new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
  return `${tgl}, ${jam} WIB`
}

function formatDateWIB(dateStr: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${dateStr}T00:00:00+07:00`))
}

/** Label bulan "YYYY-MM" → "Jul 2026". */
function monthLabel(mk: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB,
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${mk}-01T00:00:00+07:00`))
}

function pctText(v: number): string {
  return `${v.toLocaleString('id-ID')}%`
}

function growthText(v: number | null): string {
  if (v == null) return '—'
  const s = v > 0 ? '+' : ''
  return `${s}${v.toLocaleString('id-ID')}%`
}

const EXPENSE_LABEL: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.key, c.label]),
)

// --- gaya ------------------------------------------------------------------

const BRAND = '#C2185B'
const INK = '#2A2A2A'
const MUTED = '#6B6B6B'
const LINE = '#E4E0E2'
const SOFT = '#FBF6F7'
const GOOD = '#2E8B58'
const BAD = '#C0392B'

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 52,
    paddingHorizontal: 40,
    fontSize: 9,
    color: INK,
    lineHeight: 1.4,
  },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: BRAND },
  subtitle: { fontSize: 10, color: MUTED, marginTop: 2 },
  metaRow: { marginTop: 8, fontSize: 9, color: MUTED },
  section: { marginTop: 18 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: INK,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingBottom: 3,
  },
  paragraph: { marginBottom: 4, color: INK },
  // kartu ringkasan
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  summaryCard: {
    width: '33.33%',
    padding: 4,
  },
  summaryCardInner: {
    backgroundColor: SOFT,
    borderRadius: 6,
    padding: 8,
  },
  summaryLabel: { fontSize: 8, color: MUTED },
  summaryValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  // tabel
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE },
  trLast: { flexDirection: 'row' },
  th: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: MUTED,
    padding: 5,
    backgroundColor: SOFT,
  },
  td: { fontSize: 9, padding: 5 },
  tdRight: { fontSize: 9, padding: 5, textAlign: 'right' },
  thRight: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: MUTED,
    padding: 5,
    backgroundColor: SOFT,
    textAlign: 'right',
  },
  totalRow: { backgroundColor: SOFT },
  bold: { fontFamily: 'Helvetica-Bold' },
  // bar
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  barLabel: { width: 60, fontSize: 8, color: MUTED },
  barTrack: { flex: 1, height: 10, backgroundColor: SOFT, borderRadius: 2 },
  barFill: { height: 10, backgroundColor: BRAND, borderRadius: 2 },
  barValue: { width: 78, fontSize: 8, textAlign: 'right' },
  methodItem: { marginBottom: 6 },
  methodTitle: { fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  bullet: { flexDirection: 'row', marginBottom: 1.5 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1, color: INK },
  disclaimer: {
    marginTop: 18,
    padding: 8,
    backgroundColor: SOFT,
    borderRadius: 6,
    fontSize: 8.5,
    color: MUTED,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: MUTED,
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 6,
  },
})

// --- komponen kecil --------------------------------------------------------

function Rp({ value, style }: { value: number; style?: Style }) {
  const extra: Style[] = value < 0 ? [{ color: BAD }] : []
  return <Text style={[...(style ? [style] : []), ...extra]}>{formatRupiah(value)}</Text>
}

function TwoCol({
  label,
  value,
  strong,
  last,
}: {
  label: string
  value: number
  strong?: boolean
  last?: boolean
}) {
  return (
    <View style={[last ? s.trLast : s.tr, strong ? s.totalRow : {}]}>
      <Text style={[s.td, { flex: 1 }, strong ? s.bold : {}]}>{label}</Text>
      <View style={[s.tdRight, { width: 130 }]}>
        <Rp value={value} style={strong ? s.bold : {}} />
      </View>
    </View>
  )
}

function ProfitLossSection({ pl }: { pl: ProfitLoss }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Laba Rugi (Akrual)</Text>
      <View style={s.table}>
        <TwoCol label="Omzet" value={pl.omzet} />
        <TwoCol label="HPP terjual (COGS)" value={-pl.cogs} />
        <TwoCol label="Laba kotor" value={pl.labaKotor} strong />
        {pl.opexByCategory.map((o) => (
          <TwoCol
            key={o.category}
            label={`Opex — ${EXPENSE_LABEL[o.category] ?? o.category}`}
            value={-o.amount}
          />
        ))}
        <TwoCol label="Total opex" value={-pl.opex} />
        <TwoCol label="Depresiasi" value={-pl.depresiasi} />
        <TwoCol label="Laba bersih" value={pl.labaBersih} strong last />
      </View>
      <Text style={[s.subtitle, { marginTop: 4 }]}>
        Opex tidak memuat bahan/kemasan (sudah terhitung di HPP).
      </Text>
    </View>
  )
}

function ChannelSection({ rows }: { rows: ChannelEconomicsReport[] }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Unit Economics per Kanal</Text>
      {rows.length === 0 ? (
        <Text style={s.paragraph}>Belum ada penjualan pada periode ini.</Text>
      ) : (
        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, { flex: 1 }]}>Kanal</Text>
            <Text style={[s.thRight, { width: 90 }]}>Omzet</Text>
            <Text style={[s.thRight, { width: 44 }]}>Botol</Text>
            <Text style={[s.thRight, { width: 90 }]}>Laba kotor</Text>
            <Text style={[s.thRight, { width: 52 }]}>Margin</Text>
          </View>
          {rows.map((r, i) => (
            <View key={r.channel} style={i === rows.length - 1 ? s.trLast : s.tr}>
              <Text style={[s.td, { flex: 1 }]}>{r.channelLabel}</Text>
              <View style={[s.tdRight, { width: 90 }]}>
                <Rp value={r.omzet} />
              </View>
              <Text style={[s.tdRight, { width: 44 }]}>{r.bottles.toLocaleString('id-ID')}</Text>
              <View style={[s.tdRight, { width: 90 }]}>
                <Rp value={r.labaKotor} />
              </View>
              <Text style={[s.tdRight, { width: 52 }]}>{pctText(r.marginPct)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function TrendSection({ rows }: { rows: MonthlyTrendPoint[] }) {
  const maxOmzet = rows.reduce((m, p) => Math.max(m, p.omzet), 0)
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Tren Bulanan</Text>
      <View style={s.table}>
        <View style={s.tr}>
          <Text style={[s.th, { flex: 1 }]}>Bulan</Text>
          <Text style={[s.thRight, { width: 90 }]}>Omzet</Text>
          <Text style={[s.thRight, { width: 90 }]}>Laba bersih</Text>
          <Text style={[s.thRight, { width: 40 }]}>Trx</Text>
          <Text style={[s.thRight, { width: 52 }]}>MoM</Text>
        </View>
        {rows.map((p, i) => (
          <View key={p.month} style={i === rows.length - 1 ? s.trLast : s.tr}>
            <Text style={[s.td, { flex: 1 }]}>{monthLabel(p.month)}</Text>
            <View style={[s.tdRight, { width: 90 }]}>
              <Rp value={p.omzet} />
            </View>
            <View style={[s.tdRight, { width: 90 }]}>
              <Rp value={p.labaBersih} />
            </View>
            <Text style={[s.tdRight, { width: 40 }]}>{p.transaksi.toLocaleString('id-ID')}</Text>
            <Text
              style={[
                s.tdRight,
                { width: 52 },
                p.omzetGrowthPct != null && p.omzetGrowthPct < 0 ? { color: BAD } : {},
                p.omzetGrowthPct != null && p.omzetGrowthPct > 0 ? { color: GOOD } : {},
              ]}
            >
              {growthText(p.omzetGrowthPct)}
            </Text>
          </View>
        ))}
      </View>
      {maxOmzet > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={[s.subtitle, { marginBottom: 4 }]}>Omzet per bulan</Text>
          {rows.map((p) => (
            <View key={p.month} style={s.barRow}>
              <Text style={s.barLabel}>{monthLabel(p.month)}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${(p.omzet / maxOmzet) * 100}%` }]} />
              </View>
              <Text style={s.barValue}>{formatRupiah(p.omzet)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function CashPiutangSection({
  cashIn,
  cashOut,
  netCash,
  piutang,
}: {
  cashIn: number
  cashOut: number
  netCash: number
  piutang: PiutangAging
}) {
  return (
    <View style={s.section} wrap={false}>
      <Text style={s.sectionTitle}>Arus Kas & Piutang</Text>
      <View style={s.table}>
        <TwoCol label="Kas masuk" value={cashIn} />
        <TwoCol label="Kas keluar" value={-cashOut} />
        <TwoCol label="Arus kas bersih" value={netCash} strong />
        <TwoCol label="Piutang — umur 0–7 hari" value={piutang.bucket0to7} />
        <TwoCol label="Piutang — umur 8–30 hari" value={piutang.bucket8to30} />
        <TwoCol label="Piutang — umur di atas 30 hari" value={piutang.bucketOver30} />
        <TwoCol label="Total piutang (akhir periode)" value={piutang.total} strong last />
      </View>
    </View>
  )
}

function AssetSectionView({
  items,
  totalNilaiAktif,
  totalNilaiSemua,
  akumulasiDepresiasiPeriode,
}: {
  items: AssetLine[]
  totalNilaiAktif: number
  totalNilaiSemua: number
  akumulasiDepresiasiPeriode: number
}) {
  return (
    <View style={s.section} wrap={false}>
      <Text style={s.sectionTitle}>Aset Usaha</Text>
      {items.length === 0 ? (
        <Text style={s.paragraph}>Belum ada aset tercatat.</Text>
      ) : (
        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, { flex: 1 }]}>Aset</Text>
            <Text style={[s.thRight, { width: 90 }]}>Perolehan</Text>
            <Text style={[s.thRight, { width: 54 }]}>Masa (bln)</Text>
            <Text style={[s.thRight, { width: 90 }]}>Depr./bln</Text>
            <Text style={[s.thRight, { width: 50 }]}>Status</Text>
          </View>
          {items.map((a, i) => (
            <View key={`${a.name}-${a.purchasedAt}-${i}`} style={i === items.length - 1 ? s.trLast : s.tr}>
              <View style={[s.td, { flex: 1 }]}>
                <Text>{a.name}</Text>
                <Text style={{ fontSize: 7.5, color: MUTED }}>
                  Beli {formatDateWIB(a.purchasedAt)}
                </Text>
              </View>
              <View style={[s.tdRight, { width: 90 }]}>
                <Rp value={a.cost} />
              </View>
              <Text style={[s.tdRight, { width: 54 }]}>{a.usefulLifeMonths ?? '—'}</Text>
              <View style={[s.tdRight, { width: 90 }]}>
                <Rp value={a.depresiasiPerBulan} />
              </View>
              <Text style={[s.tdRight, { width: 50 }]}>{a.isActive ? 'Aktif' : 'Nonaktif'}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={{ marginTop: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={s.bold}>Total nilai aset aktif</Text>
          <Rp value={totalNilaiAktif} style={s.bold} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={{ color: MUTED }}>Total nilai semua aset</Text>
          <Rp value={totalNilaiSemua} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={{ color: MUTED }}>Akumulasi depresiasi periode ini</Text>
          <Rp value={akumulasiDepresiasiPeriode} />
        </View>
      </View>
    </View>
  )
}

function MethodologyView({ sections }: { sections: MethodologySection[] }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Metodologi</Text>
      {sections.map((sec) => (
        <View key={sec.judul} style={s.methodItem} wrap={false}>
          <Text style={s.methodTitle}>{sec.judul}</Text>
          {sec.isi.map((line, i) => (
            <View key={i} style={s.bullet}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>{line}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

// --- dokumen ---------------------------------------------------------------

function InvestorReportDocument({ report }: { report: InvestorReport }) {
  const { businessProfile: bp, ringkasanEksekutif: rs } = report
  const summary: { label: string; value: string; color?: string }[] = [
    { label: 'Omzet', value: formatRupiah(rs.omzet) },
    { label: 'Laba kotor', value: formatRupiah(rs.labaKotor) },
    {
      label: 'Laba bersih',
      value: formatRupiah(rs.labaBersih),
      color: rs.labaBersih < 0 ? BAD : GOOD,
    },
    { label: 'Margin kotor', value: pctText(rs.marginKotorPct) },
    { label: 'Margin bersih', value: pctText(rs.marginBersihPct) },
    { label: 'Transaksi', value: rs.totalTransaksi.toLocaleString('id-ID') },
    { label: 'Botol terjual', value: rs.totalBotol.toLocaleString('id-ID') },
    { label: 'Arus kas bersih', value: formatRupiah(rs.netCash), color: rs.netCash < 0 ? BAD : GOOD },
    { label: 'Piutang', value: formatRupiah(rs.piutangTotal) },
    { label: 'Aset aktif', value: formatRupiah(rs.totalAsetAktif) },
  ]

  const cetak = formatDateTimeWIB(report.generatedAt)

  return (
    <Document title={`Laporan Investor JE&DA ${report.period.start} sd ${report.period.end}`}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View>
          <Text style={s.title}>Laporan Keuangan Investor</Text>
          <Text style={s.subtitle}>
            {bp.nama} — {bp.jenisUsaha}, {bp.lokasi}
          </Text>
          <Text style={s.metaRow}>
            Periode {formatDateWIB(report.period.start)} s.d. {formatDateWIB(report.period.end)}
          </Text>
          <Text style={s.metaRow}>Dicetak {cetak} · versi laporan {report.reportVersion}</Text>
          <Text style={[s.metaRow, { marginTop: 2 }]}>{report.unitsNote}</Text>
        </View>

        {/* Profil usaha */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Profil Usaha</Text>
          <Text style={s.paragraph}>{bp.deskripsi}</Text>
          <Text style={s.paragraph}>
            Operator: {bp.jumlahOperator} orang. Kanal penjualan:{' '}
            {bp.kanal.map((k) => k.label).join(', ')}.
          </Text>
        </View>

        {/* Ringkasan eksekutif */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Ringkasan Eksekutif</Text>
          <View style={s.summaryGrid}>
            {summary.map((c) => (
              <View key={c.label} style={s.summaryCard}>
                <View style={s.summaryCardInner}>
                  <Text style={s.summaryLabel}>{c.label}</Text>
                  <Text style={[s.summaryValue, c.color ? { color: c.color } : {}]}>{c.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <ProfitLossSection pl={report.labaRugi} />
        <ChannelSection rows={report.unitEconomics} />
        <TrendSection rows={report.trenBulanan} />
        <CashPiutangSection
          cashIn={report.arusKas.cashIn}
          cashOut={report.arusKas.cashOut}
          netCash={report.arusKas.netCash}
          piutang={report.piutang}
        />
        <AssetSectionView
          items={report.aset.items}
          totalNilaiAktif={report.aset.totalNilaiAktif}
          totalNilaiSemua={report.aset.totalNilaiSemua}
          akumulasiDepresiasiPeriode={report.aset.akumulasiDepresiasiPeriode}
        />
        <MethodologyView sections={report.metodologi} />

        <Text style={s.disclaimer}>{report.disclaimer}</Text>

        <View style={s.footer} fixed>
          <Text>
            JE&amp;DA · Dicetak {cetak} · v{report.reportVersion}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Halaman ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}

// --- API unduh (dipanggil dari handler LaporanPage) ------------------------

/**
 * Render InvestorReport jadi PDF, bagikan lewat Web Share API bila didukung
 * (mirror shareImage.ts), fallback unduh. Mengembalikan 'shared' | 'downloaded'.
 */
export async function shareInvestorReportPdf(report: InvestorReport): Promise<'shared' | 'downloaded'> {
  const filename = investorReportFilename('pdf', report.period)
  const blob = await pdf(<InvestorReportDocument report={report} />).toBlob()
  const file = new File([blob], filename, { type: 'application/pdf' })

  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Laporan Investor JE&DA' })
      return 'shared'
    } catch {
      // dibatalkan pengguna; jatuh ke unduh
    }
  }

  downloadBlob(blob, filename)
  return 'downloaded'
}

/** Ekspor komponen dokumen HANYA untuk smoke test render (bukan API publik). */
export const InvestorReportDocumentForTest = InvestorReportDocument
