import { supabase } from './supabase'
import { addDaysWIB, startOfDayWIB } from './date'
import { PROMO_LABELS } from './pricing'
import { EXPENSE_CATEGORIES } from './reports'
import type { Channel } from './pricing'
import type { ExpenseCategory } from './reports'

const EXPENSE_LABEL = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.key, c.label]),
) as Record<ExpenseCategory, string>

const PAGE_SIZE = 1000 // batas baris per query PostgREST (config.toml max_rows)

/** Ambil seluruh baris dengan paginasi .range() sampai habis (hindari pemotongan diam-diam). */
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

// Pengambilan & pembentukan data untuk ekspor Excel.
// Menghasilkan baris (objek berkunci = judul kolom) + metadata kolom,
// bebas dari library xlsx mana pun.

const WIB = 'Asia/Jakarta'

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WIB,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

const CHANNEL_LABEL: Record<Channel, string> = {
  lapak: 'Lapak',
  cfd: 'CFD',
  online: 'Online',
  bulk: 'Bulk',
}

export type ColumnType = 'text' | 'number' | 'money'
export type ExportColumn = { key: string; type: ColumnType }
export type ExportRow = Record<string, string | number>
export type ExportSheet = { name: string; columns: ExportColumn[]; rows: ExportRow[] }
export type ExportData = { sheets: ExportSheet[]; totalRows: number }

const t = (key: string): ExportColumn => ({ key, type: 'text' })
const n = (key: string): ExportColumn => ({ key, type: 'number' })
const m = (key: string): ExportColumn => ({ key, type: 'money' })

type SaleItem = {
  qty: number
  unit_price: number
  line_total: number
  product_variants: { size_ml: number; products: { name: string } }
}
type Sale = {
  sold_at: string
  channel: Channel
  payment: string
  status: string
  promo_applied: string | null
  subtotal: number
  discount: number
  total: number
  paid_at: string | null
  customers: { name: string } | null
  sale_items: SaleItem[]
}
type ExpenseR = { spent_at: string; category: ExpenseCategory; amount: number; note: string | null }
type Batch = {
  batch_date: string
  note: string | null
  production_items: { qty: number; product_variants: { size_ml: number; products: { name: string } } }[]
}

/** Ambil & bentuk seluruh data pada rentang [startDate, endInclusive] (tanggal WIB). */
export async function fetchExportData(startDate: string, endInclusive: string): Promise<ExportData> {
  const startISO = startOfDayWIB(startDate).toISOString()
  const endISO = startOfDayWIB(addDaysWIB(endInclusive, 1)).toISOString()

  const [sales, expenseRows, batches] = await Promise.all([
    fetchAllRows<Sale>((from, to) =>
      supabase
        .from('sales')
        .select(
          'id, sold_at, channel, payment, status, promo_applied, subtotal, discount, total, paid_at, customers (name), sale_items (qty, unit_price, line_total, product_variants (size_ml, products (name)))',
        )
        .gte('sold_at', startISO)
        .lt('sold_at', endISO)
        .order('sold_at')
        .range(from, to) as unknown as PromiseLike<{ data: Sale[] | null; error: unknown }>,
    ),
    fetchAllRows<ExpenseR>((from, to) =>
      supabase
        .from('expenses')
        .select('spent_at, category, amount, note')
        .gte('spent_at', startDate)
        .lte('spent_at', endInclusive)
        .order('spent_at')
        .range(from, to) as unknown as PromiseLike<{ data: ExpenseR[] | null; error: unknown }>,
    ),
    fetchAllRows<Batch>((from, to) =>
      supabase
        .from('production_batches')
        .select('batch_date, note, production_items (qty, product_variants (size_ml, products (name)))')
        .gte('batch_date', startDate)
        .lte('batch_date', endInclusive)
        .order('batch_date')
        .range(from, to) as unknown as PromiseLike<{ data: Batch[] | null; error: unknown }>,
    ),
  ])

  const penjualan: ExportRow[] = sales.map((s) => ({
    Tanggal: fmtDate(s.sold_at),
    Waktu: fmtTime(s.sold_at),
    Kanal: CHANNEL_LABEL[s.channel],
    Pembayaran: s.payment === 'cash' ? 'Cash' : 'QRIS',
    Status: s.status === 'lunas' ? 'Lunas' : 'Belum lunas',
    Pelanggan: s.customers?.name ?? '',
    Promo: s.promo_applied ? (PROMO_LABELS[s.promo_applied as keyof typeof PROMO_LABELS] ?? s.promo_applied) : '',
    Subtotal: s.subtotal,
    Diskon: s.discount,
    Total: s.total,
    'Tanggal Bayar': s.paid_at ? fmtDate(s.paid_at) : '',
  }))

  const item: ExportRow[] = sales.flatMap((s) =>
    s.sale_items.map((i) => ({
      Tanggal: fmtDate(s.sold_at),
      Kanal: CHANNEL_LABEL[s.channel],
      Produk: i.product_variants.products.name,
      'Ukuran (ml)': i.product_variants.size_ml,
      Jumlah: i.qty,
      'Harga Satuan': i.unit_price,
      'Total Baris': i.line_total,
    })),
  )

  const pengeluaran: ExportRow[] = expenseRows.map((e) => ({
    Tanggal: e.spent_at,
    Kategori: EXPENSE_LABEL[e.category] ?? e.category,
    Jumlah: e.amount,
    Catatan: e.note ?? '',
  }))

  const produksi: ExportRow[] = batches.flatMap((b) =>
    b.production_items.map((p) => ({
      Tanggal: b.batch_date,
      Produk: p.product_variants.products.name,
      'Ukuran (ml)': p.product_variants.size_ml,
      'Jumlah Botol': p.qty,
      Catatan: b.note ?? '',
    })),
  )

  const sheets: ExportSheet[] = [
    {
      name: 'Penjualan',
      columns: [t('Tanggal'), t('Waktu'), t('Kanal'), t('Pembayaran'), t('Status'), t('Pelanggan'), t('Promo'), m('Subtotal'), m('Diskon'), m('Total'), t('Tanggal Bayar')],
      rows: penjualan,
    },
    {
      name: 'Item Penjualan',
      columns: [t('Tanggal'), t('Kanal'), t('Produk'), n('Ukuran (ml)'), n('Jumlah'), m('Harga Satuan'), m('Total Baris')],
      rows: item,
    },
    {
      name: 'Pengeluaran',
      columns: [t('Tanggal'), t('Kategori'), m('Jumlah'), t('Catatan')],
      rows: pengeluaran,
    },
    {
      name: 'Produksi',
      columns: [t('Tanggal'), t('Produk'), n('Ukuran (ml)'), n('Jumlah Botol'), t('Catatan')],
      rows: produksi,
    },
  ]
  return { sheets, totalRows: penjualan.length + item.length + pengeluaran.length + produksi.length }
}
