import { supabase } from './supabase'

export type IngredientRow = {
  id: string
  name: string
  unit: 'gram' | 'ml' | 'pcs'
  cost_per_unit: number
  stock_qty: number
  reorder_point: number
}

export async function fetchIngredients(): Promise<IngredientRow[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('id, name, unit, cost_per_unit, stock_qty, reorder_point')
    .order('name')
  if (error) throw error
  return (data ?? []) as IngredientRow[]
}

export type FinishedStockRow = {
  variantId: string
  label: string
  qty: number
}

export async function fetchFinishedStock(): Promise<FinishedStockRow[]> {
  const { data, error } = await supabase
    .from('finished_stock')
    .select('qty, product_variants (id, size_ml, products (name))')
  if (error) throw error
  type Row = {
    qty: number
    product_variants: { id: string; size_ml: number; products: { name: string } }
  }
  return ((data ?? []) as unknown as Row[])
    .map((r) => ({
      variantId: r.product_variants.id,
      label: `${r.product_variants.products.name} ${r.product_variants.size_ml} ml`,
      qty: r.qty,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'id'))
}

export type RecipeLineRow = {
  id: string
  ingredient_id: string
  qty: number
}

export async function fetchRecipeLines(variantId: string): Promise<RecipeLineRow[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, ingredient_id, qty')
    .eq('variant_id', variantId)
  if (error) throw error
  return (data ?? []) as RecipeLineRow[]
}

/** Semua baris resep (untuk daftar belanja). */
export async function fetchAllRecipeLines(): Promise<
  { variant_id: string; ingredient_id: string; qty: number }[]
> {
  const { data, error } = await supabase.from('recipes').select('variant_id, ingredient_id, qty')
  if (error) throw error
  return data ?? []
}

export type BatchRow = {
  id: string
  batch_date: string
  note: string | null
  bottles: number
}

export async function fetchRecentBatches(limit = 5): Promise<BatchRow[]> {
  const { data, error } = await supabase
    .from('production_batches')
    .select('id, batch_date, note, production_items (qty)')
    .order('batch_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  type Row = { id: string; batch_date: string; note: string | null; production_items: { qty: number }[] }
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    batch_date: r.batch_date,
    note: r.note,
    bottles: r.production_items.reduce((sum, i) => sum + i.qty, 0),
  }))
}
