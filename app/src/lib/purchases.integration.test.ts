import { createClient } from '@supabase/supabase-js'
import { afterAll, expect, test } from 'vitest'
import { movingAverageCost } from './purchases'

// Test integrasi record_purchase/undo_purchase ke DB sungguhan.
// Memakai bahan sementara sendiri (bukan bahan seed), jadi tidak berebut baris
// dengan production.integration.test.ts walau file berjalan paralel.
// Jalan hanya dengan kredensial akun test ke DB test:
//   E2E_SUPABASE_URL=... E2E_EMAIL=... E2E_PASSWORD=... npm run test
// Setiap test membersihkan datanya sendiri.

declare const process: { env: Record<string, string | undefined> }

const url = process.env.E2E_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL
const key = process.env.E2E_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
// Semua test menulis data — hanya jalan ke DB test, bukan produksi.
const canWrite = Boolean(process.env.E2E_SUPABASE_URL) || process.env.E2E_ALLOW_PROD_WRITES === '1'
const enabled = Boolean(url && key && email && password) && canWrite

const db = createClient(url, key, { auth: { persistSession: false } })
const cleanups: (() => Promise<void>)[] = []

afterAll(async () => {
  for (const c of cleanups.reverse()) await c()
  await db.auth.signOut()
})

async function makeTempIngredient(stockQty: number, cost: number): Promise<string> {
  const { data, error } = await db
    .from('ingredients')
    .insert({ name: 'ZZ Bahan Uji Belanja', unit: 'ml', cost_per_unit: cost, stock_qty: stockQty })
    .select('id')
    .single()
  expect(error).toBeNull()
  const id = data!.id as string
  cleanups.push(async () => {
    await db.from('stock_movements').delete().eq('ingredient_id', id)
    await db.from('ingredient_purchases').delete().eq('ingredient_id', id) // expenses ikut cascade
    await db.from('ingredients').delete().eq('id', id)
  })
  return id
}

test.skipIf(!enabled)(
  'record_purchase: stok naik, cost_per_unit rata-rata bergerak, movement & expense tertaut',
  async () => {
    const { error: loginError } = await db.auth.signInWithPassword({ email: email!, password: password! })
    expect(loginError).toBeNull()

    const ingId = await makeTempIngredient(100, 10) // stok 100 @ Rp10
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

    const { data: res, error } = await db.rpc('record_purchase', {
      p_ingredient_id: ingId,
      p_qty: 100,
      p_total_cost: 3000,
      p_purchased_at: today,
      p_expense_category: 'bahan',
      p_note: 'nota uji',
    })
    expect(error).toBeNull()
    const purchaseId = res.purchase_id as string
    const expectedCost = movingAverageCost(100, 10, 100, 3000) // 20

    expect(res.stock_qty).toBe(200)
    expect(Number(res.cost_per_unit)).toBeCloseTo(expectedCost, 6)

    // ingredients ter-update
    const { data: ing } = await db
      .from('ingredients')
      .select('stock_qty, cost_per_unit')
      .eq('id', ingId)
      .single()
    expect(ing!.stock_qty).toBe(200)
    expect(Number(ing!.cost_per_unit)).toBeCloseTo(expectedCost, 6)

    // stock_movement kind 'purchase' tercatat
    const { data: mv } = await db
      .from('stock_movements')
      .select('kind, ingredient_id, qty_delta')
      .eq('ref_id', purchaseId)
    expect(mv).toEqual([{ kind: 'purchase', ingredient_id: ingId, qty_delta: 100 }])

    // expense tertaut terbentuk, tidak dobel catat
    const { data: exp } = await db
      .from('expenses')
      .select('category, amount, spent_at, purchase_id')
      .eq('purchase_id', purchaseId)
      .single()
    expect(exp!.category).toBe('bahan')
    expect(exp!.amount).toBe(3000)
    expect(exp!.spent_at).toBe(today)
  },
)

test.skipIf(!enabled)(
  'undo_purchase: stok kembali, belanja & expense tertaut terhapus, cost_per_unit dibiarkan',
  async () => {
    await db.auth.signInWithPassword({ email: email!, password: password! })

    const ingId = await makeTempIngredient(100, 10)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

    const { data: res } = await db.rpc('record_purchase', {
      p_ingredient_id: ingId,
      p_qty: 100,
      p_total_cost: 3000,
      p_purchased_at: today,
      p_expense_category: 'kemasan',
      p_note: null,
    })
    const purchaseId = res.purchase_id as string
    const costAfterBuy = Number(res.cost_per_unit) // 20

    const { error: undoErr } = await db.rpc('undo_purchase', { p_purchase_id: purchaseId })
    expect(undoErr).toBeNull()

    // stok kembali ke 100
    const { data: ing } = await db
      .from('ingredients')
      .select('stock_qty, cost_per_unit')
      .eq('id', ingId)
      .single()
    expect(ing!.stock_qty).toBe(100)
    // cost_per_unit SENGAJA dibiarkan (tidak dibalik ke 10)
    expect(Number(ing!.cost_per_unit)).toBeCloseTo(costAfterBuy, 6)

    // belanja terhapus
    const { data: gonePurchase } = await db
      .from('ingredient_purchases')
      .select('id')
      .eq('id', purchaseId)
    expect(gonePurchase).toEqual([])

    // expense tertaut ikut terhapus lewat cascade
    const { data: goneExpense } = await db
      .from('expenses')
      .select('id')
      .eq('purchase_id', purchaseId)
    expect(goneExpense).toEqual([])

    // ada movement pembalikan (jumlah delta 0)
    const { data: mv } = await db
      .from('stock_movements')
      .select('qty_delta')
      .eq('ingredient_id', ingId)
    expect(mv!.reduce((s, m) => s + m.qty_delta, 0)).toBe(0)
  },
)

test.skipIf(!enabled)(
  'record_purchase menolak kategori pengeluaran selain bahan/kemasan (atomik, tidak ada efek)',
  async () => {
    await db.auth.signInWithPassword({ email: email!, password: password! })

    const ingId = await makeTempIngredient(50, 5)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })

    const { error } = await db.rpc('record_purchase', {
      p_ingredient_id: ingId,
      p_qty: 10,
      p_total_cost: 1000,
      p_purchased_at: today,
      p_expense_category: 'listrik',
      p_note: null,
    })
    expect(error).not.toBeNull()

    // rollback penuh: stok tetap 50, tidak ada belanja
    const { data: ing } = await db.from('ingredients').select('stock_qty').eq('id', ingId).single()
    expect(ing!.stock_qty).toBe(50)
    const { data: purchases } = await db
      .from('ingredient_purchases')
      .select('id')
      .eq('ingredient_id', ingId)
    expect(purchases).toEqual([])
  },
)
