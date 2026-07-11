// Daftar belanja: kebutuhan bahan untuk target produksi berikutnya
// dikurangi stok tersisa, dikelompokkan per bahan. Fungsi murni.

export type PlanLine = {
  variantId: string
  bottles: number
}

export type RecipeNeed = {
  variantId: string
  ingredientId: string
  qtyPerBottle: number
}

export type IngredientStock = {
  id: string
  name: string
  unit: string
  stockQty: number
}

export type ShoppingLine = {
  ingredientId: string
  name: string
  unit: string
  /** Total kebutuhan untuk rencana produksi. */
  needed: number
  inStock: number
  /** Yang harus dibeli: max(0, needed - inStock). */
  toBuy: number
}

export function computeShoppingList(
  plan: PlanLine[],
  recipes: RecipeNeed[],
  ingredients: IngredientStock[],
): ShoppingLine[] {
  const neededById = new Map<string, number>()
  for (const p of plan) {
    if (p.bottles <= 0) continue
    for (const r of recipes) {
      if (r.variantId !== p.variantId) continue
      neededById.set(
        r.ingredientId,
        (neededById.get(r.ingredientId) ?? 0) + r.qtyPerBottle * p.bottles,
      )
    }
  }

  return ingredients
    .filter((i) => neededById.has(i.id))
    .map((i) => {
      const needed = neededById.get(i.id)!
      return {
        ingredientId: i.id,
        name: i.name,
        unit: i.unit,
        needed,
        inStock: i.stockQty,
        toBuy: Math.max(0, needed - i.stockQty),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

/** Teks siap kirim ke WhatsApp. */
export function buildShoppingText(lines: ShoppingLine[], dateLabel: string): string {
  const toBuy = lines.filter((l) => l.toBuy > 0)
  const header = `Daftar Belanja JE&DA — ${dateLabel}`
  if (toBuy.length === 0) return `${header}\nSemua bahan masih cukup.`
  const rows = toBuy.map((l) => `• ${l.name}: ${l.toBuy.toLocaleString('id-ID')} ${l.unit}`)
  return [header, ...rows].join('\n')
}
