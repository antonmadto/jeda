// Sumber tunggal laporan investor (Fase 8c). Fungsi MURNI: menyusun keluaran
// mesin analisis keuangan (finance.ts) + profil usaha statis + teks metodologi
// menjadi SATU objek InvestorReport bertipe. PDF dan JSON keduanya mengonsumsi
// objek ini apa adanya dan TIDAK menghitung apa pun sendiri (identik secara
// konstruksi). JSON ekspor = objek ini di-serialize apa adanya; kunci camelCase
// adalah skema, `reportVersion` menjaga stabilitas antar versi.
//
// Catatan penamaan versi: orchestrator menyebutnya "report_version"; karena
// seluruh kunci objek ini camelCase (skema untuk agent investor), field-nya
// dinamai `reportVersion` demi konsistensi mesin-baca. Nilainya integer 1.

import {
  computeProfitLoss,
  computeChannelEconomics,
  computeMonthlyTrend,
  computeCashFlow,
} from './finance'
import type {
  DateRange,
  FinanceSale,
  FinanceExpense,
  FinanceAsset,
  ProfitLoss,
  ChannelEconomics,
  MonthlyTrendPoint,
  CashFlow,
  PiutangAging,
} from './finance'
import type { Channel } from './pricing'

// ---------------------------------------------------------------------------
// Profil usaha statis (mudah disunting nanti)
// ---------------------------------------------------------------------------

export type BusinessChannel = { key: Channel; label: string }

export type BusinessProfile = {
  nama: string
  jenisUsaha: string
  lokasi: string
  jumlahOperator: number
  deskripsi: string
  kanal: BusinessChannel[]
}

export const BUSINESS_PROFILE: BusinessProfile = {
  nama: 'JE&DA',
  jenisUsaha: 'Jus cold-pressed',
  lokasi: 'Pandeglang, Banten',
  jumlahOperator: 2,
  deskripsi:
    'JE&DA adalah usaha jus cold-pressed rumahan di Pandeglang, dijalankan dua ' +
    'operator (pemilik dan istri). Produksi dini hari, dijual segar melalui ' +
    'empat kanal.',
  kanal: [
    { key: 'lapak', label: 'Lapak (Toko Dirgantara)' },
    { key: 'cfd', label: 'CFD Pandeglang (Minggu)' },
    { key: 'online', label: 'Online (order harian)' },
    { key: 'bulk', label: 'Bulk (pre-order besar)' },
  ],
}

const CHANNEL_LABEL: Record<Channel, string> = {
  lapak: 'Lapak',
  cfd: 'CFD',
  online: 'Online',
  bulk: 'Bulk',
}

// ---------------------------------------------------------------------------
// Tipe objek laporan
// ---------------------------------------------------------------------------

/** Angka utama halaman ringkasan eksekutif (semuanya diturunkan dari finance.ts). */
export type ExecutiveSummary = {
  omzet: number
  cogs: number
  labaKotor: number
  opex: number
  depresiasi: number
  labaBersih: number
  /** margin kotor %, 1 desimal (0 bila omzet 0). */
  marginKotorPct: number
  /** margin bersih %, 1 desimal (0 bila omzet 0). */
  marginBersihPct: number
  totalTransaksi: number
  totalBotol: number
  kasMasuk: number
  kasKeluar: number
  netCash: number
  piutangTotal: number
  totalAsetAktif: number
}

/** Unit economics per kanal + label kanal untuk tampilan. */
export type ChannelEconomicsReport = ChannelEconomics & { channelLabel: string }

/** Satu baris aset pada laporan. */
export type AssetLine = {
  name: string
  purchasedAt: string // YYYY-MM-DD (WIB)
  cost: number
  usefulLifeMonths: number | null
  isActive: boolean
  /** depresiasi garis lurus per bulan (0 bila tanpa masa manfaat / nonaktif). */
  depresiasiPerBulan: number
}

export type AssetSection = {
  items: AssetLine[]
  /** total nilai perolehan aset AKTIF. */
  totalNilaiAktif: number
  /** total nilai perolehan semua aset (aktif + nonaktif). */
  totalNilaiSemua: number
  /** akumulasi depresiasi selama periode (dari computeProfitLoss.depresiasi). */
  akumulasiDepresiasiPeriode: number
}

export type MethodologySection = { judul: string; isi: string[] }

export type InvestorReport = {
  reportVersion: 1
  /** waktu laporan dibuat (ISO), diserahkan dari luar agar builder tetap murni. */
  generatedAt: string
  /** periode laporan, tanggal WIB inklusif di kedua ujung. */
  period: DateRange
  unitsNote: string
  businessProfile: BusinessProfile
  ringkasanEksekutif: ExecutiveSummary
  labaRugi: ProfitLoss
  unitEconomics: ChannelEconomicsReport[]
  trenBulanan: MonthlyTrendPoint[]
  arusKas: CashFlow
  piutang: PiutangAging
  aset: AssetSection
  metodologi: MethodologySection[]
  disclaimer: string
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Persen 1 desimal dengan guard bagi nol (hasil 0). */
function pct(part: number, whole: number): number {
  if (whole === 0) return 0
  return Math.round((part / whole) * 1000) / 10
}

// ---------------------------------------------------------------------------
// Metodologi (dari "Catatan metodologi (8b)", bahasa Indonesia lugas)
// ---------------------------------------------------------------------------

const METHODOLOGY: MethodologySection[] = [
  {
    judul: 'Basis: akrual dan kas berdampingan',
    isi: [
      'Laba rugi memakai basis akrual (pandangan investor); arus kas memakai basis kas (pandangan uang nyata). Keduanya sengaja disajikan berdampingan dan bisa berbeda pada periode yang sama.',
      'Semua tanggal dihitung pada zona waktu Asia/Jakarta (WIB). Semua nilai uang adalah integer rupiah; persentase dibulatkan satu desimal.',
    ],
  },
  {
    judul: 'A. Laba rugi (akrual)',
    isi: [
      'Omzet diakui saat penjualan terjadi (tanggal jual WIB), termasuk penjualan yang belum lunas.',
      'HPP terjual memakai snapshot HPP per botol yang dibekukan saat transaksi; bila tidak ada, memakai biaya resep terkini sebagai perkiraan terbaik.',
      'Biaya operasional (opex) TIDAK memasukkan belanja bahan dan kemasan, karena biaya barang itu sudah terhitung di dalam HPP; memasukkannya berarti dobel hitung.',
      'Depresiasi memakai metode garis lurus (harga perolehan dibagi masa manfaat bulan), hanya untuk aset aktif yang punya masa manfaat, dihitung penuh per bulan tanpa proporsi harian.',
      'Laba bersih = laba kotor - opex - depresiasi.',
    ],
  },
  {
    judul: 'B. Unit economics per kanal',
    isi: [
      'Per kanal dihitung omzet, jumlah botol, HPP, laba kotor, margin %, harga jual rata-rata per botol, dan porsi diskon.',
      'Pembagian nol dijaga (hasil 0). Uang tetap integer rupiah.',
    ],
  },
  {
    judul: 'C. Tren bulanan',
    isi: [
      'Per bulan WIB dihitung omzet, laba kotor, laba bersih, jumlah transaksi, botol, pertumbuhan omzet bulan-ke-bulan, dan repeat rate.',
      'Pertumbuhan bernilai kosong pada bulan pertama atau bila omzet bulan sebelumnya nol. Repeat rate memakai perhitungan yang sama dengan rekap harian.',
      'Repeat rate (repeatRate) dinyatakan sebagai fraksi 0..1 (contoh 0,25 = 25%), bukan persentase satu desimal seperti kolom persen lainnya.',
    ],
  },
  {
    judul: 'D. Arus kas (kas) dan piutang',
    isi: [
      'Kas masuk diakui saat uang diterima (tanggal pelunasan; penjualan lunas tanpa tanggal pelunasan dianggap tunai saat penjualan).',
      'Kas keluar mencakup SEMUA pengeluaran, termasuk bahan dan kemasan — sengaja berbeda dari laba rugi, karena kas mencatat belanja nyata saat uang keluar.',
      'Piutang adalah penjualan belum lunas tanpa pelunasan per akhir periode, dikelompokkan menurut umur 0–7 hari, 8–30 hari, dan di atas 30 hari sejak tanggal jual.',
    ],
  },
]

const DISCLAIMER =
  'Laporan ini dihasilkan otomatis dari data pencatatan harian aplikasi JE&DA. ' +
  'Ini bukan laporan keuangan yang diaudit. Angka bergantung pada kelengkapan ' +
  'dan ketepatan pencatatan harian.'

const UNITS_NOTE =
  'Semua nilai uang adalah integer rupiah (tanpa desimal). Persentase (kolom berakhiran Pct) ' +
  'dibulatkan satu desimal. Pengecualian: trenBulanan[].repeatRate adalah fraksi 0..1, bukan persen.'

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export type BuildInvestorReportInput = {
  sales: FinanceSale[]
  expenses: FinanceExpense[]
  assets: FinanceAsset[]
  hppByVariant: Map<string, number>
  /** riwayat transaksi ber-pelanggan penuh (untuk repeat rate bulanan). */
  customerHistory: { customerId: string | null; soldAt: string }[]
  range: DateRange
  /** waktu cetak (ISO) — disuplai pemanggil agar builder deterministik & teruji. */
  generatedAt: string
}

/**
 * Susun objek InvestorReport dari input mentah finance. Memanggil fungsi
 * finance.ts secara langsung sehingga angka headline identik dengan finance.ts
 * untuk input yang sama (identitas secara konstruksi). Murni dan deterministik:
 * tidak menyentuh DB, jam, atau UI.
 */
export function buildInvestorReport(input: BuildInvestorReportInput): InvestorReport {
  const { sales, expenses, assets, hppByVariant, customerHistory, range, generatedAt } = input

  const labaRugi = computeProfitLoss(sales, expenses, assets, hppByVariant, range)
  const economics = computeChannelEconomics(sales, hppByVariant, range)
  const trenBulanan = computeMonthlyTrend(
    sales,
    expenses,
    assets,
    hppByVariant,
    customerHistory,
    range,
  )
  const arusKas = computeCashFlow(sales, expenses, range)

  // Total transaksi & botol dari tren (Σ tren = laba rugi periode, terbukti di
  // finance.test.ts) supaya tidak menghitung ulang penyaringan penjualan.
  const totalTransaksi = trenBulanan.reduce((s, p) => s + p.transaksi, 0)
  const totalBotol = trenBulanan.reduce((s, p) => s + p.botol, 0)

  const unitEconomics: ChannelEconomicsReport[] = economics.map((e) => ({
    ...e,
    channelLabel: CHANNEL_LABEL[e.channel],
  }))

  // Aset: total nilai perolehan + baris per aset. Akumulasi depresiasi periode
  // diambil dari labaRugi.depresiasi (bukan dihitung ulang). Depresiasi per bulan
  // per baris hanya alat tampilan (garis lurus round(cost/masa)).
  const assetItems: AssetLine[] = assets.map((a) => ({
    name: a.name,
    purchasedAt: a.purchasedAt,
    cost: a.cost,
    usefulLifeMonths: a.usefulLifeMonths,
    isActive: a.isActive,
    depresiasiPerBulan:
      a.isActive && a.usefulLifeMonths && a.usefulLifeMonths > 0
        ? Math.round(a.cost / a.usefulLifeMonths)
        : 0,
  }))
  const aset: AssetSection = {
    items: assetItems,
    totalNilaiAktif: assets.filter((a) => a.isActive).reduce((s, a) => s + a.cost, 0),
    totalNilaiSemua: assets.reduce((s, a) => s + a.cost, 0),
    akumulasiDepresiasiPeriode: labaRugi.depresiasi,
  }

  const ringkasanEksekutif: ExecutiveSummary = {
    omzet: labaRugi.omzet,
    cogs: labaRugi.cogs,
    labaKotor: labaRugi.labaKotor,
    opex: labaRugi.opex,
    depresiasi: labaRugi.depresiasi,
    labaBersih: labaRugi.labaBersih,
    marginKotorPct: pct(labaRugi.labaKotor, labaRugi.omzet),
    marginBersihPct: pct(labaRugi.labaBersih, labaRugi.omzet),
    totalTransaksi,
    totalBotol,
    kasMasuk: arusKas.cashIn,
    kasKeluar: arusKas.cashOut,
    netCash: arusKas.netCash,
    piutangTotal: arusKas.piutang.total,
    totalAsetAktif: aset.totalNilaiAktif,
  }

  return {
    reportVersion: 1,
    generatedAt,
    period: { start: range.start, end: range.end },
    unitsNote: UNITS_NOTE,
    businessProfile: BUSINESS_PROFILE,
    ringkasanEksekutif,
    labaRugi,
    unitEconomics,
    trenBulanan,
    arusKas,
    piutang: arusKas.piutang,
    aset,
    metodologi: METHODOLOGY,
    disclaimer: DISCLAIMER,
  }
}

/** Nama file dasar untuk unduhan (PDF/JSON). */
export function investorReportFilename(ext: 'pdf' | 'json', range: DateRange): string {
  return `jeda-laporan-investor_${range.start}_${range.end}.${ext}`
}
