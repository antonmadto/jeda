import { supabase } from './supabase'
import { addDaysWIB, startOfDayWIB } from './date'
import { fetchHppByVariant, fetchVariantMeta } from './reportsData'
import type { Channel } from './pricing'
import type { ExpenseCategory, VariantMeta } from './reports'
import type {
  DateRange,
  FinanceAsset,
  FinanceExpense,
  FinanceSale,
} from './finance'

// Pengambil data tipis untuk mesin analisis keuangan (finance.ts). Gaya sama
// dengan reportsData.ts: penanganan rentang WIB identik, paginasi .range() untuk
// menghindari pemotongan diam-diam pada tabel yang bisa membesar.
//
// Catatan rentang: computeCashFlow butuh penjualan yang DIBAYAR dalam periode
// meski TERJUAL sebelum periode, dan piutang butuh seluruh belum_lunas yang
// terjadi hingga akhir periode. Karena itu penjualan diambil sampai akhir
// periode (sold_at < endExclusive), bukan hanya yang terjual dalam periode;
// finance.ts yang memfilter per fungsi (akrual vs kas vs aging).

const PAGE_SIZE = 1000 // batas baris per query PostgREST (config.toml max_rows)

async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const batch = data ?? []
    out.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  return out
}

type SaleRow = {
  sold_at: string
  paid_at: string | null
  channel: Channel
  status: 'lunas' | 'belum_lunas'
  total: number
  discount: number
  customer_id: string | null
  sale_items: { variant_id: string; qty: number; line_total: number; hpp_at_sale: number | null }[]
}

type ExpenseRow = { spent_at: string; category: ExpenseCategory; amount: number }

type AssetRow = {
  name: string
  purchased_at: string
  cost: number
  useful_life_months: number | null
  is_active: boolean
}

function toFinanceSale(r: SaleRow): FinanceSale {
  return {
    soldAt: r.sold_at,
    paidAt: r.paid_at,
    channel: r.channel,
    status: r.status,
    total: r.total,
    discount: r.discount,
    customerId: r.customer_id,
    items: r.sale_items.map((i) => ({
      variantId: i.variant_id,
      qty: i.qty,
      lineTotal: i.line_total,
      hppAtSale: i.hpp_at_sale,
    })),
  }
}

/** Bundel input lengkap untuk seluruh fungsi finance.ts pada satu rentang WIB. */
export type FinanceDataBundle = {
  range: DateRange
  sales: FinanceSale[]
  expenses: FinanceExpense[]
  assets: FinanceAsset[]
  hppByVariant: Map<string, number>
  variantMeta: Map<string, VariantMeta>
  /** Seluruh riwayat transaksi ber-pelanggan (untuk repeat rate bulanan). */
  customerHistory: { customerId: string | null; soldAt: string }[]
}

/**
 * Ambil semua data yang dibutuhkan finance.ts untuk rentang [startDate, endInclusive]
 * (keduanya tanggal WIB, inklusif). Aset & riwayat pelanggan diambil penuh karena
 * depresiasi, aging, dan repeat rate melihat data di luar batas rentang.
 */
export async function fetchFinanceData(
  startDate: string,
  endInclusive: string,
): Promise<FinanceDataBundle> {
  // Batas atas eksklusif: tengah malam WIB setelah tanggal akhir.
  const endExclusiveISO = startOfDayWIB(addDaysWIB(endInclusive, 1)).toISOString()

  const [saleRows, expenseRows, assetRows, historyRows, hppByVariant, variantMeta] =
    await Promise.all([
      fetchAllRows<SaleRow>((from, to) =>
        supabase
          .from('sales')
          .select(
            'sold_at, paid_at, channel, status, total, discount, customer_id, sale_items (variant_id, qty, line_total, hpp_at_sale)',
          )
          // hingga akhir periode (mencakup akrual dalam periode, kas yang dibayar
          // dalam periode meski terjual lebih awal, dan piutang as-of akhir periode)
          .lt('sold_at', endExclusiveISO)
          // .order('id') sekunder: pemecah seri unik agar baris ber-sold_at sama
          // tidak terduplikasi/terlewat di batas halaman paginasi 1000 baris.
          .order('sold_at')
          .order('id')
          .range(from, to) as unknown as PromiseLike<{ data: SaleRow[] | null; error: unknown }>,
      ),
      fetchAllRows<ExpenseRow>((from, to) =>
        supabase
          .from('expenses')
          .select('spent_at, category, amount')
          .gte('spent_at', startDate)
          .lte('spent_at', endInclusive)
          .order('spent_at')
          .order('id')
          .range(from, to) as unknown as PromiseLike<{ data: ExpenseRow[] | null; error: unknown }>,
      ),
      fetchAllRows<AssetRow>((from, to) =>
        supabase
          .from('assets')
          .select('name, purchased_at, cost, useful_life_months, is_active')
          .order('purchased_at')
          .order('id')
          .range(from, to) as unknown as PromiseLike<{ data: AssetRow[] | null; error: unknown }>,
      ),
      fetchAllRows<{ customer_id: string | null; sold_at: string }>((from, to) =>
        supabase
          .from('sales')
          .select('customer_id, sold_at')
          .not('customer_id', 'is', null)
          .order('sold_at')
          .order('id')
          .range(from, to) as unknown as PromiseLike<{
          data: { customer_id: string | null; sold_at: string }[] | null
          error: unknown
        }>,
      ),
      fetchHppByVariant(),
      fetchVariantMeta(),
    ])

  return {
    range: { start: startDate, end: endInclusive },
    sales: saleRows.map(toFinanceSale),
    expenses: expenseRows.map((e) => ({
      spentAt: e.spent_at,
      category: e.category,
      amount: e.amount,
    })),
    assets: assetRows.map((a) => ({
      name: a.name,
      purchasedAt: a.purchased_at,
      cost: a.cost,
      usefulLifeMonths: a.useful_life_months,
      isActive: a.is_active,
    })),
    hppByVariant,
    variantMeta,
    customerHistory: historyRows.map((r) => ({ customerId: r.customer_id, soldAt: r.sold_at })),
  }
}
