import { expect, test } from 'vitest'
import { buildShoppingText, computeShoppingList } from './shopping'
import type { IngredientStock, PlanLine, RecipeNeed } from './shopping'

// Data uji: 2 varian berbagi bahan susu.
const recipes: RecipeNeed[] = [
  { variantId: 'susu-kurma', ingredientId: 'susu', qtyPerBottle: 167 },
  { variantId: 'susu-kurma', ingredientId: 'kurma', qtyPerBottle: 42 },
  { variantId: 'susu-kurma', ingredientId: 'botol', qtyPerBottle: 1 },
  { variantId: 'straw-almond', ingredientId: 'susu', qtyPerBottle: 100 },
  { variantId: 'straw-almond', ingredientId: 'stroberi', qtyPerBottle: 80 },
]

const ingredients: IngredientStock[] = [
  { id: 'susu', name: 'Susu', unit: 'ml', stockQty: 1000 },
  { id: 'kurma', name: 'Kurma', unit: 'gram', stockQty: 300 },
  { id: 'botol', name: 'Botol', unit: 'pcs', stockQty: 0 },
  { id: 'stroberi', name: 'Stroberi', unit: 'gram', stockQty: 500 },
  { id: 'jahe', name: 'Jahe', unit: 'gram', stockQty: 100 }, // tidak dipakai resep mana pun
]

test('daftar belanja: kebutuhan lintas varian dijumlah per bahan, dikurangi stok', () => {
  const plan: PlanLine[] = [
    { variantId: 'susu-kurma', bottles: 10 },
    { variantId: 'straw-almond', bottles: 5 },
  ]
  const list = computeShoppingList(plan, recipes, ingredients)

  const susu = list.find((l) => l.ingredientId === 'susu')!
  expect(susu.needed).toBe(167 * 10 + 100 * 5) // 2170
  expect(susu.toBuy).toBe(2170 - 1000) // 1170

  const kurma = list.find((l) => l.ingredientId === 'kurma')!
  expect(kurma.needed).toBe(420)
  expect(kurma.toBuy).toBe(120)

  const botol = list.find((l) => l.ingredientId === 'botol')!
  expect(botol.toBuy).toBe(10)

  // bahan yang tidak dibutuhkan rencana tidak muncul
  expect(list.find((l) => l.ingredientId === 'jahe')).toBeUndefined()
})

test('stok cukup: toBuy 0, tidak negatif', () => {
  const plan: PlanLine[] = [{ variantId: 'straw-almond', bottles: 5 }]
  const list = computeShoppingList(plan, recipes, ingredients)
  const stroberi = list.find((l) => l.ingredientId === 'stroberi')!
  expect(stroberi.needed).toBe(400)
  expect(stroberi.toBuy).toBe(0)
})

test('rencana 0 botol atau kosong menghasilkan daftar kosong', () => {
  expect(computeShoppingList([], recipes, ingredients)).toEqual([])
  expect(
    computeShoppingList([{ variantId: 'susu-kurma', bottles: 0 }], recipes, ingredients),
  ).toEqual([])
})

test('teks WhatsApp hanya memuat bahan yang perlu dibeli', () => {
  const plan: PlanLine[] = [
    { variantId: 'susu-kurma', bottles: 10 },
    { variantId: 'straw-almond', bottles: 5 },
  ]
  const text = buildShoppingText(computeShoppingList(plan, recipes, ingredients), 'Sabtu, 11 Juli 2026')
  expect(text).toContain('Daftar Belanja JE&DA — Sabtu, 11 Juli 2026')
  expect(text).toContain('• Susu: 1.170 ml')
  expect(text).toContain('• Botol: 10 pcs')
  expect(text).not.toContain('Stroberi')
})
