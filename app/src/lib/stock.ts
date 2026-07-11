import { supabase } from './supabase'
import type { Channel } from './pricing'

// Satu-satunya pintu perubahan stok dari aplikasi.
// Implementasi atomik ada di fungsi DB record_sale/undo_sale
// (supabase/migrations), tercatat di stock_movements.

export type SaleItemInput = {
  variantId: string
  qty: number
  unitPrice: number
  lineTotal: number
}

export type StockWarning = {
  name: string
  size_ml: number
  qty_after: number
}

export type RecordSaleInput = {
  channel: Channel
  payment: 'cash' | 'qris'
  status: 'lunas' | 'belum_lunas'
  customerId: string | null
  promoApplied: string | null
  subtotal: number
  discount: number
  total: number
  items: SaleItemInput[]
  /** Terisi = koreksi: transaksi lama dibatalkan atomik bersama penyimpanan yang baru. */
  replaceSaleId?: string | null
}

export async function recordSale(
  input: RecordSaleInput,
): Promise<{ saleId: string; stockWarnings: StockWarning[] }> {
  const { data, error } = await supabase.rpc('record_sale', {
    p_channel: input.channel,
    p_payment: input.payment,
    p_status: input.status,
    p_customer_id: input.customerId,
    p_promo_applied: input.promoApplied,
    p_subtotal: input.subtotal,
    p_discount: input.discount,
    p_total: input.total,
    p_items: input.items.map((i) => ({
      variant_id: i.variantId,
      qty: i.qty,
      unit_price: i.unitPrice,
      line_total: i.lineTotal,
    })),
    p_replace_sale_id: input.replaceSaleId ?? null,
  })
  if (error) throw error
  return { saleId: data.sale_id, stockWarnings: data.stock_warnings ?? [] }
}

export async function deleteSale(saleId: string): Promise<void> {
  const { error } = await supabase.rpc('undo_sale', { p_sale_id: saleId })
  if (error) throw error
}

export type IngredientWarning = {
  name: string
  unit: string
  qty_after: number
}

export type ProductionItemInput = {
  variantId: string
  qty: number
}

/** Catat batch produksi: stok jadi bertambah, stok bahan berkurang sesuai resep. */
export async function recordProduction(input: {
  batchDate: string // YYYY-MM-DD (WIB)
  note: string | null
  items: ProductionItemInput[]
}): Promise<{ batchId: string; ingredientWarnings: IngredientWarning[] }> {
  const { data, error } = await supabase.rpc('record_production', {
    p_batch_date: input.batchDate,
    p_note: input.note,
    p_items: input.items.map((i) => ({ variant_id: i.variantId, qty: i.qty })),
  })
  if (error) throw error
  return { batchId: data.batch_id, ingredientWarnings: data.ingredient_warnings ?? [] }
}

/** Koreksi stok bahan ke nilai baru (kind 'adjustment'). */
export async function adjustIngredientStock(ingredientId: string, newQty: number): Promise<void> {
  const { error } = await supabase.rpc('adjust_ingredient_stock', {
    p_ingredient_id: ingredientId,
    p_new_qty: newQty,
  })
  if (error) throw error
}

/** Tandai botol jadi rusak (spoilage) atau dibagikan (giveaway). */
export async function writeOffFinished(
  variantId: string,
  qty: number,
  kind: 'spoilage' | 'giveaway',
): Promise<void> {
  const { error } = await supabase.rpc('write_off_finished', {
    p_variant_id: variantId,
    p_qty: qty,
    p_kind: kind,
  })
  if (error) throw error
}
