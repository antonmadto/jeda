import { supabase } from './supabase'
import { computeCustomerStats } from './customerStats'
import type { CustomerStat } from './customerStats'
import type { Channel } from './pricing'

export type ReceivableRow = {
  id: string
  soldAt: string
  total: number
  channel: Channel
  customerName: string | null
  bottles: number
}

/** Piutang: penjualan belum_lunas, urut paling lama dulu. */
export async function fetchReceivables(): Promise<ReceivableRow[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('id, sold_at, total, channel, customers (name), sale_items (qty)')
    .eq('status', 'belum_lunas')
    .order('sold_at', { ascending: true })
  if (error) throw error
  type Row = {
    id: string
    sold_at: string
    total: number
    channel: Channel
    customers: { name: string } | null
    sale_items: { qty: number }[]
  }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    soldAt: r.sold_at,
    total: r.total,
    channel: r.channel,
    customerName: r.customers?.name ?? null,
    bottles: r.sale_items.reduce((sum, i) => sum + i.qty, 0),
  }))
}

export async function markSalePaid(saleId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_sale_paid', { p_sale_id: saleId })
  if (error) throw error
}

export async function fetchReceivablesCount(): Promise<number> {
  const { count, error } = await supabase
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'belum_lunas')
  if (error) throw error
  return count ?? 0
}

export type CustomerWithStat = CustomerStat & {
  name: string
  phone: string | null
}

/** Daftar pelanggan dengan statistik belanja, urut terakhir beli terbaru. */
export async function fetchCustomersWithStats(): Promise<CustomerWithStat[]> {
  const [{ data: customers, error: cErr }, { data: sales, error: sErr }] = await Promise.all([
    supabase.from('customers').select('id, name, phone'),
    supabase.from('sales').select('customer_id, total, status, sold_at').not('customer_id', 'is', null),
  ])
  if (cErr) throw cErr
  if (sErr) throw sErr

  const stats = new Map(
    computeCustomerStats(
      (sales ?? []).map((s) => ({
        customerId: s.customer_id as string,
        total: s.total,
        status: s.status as 'lunas' | 'belum_lunas',
        soldAt: s.sold_at,
      })),
    ).map((st) => [st.customerId, st]),
  )

  return (customers ?? [])
    .map((c) => {
      const st = stats.get(c.id)
      return {
        customerId: c.id,
        name: c.name,
        phone: c.phone,
        totalSpent: st?.totalSpent ?? 0,
        transactionCount: st?.transactionCount ?? 0,
        lastPurchaseISO: st?.lastPurchaseISO ?? '',
        outstanding: st?.outstanding ?? 0,
      }
    })
    .sort((a, b) => (a.lastPurchaseISO < b.lastPurchaseISO ? 1 : a.lastPurchaseISO > b.lastPurchaseISO ? -1 : a.name.localeCompare(b.name, 'id')))
}

export type CustomerSaleHistoryRow = {
  id: string
  soldAt: string
  channel: Channel
  status: 'lunas' | 'belum_lunas'
  total: number
  itemsSummary: string
}

export async function fetchCustomer(
  customerId: string,
): Promise<{ name: string; phone: string | null } | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('name, phone')
    .eq('id', customerId)
    .single()
  if (error) return null
  return data
}

export async function fetchCustomerHistory(customerId: string): Promise<CustomerSaleHistoryRow[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('id, sold_at, channel, status, total, sale_items (qty, product_variants (size_ml, products (name)))')
    .eq('customer_id', customerId)
    .order('sold_at', { ascending: false })
  if (error) throw error
  type Row = {
    id: string
    sold_at: string
    channel: Channel
    status: 'lunas' | 'belum_lunas'
    total: number
    sale_items: { qty: number; product_variants: { size_ml: number; products: { name: string } } }[]
  }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    soldAt: r.sold_at,
    channel: r.channel,
    status: r.status,
    total: r.total,
    itemsSummary: r.sale_items
      .map((i) => `${i.product_variants.products.name} ${i.product_variants.size_ml}ml ×${i.qty}`)
      .join(', '),
  }))
}
