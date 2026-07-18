import { supabase } from './supabase'
import { computeHpp } from './hpp'
import { addDaysWIB, startOfDayWIB, todayWIB } from './date'
import type { Channel } from './pricing'
import type {
  ExpenseCategory,
  ExpenseRecord,
  SaleRecord,
  SaleRecordWithDate,
  VariantMeta,
} from './reports'

/** HPP per varian dari resep saat ini (varian tanpa resep tidak muncul → dianggap 0). */
export async function fetchHppByVariant(): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('recipes')
    .select('variant_id, qty, ingredients (cost_per_unit)')
  if (error) throw error
  type Row = { variant_id: string; qty: number; ingredients: { cost_per_unit: number } }
  const lines = new Map<string, { qty: number; costPerUnit: number }[]>()
  for (const r of (data ?? []) as unknown as Row[]) {
    const arr = lines.get(r.variant_id) ?? []
    arr.push({ qty: r.qty, costPerUnit: r.ingredients.cost_per_unit })
    lines.set(r.variant_id, arr)
  }
  const out = new Map<string, number>()
  for (const [variantId, ls] of lines) out.set(variantId, computeHpp(ls))
  return out
}

/** Meta varian (produk & ukuran) untuk pengelompokan produk terlaris. */
export async function fetchVariantMeta(): Promise<Map<string, VariantMeta>> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('id, size_ml, product_id, products (name)')
  if (error) throw error
  type Row = { id: string; size_ml: number; product_id: string; products: { name: string } }
  const out = new Map<string, VariantMeta>()
  for (const r of (data ?? []) as unknown as Row[]) {
    out.set(r.id, { productId: r.product_id, productName: r.products.name, sizeMl: r.size_ml })
  }
  return out
}

type SaleRow = {
  sold_at: string
  channel: Channel
  payment: 'cash' | 'qris'
  total: number
  customer_id: string | null
  sale_items: { variant_id: string; qty: number; line_total: number; hpp_at_sale: number | null }[]
}

function toSaleRecord(r: SaleRow): SaleRecord {
  return {
    channel: r.channel,
    payment: r.payment,
    total: r.total,
    customerId: r.customer_id,
    items: r.sale_items.map((i) => ({
      variantId: i.variant_id,
      qty: i.qty,
      lineTotal: i.line_total,
      hppAtSale: i.hpp_at_sale,
    })),
  }
}

async function fetchSalesBetween(startISO: string, endExclusiveISO: string): Promise<SaleRow[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('sold_at, channel, payment, total, customer_id, sale_items (variant_id, qty, line_total, hpp_at_sale)')
    .gte('sold_at', startISO)
    .lt('sold_at', endExclusiveISO)
    .order('sold_at')
  if (error) throw error
  return (data ?? []) as unknown as SaleRow[]
}

async function fetchExpensesBetween(startDate: string, endInclusive: string): Promise<ExpenseRecord[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('category, amount')
    .gte('spent_at', startDate)
    .lte('spent_at', endInclusive)
  if (error) throw error
  return (data ?? []).map((e) => ({ category: e.category as ExpenseCategory, amount: e.amount }))
}

/** Data mentah rekap harian untuk satu tanggal WIB. */
export async function fetchDailyData(
  dateStr: string,
): Promise<{ sales: SaleRecord[]; expenses: ExpenseRecord[] }> {
  const startISO = startOfDayWIB(dateStr).toISOString()
  const endISO = startOfDayWIB(addDaysWIB(dateStr, 1)).toISOString()
  const [rows, expenses] = await Promise.all([
    fetchSalesBetween(startISO, endISO),
    fetchExpensesBetween(dateStr, dateStr),
  ])
  return { sales: rows.map(toSaleRecord), expenses }
}

/** Data mentah rekap periode [startDate, endInclusive] (keduanya tanggal WIB). */
export async function fetchRangeData(
  startDate: string,
  endInclusive: string,
): Promise<{ sales: SaleRecordWithDate[]; expenses: ExpenseRecord[] }> {
  const startISO = startOfDayWIB(startDate).toISOString()
  const endISO = startOfDayWIB(addDaysWIB(endInclusive, 1)).toISOString()
  const [rows, expenses] = await Promise.all([
    fetchSalesBetween(startISO, endISO),
    fetchExpensesBetween(startDate, endInclusive),
  ])
  const sales: SaleRecordWithDate[] = rows.map((r) => ({
    ...toSaleRecord(r),
    dateWIB: todayWIB(new Date(r.sold_at)),
  }))
  return { sales, expenses }
}

/** Seluruh riwayat transaksi ber-pelanggan (untuk repeat rate). */
export async function fetchCustomerSaleHistory(): Promise<
  { customerId: string | null; soldAt: string }[]
> {
  const { data, error } = await supabase
    .from('sales')
    .select('customer_id, sold_at')
    .not('customer_id', 'is', null)
    .order('sold_at')
  if (error) throw error
  return (data ?? []).map((r) => ({ customerId: r.customer_id, soldAt: r.sold_at }))
}
