// Mesin analisis keuangan JE&DA (Fase 8b). Fungsi murni, deterministik, tanpa
// akses DB/UI (tidak mengimpor Supabase). Semua uang integer rupiah; persentase
// boleh pecahan (dibulatkan 1 desimal). Konvensi sama dengan pricing.ts / hpp.ts.
//
// Basis metodologi (keputusan orchestrator, lihat docs/IMPLEMENTATION_PLAN.md
// "Catatan metodologi (8b)"):
//   A. Laba rugi = pandangan AKRUAL (investor). Omzet diakui saat penjualan
//      (sold_at) apa pun statusnya. HPP terjual dari snapshot hpp_at_sale.
//   D. Arus kas = pandangan KAS (cash basis). Kas diakui saat uang berpindah.
// Rekap harian (reports.ts) tetap pandangan kas ala Aiman dan TIDAK diubah.

import { todayWIB, startOfDayWIB, monthBoundsWIB } from './date'
import { CHANNEL_ORDER, resolveHppPerBottle, computeRepeatRate } from './reports'
import { ageInDays } from './customerStats'
import type { Channel } from './pricing'
import type { ExpenseCategory } from './reports'

// ---------------------------------------------------------------------------
// Tipe input (disuplai financeData.ts atau fixture test)
// ---------------------------------------------------------------------------

export type FinanceSaleItem = {
  variantId: string
  qty: number
  lineTotal: number
  /** HPP per botol yang dibekukan saat transaksi. null → fallback biaya resep terkini. */
  hppAtSale?: number | null
}

export type FinanceSale = {
  /** Timestamp ISO transaksi (dikonversi ke tanggal WIB di dalam). */
  soldAt: string
  /** Timestamp ISO pelunasan; null bila belum dibayar. */
  paidAt?: string | null
  channel: Channel
  status: 'lunas' | 'belum_lunas'
  /** Total transaksi setelah diskon, integer rupiah. */
  total: number
  /** Diskon per transaksi (promo/bulk/manual), integer rupiah. */
  discount: number
  customerId: string | null
  items: FinanceSaleItem[]
}

/** Pengeluaran; spentAt sudah tanggal WIB (kolom expenses.spent_at bertipe date). */
export type FinanceExpense = {
  spentAt: string // YYYY-MM-DD (WIB)
  category: ExpenseCategory
  amount: number
}

/** Aset/modal usaha; purchasedAt sudah tanggal WIB (assets.purchased_at date). */
export type FinanceAsset = {
  purchasedAt: string // YYYY-MM-DD (WIB)
  cost: number
  /** null → tanpa depresiasi (menyumbang 0). */
  usefulLifeMonths: number | null
  isActive: boolean
}

/** Rentang periode WIB, inklusif di kedua ujung. */
export type DateRange = { start: string; end: string } // YYYY-MM-DD

// ---------------------------------------------------------------------------
// Helper WIB & pembulatan
// ---------------------------------------------------------------------------

/** Tanggal WIB (YYYY-MM-DD) dari timestamp ISO. */
function wibDate(iso: string): string {
  return todayWIB(new Date(iso))
}

/** Kunci bulan WIB (YYYY-MM) dari timestamp ISO. */
function monthKeyOfISO(iso: string): string {
  return wibDate(iso).slice(0, 7)
}

/** Kunci bulan (YYYY-MM) dari tanggal WIB YYYY-MM-DD. */
function monthKeyOfDate(dateStr: string): string {
  return dateStr.slice(0, 7)
}

/** Indeks bulan absolut (tahun*12 + bulan-1) untuk aritmetika jendela depresiasi. */
function monthIndex(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number)
  return y * 12 + (m - 1)
}

function indexToMonthKey(idx: number): string {
  const y = Math.floor(idx / 12)
  const m = (idx % 12) + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

/** Daftar kunci bulan WIB dalam rentang, inklusif (mis. Jan..Mar). */
function monthsInRange(range: DateRange): string[] {
  const startIdx = monthIndex(monthKeyOfDate(range.start))
  const endIdx = monthIndex(monthKeyOfDate(range.end))
  const out: string[] = []
  for (let i = startIdx; i <= endIdx; i++) out.push(indexToMonthKey(i))
  return out
}

function inRangeDate(dateStr: string, range: DateRange): boolean {
  return dateStr >= range.start && dateStr <= range.end
}

/** Persentase dibulatkan 1 desimal (satu-satunya titik pembulatan persen). */
function round1(x: number): number {
  return Math.round(x * 10) / 10
}

// ---------------------------------------------------------------------------
// 1. Laba rugi (akrual) per periode
// ---------------------------------------------------------------------------

export type ProfitLoss = {
  omzet: number
  /** HPP terjual (cost of goods sold) dari snapshot hpp_at_sale. */
  cogs: number
  labaKotor: number
  /** Pengeluaran operasional per kategori (TANPA bahan/kemasan). */
  opexByCategory: { category: ExpenseCategory; amount: number }[]
  opex: number
  depresiasi: number
  labaBersih: number
}

/**
 * Depresiasi garis lurus untuk sekumpulan bulan. Per bulan yang memenuhi syarat:
 * round(cost / useful_life_months) — pembulatan hanya di sini. Dihitung untuk
 * aset AKTIF ber-useful_life pada bulan m di mana bulan-beli ≤ m < bulan-beli +
 * masa manfaat (granularitas bulan penuh, tanpa proporsi harian). Aset tanpa
 * useful_life_months atau nonaktif menyumbang 0.
 */
function depreciationForMonths(assets: FinanceAsset[], months: string[]): number {
  let total = 0
  for (const a of assets) {
    if (!a.isActive) continue
    if (a.usefulLifeMonths == null || a.usefulLifeMonths <= 0) continue
    const perMonth = Math.round(a.cost / a.usefulLifeMonths)
    const startIdx = monthIndex(monthKeyOfDate(a.purchasedAt))
    const endIdxExclusive = startIdx + a.usefulLifeMonths
    for (const mk of months) {
      const idx = monthIndex(mk)
      if (idx >= startIdx && idx < endIdxExclusive) total += perMonth
    }
  }
  return total
}

/** Total HPP terjual untuk transaksi tertentu (snapshot > resep terkini > 0). */
function cogsOfSales(sales: FinanceSale[], hppByVariant: Map<string, number>): number {
  let cogs = 0
  for (const s of sales) {
    for (const it of s.items) cogs += it.qty * resolveHppPerBottle(it, hppByVariant)
  }
  return cogs
}

export function computeProfitLoss(
  sales: FinanceSale[],
  expenses: FinanceExpense[],
  assets: FinanceAsset[],
  hppByVariant: Map<string, number>,
  range: DateRange,
): ProfitLoss {
  // Akrual: akui omzet & HPP saat penjualan (sold_at WIB) apa pun statusnya.
  const periodSales = sales.filter((s) => inRangeDate(wibDate(s.soldAt), range))
  const omzet = periodSales.reduce((sum, s) => sum + s.total, 0)
  const cogs = cogsOfSales(periodSales, hppByVariant)
  const labaKotor = omzet - cogs

  // Opex = pengeluaran periode KECUALI 'bahan' & 'kemasan'. Belanja bahan/kemasan
  // adalah pembelian persediaan yang biayanya SUDAH terwakili di dalam COGS lewat
  // HPP beku; memasukkannya ke opex = dobel hitung biaya barang. (Di arus kas
  // sebaliknya: bahan/kemasan ikut kas keluar — lihat computeCashFlow.)
  const periodExpenses = expenses.filter((e) => inRangeDate(e.spentAt, range))
  const opexMap = new Map<ExpenseCategory, number>()
  for (const e of periodExpenses) {
    if (e.category === 'bahan' || e.category === 'kemasan') continue
    opexMap.set(e.category, (opexMap.get(e.category) ?? 0) + e.amount)
  }
  const opexByCategory = EXPENSE_ORDER.filter((c) => opexMap.has(c)).map((category) => ({
    category,
    amount: opexMap.get(category)!,
  }))
  const opex = opexByCategory.reduce((sum, e) => sum + e.amount, 0)

  const depresiasi = depreciationForMonths(assets, monthsInRange(range))
  const labaBersih = labaKotor - opex - depresiasi

  return { omzet, cogs, labaKotor, opexByCategory, opex, depresiasi, labaBersih }
}

// Urutan kategori stabil untuk output opex (bahan/kemasan tidak pernah masuk opex).
const EXPENSE_ORDER: ExpenseCategory[] = [
  'listrik',
  'bensin',
  'galon',
  'es',
  'sewa',
  'gaji',
  'promosi',
  'lainnya',
]

// ---------------------------------------------------------------------------
// 2. Unit economics per kanal per periode
// ---------------------------------------------------------------------------

export type ChannelEconomics = {
  channel: Channel
  omzet: number
  bottles: number
  cogs: number
  labaKotor: number
  /** margin kotor %, 1 desimal (0 bila omzet 0 — guard bagi nol). */
  marginPct: number
  /** harga jual rata-rata per botol, integer rupiah (0 bila 0 botol). */
  avgPricePerBottle: number
  /** total diskon yang diberikan di kanal ini, integer rupiah. */
  discount: number
  /** porsi diskon kanal ini dari seluruh diskon periode, %, 1 desimal. */
  discountSharePct: number
}

export function computeChannelEconomics(
  sales: FinanceSale[],
  hppByVariant: Map<string, number>,
  range: DateRange,
): ChannelEconomics[] {
  const periodSales = sales.filter((s) => inRangeDate(wibDate(s.soldAt), range))
  const totalDiscount = periodSales.reduce((sum, s) => sum + s.discount, 0)

  type Acc = { omzet: number; bottles: number; cogs: number; discount: number }
  const byChannel = new Map<Channel, Acc>()
  for (const s of periodSales) {
    const acc = byChannel.get(s.channel) ?? { omzet: 0, bottles: 0, cogs: 0, discount: 0 }
    acc.omzet += s.total
    acc.discount += s.discount
    for (const it of s.items) {
      acc.bottles += it.qty
      acc.cogs += it.qty * resolveHppPerBottle(it, hppByVariant)
    }
    byChannel.set(s.channel, acc)
  }

  return CHANNEL_ORDER.filter((c) => byChannel.has(c)).map((channel) => {
    const a = byChannel.get(channel)!
    const labaKotor = a.omzet - a.cogs
    return {
      channel,
      omzet: a.omzet,
      bottles: a.bottles,
      cogs: a.cogs,
      labaKotor,
      marginPct: a.omzet > 0 ? round1((labaKotor / a.omzet) * 100) : 0,
      avgPricePerBottle: a.bottles > 0 ? Math.round(a.omzet / a.bottles) : 0,
      discount: a.discount,
      discountSharePct: totalDiscount > 0 ? round1((a.discount / totalDiscount) * 100) : 0,
    }
  })
}

// ---------------------------------------------------------------------------
// 3. Tren pertumbuhan bulanan
// ---------------------------------------------------------------------------

export type MonthlyTrendPoint = {
  month: string // YYYY-MM
  omzet: number
  labaKotor: number
  labaBersih: number
  transaksi: number
  botol: number
  /** pertumbuhan omzet MoM %, 1 desimal; null untuk bulan pertama / penyebut 0. */
  omzetGrowthPct: number | null
  /** repeat rate bulan itu (fraksi 0..1), lewat computeRepeatRate (reports.ts). */
  repeatRate: number
}

export function computeMonthlyTrend(
  sales: FinanceSale[],
  expenses: FinanceExpense[],
  assets: FinanceAsset[],
  hppByVariant: Map<string, number>,
  /** Seluruh riwayat transaksi ber-pelanggan (agar repeat rate melihat pembelian
   *  sebelum periode); diteruskan apa adanya ke computeRepeatRate. */
  customerHistory: { customerId: string | null; soldAt: string }[],
  range: DateRange,
): MonthlyTrendPoint[] {
  const months = monthsInRange(range)
  const points: MonthlyTrendPoint[] = []
  let prevOmzet: number | null = null

  for (const mk of months) {
    const monthRange: DateRange = { start: `${mk}-01`, end: monthBoundsWIB(`${mk}-01`).end }
    // end di sini eksklusif (tanggal 1 bulan berikutnya).
    // Bucket = kunci bulan WIB DAN di dalam rentang. Syarat kedua penting saat
    // rentang tidak segaris batas bulan: financeData mengambil penjualan tanpa
    // batas bawah (untuk kas/piutang), jadi tanpa inRangeDate bucket bulan tepi
    // ikut menelan baris di luar rentang. Dengan ini Σ(tren) = computeProfitLoss.
    const monthSales = sales.filter(
      (s) => monthKeyOfISO(s.soldAt) === mk && inRangeDate(wibDate(s.soldAt), range),
    )
    const monthExpenses = expenses.filter(
      (e) => monthKeyOfDate(e.spentAt) === mk && inRangeDate(e.spentAt, range),
    )

    const omzet = monthSales.reduce((sum, s) => sum + s.total, 0)
    const cogs = cogsOfSales(monthSales, hppByVariant)
    const labaKotor = omzet - cogs
    const opex = monthExpenses
      .filter((e) => e.category !== 'bahan' && e.category !== 'kemasan')
      .reduce((sum, e) => sum + e.amount, 0)
    const depresiasi = depreciationForMonths(assets, [mk])
    const labaBersih = labaKotor - opex - depresiasi
    const botol = monthSales.reduce((sum, s) => sum + s.items.reduce((q, it) => q + it.qty, 0), 0)

    // MoM: null untuk bulan pertama atau bila omzet bulan sebelumnya 0 (guard nol).
    const omzetGrowthPct =
      prevOmzet == null || prevOmzet === 0 ? null : round1(((omzet - prevOmzet) / prevOmzet) * 100)

    // Repeat rate: pakai batas ISO bulan WIB (start inklusif, end eksklusif).
    const startISO = startOfDayWIB(monthRange.start).toISOString()
    const endExclusiveISO = startOfDayWIB(monthRange.end).toISOString()
    const { rate: repeatRate } = computeRepeatRate(customerHistory, startISO, endExclusiveISO)

    points.push({
      month: mk,
      omzet,
      labaKotor,
      labaBersih,
      transaksi: monthSales.length,
      botol,
      omzetGrowthPct,
      repeatRate,
    })
    prevOmzet = omzet
  }

  return points
}

// ---------------------------------------------------------------------------
// 4. Arus kas (cash basis) + umur piutang
// ---------------------------------------------------------------------------

export type PiutangAging = {
  total: number
  bucket0to7: number // umur ≤ 7 hari
  bucket8to30: number // umur 8..30 hari
  bucketOver30: number // umur > 30 hari
}

export type CashFlow = {
  cashIn: number
  cashOut: number
  netCash: number
  piutang: PiutangAging
}

export function computeCashFlow(
  sales: FinanceSale[],
  expenses: FinanceExpense[],
  range: DateRange,
): CashFlow {
  // Kas masuk (cash basis): tanggal kas = kapan uang benar-benar diterima.
  //   'lunas'       → paid_at bila ada, jika tidak sold_at (transaksi tunai seketika).
  //   'belum_lunas' → hanya paid_at (tanpa paid_at = belum jadi kas).
  let cashIn = 0
  for (const s of sales) {
    let cashISO: string | null = null
    if (s.status === 'lunas') cashISO = s.paidAt ?? s.soldAt
    else if (s.paidAt) cashISO = s.paidAt
    if (cashISO && inRangeDate(wibDate(cashISO), range)) cashIn += s.total
  }

  // Kas keluar: SEMUA pengeluaran menurut spent_at, TERMASUK bahan & kemasan.
  // Ini sengaja asimetris dengan laba rugi (yang mengeluarkan bahan/kemasan dari
  // opex): pandangan kas mencatat belanja nyata saat uang keluar, sedangkan
  // pandangan akrual menaruh biaya barang di COGS saat terjual.
  const cashOut = expenses
    .filter((e) => inRangeDate(e.spentAt, range))
    .reduce((sum, e) => sum + e.amount, 0)

  // Piutang per akhir periode: penjualan belum_lunas tanpa paid_at yang sudah
  // terjadi (sold_at ≤ akhir periode). Umur dihitung dari sold_at ke akhir periode
  // (tengah malam awal tanggal end WIB). Bucket: ≤7, 8..30, >30.
  const asOfISO = startOfDayWIB(range.end).toISOString()
  const piutang: PiutangAging = { total: 0, bucket0to7: 0, bucket8to30: 0, bucketOver30: 0 }
  for (const s of sales) {
    if (s.status !== 'belum_lunas') continue
    if (s.paidAt) continue
    if (wibDate(s.soldAt) > range.end) continue
    piutang.total += s.total
    const age = ageInDays(s.soldAt, asOfISO)
    if (age <= 7) piutang.bucket0to7 += s.total
    else if (age <= 30) piutang.bucket8to30 += s.total
    else piutang.bucketOver30 += s.total
  }

  return { cashIn, cashOut, netCash: cashIn - cashOut, piutang }
}
