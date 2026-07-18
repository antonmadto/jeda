import { supabase } from './supabase'

// Akses data belanja bahan (tabel ingredient_purchases). Query tipis saja;
// pencatatan belanja lewat recordPurchase di stock.ts (RPC atomik).

export type PurchaseRow = {
  id: string
  purchasedAt: string
  ingredientName: string
  unit: string
  qty: number
  totalCost: number
  note: string | null
}

/** Belanja terbaru, urut tanggal beli terbaru dulu. */
export async function fetchRecentPurchases(limit = 10): Promise<PurchaseRow[]> {
  const { data, error } = await supabase
    .from('ingredient_purchases')
    .select('id, purchased_at, qty, total_cost, note, ingredients (name, unit)')
    .order('purchased_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  type Row = {
    id: string
    purchased_at: string
    qty: number
    total_cost: number
    note: string | null
    ingredients: { name: string; unit: string } | null
  }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    purchasedAt: r.purchased_at,
    ingredientName: r.ingredients?.name ?? '(bahan terhapus)',
    unit: r.ingredients?.unit ?? '',
    qty: r.qty,
    totalCost: r.total_cost,
    note: r.note,
  }))
}
