import type { Channel } from './pricing'

// Semua perhitungan rekap adalah fungsi murni, teruji terhadap data hitung tangan.
// Uang integer rupiah. HPP terjual mengutamakan hpp_at_sale (dibekukan saat
// transaksi); bila null, fallback ke HPP resep terkini (varian tanpa resep = 0).

export type ExpenseCategory =
  | 'bahan'
  | 'kemasan'
  | 'listrik'
  | 'bensin'
  | 'galon'
  | 'es'
  | 'lainnya'
  | 'sewa'
  | 'gaji'
  | 'promosi'

export const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: 'bahan', label: 'Bahan' },
  { key: 'kemasan', label: 'Kemasan' },
  { key: 'listrik', label: 'Listrik' },
  { key: 'bensin', label: 'Bensin' },
  { key: 'galon', label: 'Galon' },
  { key: 'es', label: 'Es' },
  { key: 'sewa', label: 'Sewa' },
  { key: 'gaji', label: 'Gaji' },
  { key: 'promosi', label: 'Promosi' },
  { key: 'lainnya', label: 'Lainnya' },
]

export type SaleItemRecord = {
  variantId: string
  qty: number
  lineTotal: number
  /** HPP per botol yang dibekukan saat transaksi. null → pakai biaya resep terkini. */
  hppAtSale?: number | null
}

export type SaleRecord = {
  channel: Channel
  payment: 'cash' | 'qris'
  total: number
  customerId: string | null
  items: SaleItemRecord[]
}

export type SaleRecordWithDate = SaleRecord & { dateWIB: string }

export type ExpenseRecord = { category: ExpenseCategory; amount: number }

export type VariantMeta = { productId: string; productName: string; sizeMl: number }

export type ChannelBreakdown = {
  channel: Channel
  omzet: number
  bottles: number
  count: number
}

export type TopProduct = {
  productId: string
  productName: string
  qty: number
  omzet: number
}

export const CHANNEL_ORDER: Channel[] = ['lapak', 'cfd', 'online', 'bulk']

/**
 * HPP per botol terjual: utamakan snapshot `hppAtSale` (dibekukan saat transaksi),
 * bila null/kosong fallback ke biaya resep terkini, lalu 0 (varian tanpa resep).
 * Satu-satunya sumber logika ini; dipakai `aggregate` di sini dan `finance.ts`.
 */
export function resolveHppPerBottle(
  item: { variantId: string; hppAtSale?: number | null },
  hppByVariant: Map<string, number>,
): number {
  return item.hppAtSale ?? hppByVariant.get(item.variantId) ?? 0
}

type Totals = {
  omzet: number
  bottles: number
  transactionCount: number
  byChannel: ChannelBreakdown[]
  cash: number
  qris: number
  hppSold: number
  topProducts: TopProduct[]
}

function aggregate(
  sales: SaleRecord[],
  hppByVariant: Map<string, number>,
  variantMeta: Map<string, VariantMeta>,
): Totals {
  let omzet = 0
  let bottles = 0
  let cash = 0
  let qris = 0
  let hppSold = 0
  const channelMap = new Map<Channel, ChannelBreakdown>()
  const productMap = new Map<string, TopProduct>()

  for (const sale of sales) {
    omzet += sale.total
    if (sale.payment === 'cash') cash += sale.total
    else qris += sale.total

    const ch = channelMap.get(sale.channel) ?? {
      channel: sale.channel,
      omzet: 0,
      bottles: 0,
      count: 0,
    }
    ch.omzet += sale.total
    ch.count += 1

    for (const item of sale.items) {
      bottles += item.qty
      ch.bottles += item.qty
      // Utamakan HPP yang dibekukan saat transaksi (hppAtSale); bila null/kosong
      // (varian tanpa resep atau data lama belum di-backfill) pakai biaya terkini.
      const hppPerBottle = resolveHppPerBottle(item, hppByVariant)
      hppSold += item.qty * hppPerBottle

      const meta = variantMeta.get(item.variantId)
      const productId = meta?.productId ?? item.variantId
      const productName = meta?.productName ?? '(tak dikenal)'
      const prod = productMap.get(productId) ?? { productId, productName, qty: 0, omzet: 0 }
      prod.qty += item.qty
      prod.omzet += item.lineTotal
      productMap.set(productId, prod)
    }
    channelMap.set(sale.channel, ch)
  }

  const byChannel = CHANNEL_ORDER.filter((c) => channelMap.has(c)).map((c) => channelMap.get(c)!)
  const topProducts = [...productMap.values()]
    .sort((a, b) => b.qty - a.qty || b.omzet - a.omzet)
    .slice(0, 5)

  return {
    omzet,
    bottles,
    transactionCount: sales.length,
    byChannel,
    cash,
    qris,
    hppSold,
    topProducts,
  }
}

export type DailyRecap = Totals & {
  totalExpenses: number
  labaKotor: number
}

export function computeDailyRecap(
  sales: SaleRecord[],
  expenses: ExpenseRecord[],
  hppByVariant: Map<string, number>,
  variantMeta: Map<string, VariantMeta>,
): DailyRecap {
  const totals = aggregate(sales, hppByVariant, variantMeta)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  return {
    ...totals,
    totalExpenses,
    labaKotor: totals.omzet - totals.hppSold - totalExpenses,
  }
}

export type TrendPoint = { date: string; omzet: number; bottles: number }

export type PeriodRecap = DailyRecap & {
  trend: TrendPoint[]
}

export function computePeriodRecap(
  sales: SaleRecordWithDate[],
  expenses: ExpenseRecord[],
  hppByVariant: Map<string, number>,
  variantMeta: Map<string, VariantMeta>,
  dates: string[],
): PeriodRecap {
  const daily = computeDailyRecap(sales, expenses, hppByVariant, variantMeta)

  const omzetByDate = new Map<string, { omzet: number; bottles: number }>()
  for (const d of dates) omzetByDate.set(d, { omzet: 0, bottles: 0 })
  for (const sale of sales) {
    const point = omzetByDate.get(sale.dateWIB)
    if (!point) continue
    point.omzet += sale.total
    for (const item of sale.items) point.bottles += item.qty
  }
  const trend = dates.map((date) => ({ date, ...omzetByDate.get(date)! }))

  return { ...daily, trend }
}

export type RepeatRate = { identified: number; repeat: number; rate: number }

/**
 * Repeat customer rate: dari transaksi ber-pelanggan dalam periode,
 * berapa persen yang pelanggannya pernah beli sebelumnya (kapan pun).
 * `sales` harus mencakup seluruh riwayat transaksi ber-pelanggan agar
 * pembelian sebelum periode ikut terhitung.
 */
export function computeRepeatRate(
  sales: { customerId: string | null; soldAt: string }[],
  periodStartISO: string,
  periodEndExclusiveISO: string,
): RepeatRate {
  const withCustomer = sales.filter((s) => s.customerId != null)
  const earliestByCustomer = new Map<string, string>()
  for (const s of withCustomer) {
    const prev = earliestByCustomer.get(s.customerId!)
    if (prev === undefined || s.soldAt < prev) earliestByCustomer.set(s.customerId!, s.soldAt)
  }

  let identified = 0
  let repeat = 0
  for (const s of withCustomer) {
    if (s.soldAt < periodStartISO || s.soldAt >= periodEndExclusiveISO) continue
    identified += 1
    // repeat jika pembelian pertama pelanggan ini lebih awal dari transaksi ini
    if (earliestByCustomer.get(s.customerId!)! < s.soldAt) repeat += 1
  }

  return { identified, repeat, rate: identified === 0 ? 0 : repeat / identified }
}
