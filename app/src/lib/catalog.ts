import { supabase } from './supabase'
import type { Category } from './pricing'

export type VariantInfo = {
  variantId: string
  productId: string
  productName: string
  category: Category
  sizeMl: number
  price: number
  /** Nama tampilan, contoh "Immune 500 ml". */
  label: string
}

export const CATEGORY_LABELS: Record<Category, string> = {
  fresh: 'Fresh Juice',
  creamy: 'Creamy',
  ramu: 'Ramu',
}

export async function fetchCatalog(): Promise<VariantInfo[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, product_variants (id, size_ml, price)')
    .eq('is_active', true)
    .order('category')
    .order('name')
  if (error) throw error

  return (data ?? []).flatMap((p) =>
    [...p.product_variants]
      .sort((a, b) => b.size_ml - a.size_ml)
      .map((v) => ({
        variantId: v.id,
        productId: p.id,
        productName: p.name,
        category: p.category as Category,
        sizeMl: v.size_ml,
        price: v.price,
        label: `${p.name} ${v.size_ml} ml`,
      })),
  )
}
