import { createClient } from '@supabase/supabase-js'
import { afterAll, expect, test } from 'vitest'

// Test integrasi fungsi stok ke DB sungguhan (produksi, undo produksi, hapus bahan).
// Semua test stok DB berada di satu file supaya jalan berurutan — kalau dipisah,
// Vitest menjalankan file paralel dan mereka berebut baris DB yang sama.
// Jalan hanya dengan kredensial akun test:
//   E2E_EMAIL=... E2E_PASSWORD=... npm run test
// Setiap test mengembalikan perubahannya; DB kembali persis seperti semula.

declare const process: { env: Record<string, string | undefined> }

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const enabled = Boolean(url && key && email && password)

const db = createClient(url, key, { auth: { persistSession: false } })
const cleanups: (() => Promise<void>)[] = []

afterAll(async () => {
  for (const c of cleanups.reverse()) await c()
  await db.auth.signOut()
})

test.skipIf(!enabled)(
  'batch produksi Susu Kurma 10 botol: bahan berkurang sesuai resep, stok jadi +10, tercatat di stock_movements',
  async () => {
    const { error: loginError } = await db.auth.signInWithPassword({
      email: email!,
      password: password!,
    })
    expect(loginError).toBeNull()

    const { data: variant } = await db
      .from('product_variants')
      .select('id, size_ml, products!inner (name)')
      .eq('products.name', 'Susu Kurma')
      .eq('size_ml', 250)
      .single()
    const variantId = variant!.id as string

    const { data: recipe } = await db
      .from('recipes')
      .select('ingredient_id, qty')
      .eq('variant_id', variantId)
    expect(recipe!.length).toBe(4)

    const { data: fsBefore } = await db
      .from('finished_stock')
      .select('qty')
      .eq('variant_id', variantId)
      .single()
    const { data: ingBefore } = await db.from('ingredients').select('id, stock_qty')
    const stockBefore = new Map(ingBefore!.map((i) => [i.id, i.stock_qty]))

    const { data: result, error } = await db.rpc('record_production', {
      p_batch_date: '2026-07-11',
      p_note: 'test integrasi',
      p_items: [{ variant_id: variantId, qty: 10 }],
    })
    expect(error).toBeNull()
    const batchId = result.batch_id as string

    cleanups.push(async () => {
      await db.from('stock_movements').delete().eq('ref_id', batchId)
      await db.from('production_batches').delete().eq('id', batchId)
      await db.from('finished_stock').update({ qty: fsBefore!.qty }).eq('variant_id', variantId)
      for (const [id, qty] of stockBefore) {
        await db.from('ingredients').update({ stock_qty: qty }).eq('id', id)
      }
    })

    const { data: fsAfter } = await db
      .from('finished_stock')
      .select('qty')
      .eq('variant_id', variantId)
      .single()
    expect(fsAfter!.qty).toBe(fsBefore!.qty + 10)

    const { data: ingAfter } = await db.from('ingredients').select('id, stock_qty')
    for (const line of recipe!) {
      const before = stockBefore.get(line.ingredient_id)!
      const after = ingAfter!.find((i) => i.id === line.ingredient_id)!.stock_qty
      expect(after).toBe(before - line.qty * 10)
    }

    const { data: movements } = await db
      .from('stock_movements')
      .select('kind, variant_id, ingredient_id, qty_delta')
      .eq('ref_id', batchId)
    expect(movements!.length).toBe(1 + recipe!.length)
    const variantMove = movements!.find((m) => m.variant_id === variantId)
    expect(variantMove).toMatchObject({ kind: 'production', qty_delta: 10 })
    for (const line of recipe!) {
      const move = movements!.find((m) => m.ingredient_id === line.ingredient_id)
      expect(move).toMatchObject({ kind: 'production', qty_delta: -line.qty * 10 })
    }
  },
)

test.skipIf(!enabled)(
  'undo_production mengembalikan stok bahan & stok jadi persis seperti sebelum batch',
  async () => {
    await db.auth.signInWithPassword({ email: email!, password: password! })

    const { data: variant } = await db
      .from('product_variants')
      .select('id, products!inner (name)')
      .eq('products.name', 'Susu Kurma')
      .eq('size_ml', 250)
      .single()
    const variantId = variant!.id as string

    const { data: recipe } = await db
      .from('recipes')
      .select('ingredient_id, qty')
      .eq('variant_id', variantId)

    const { data: fsBefore } = await db
      .from('finished_stock')
      .select('qty')
      .eq('variant_id', variantId)
      .single()
    const { data: ingBefore } = await db.from('ingredients').select('id, stock_qty')
    const stockBefore = new Map(ingBefore!.map((i) => [i.id, i.stock_qty]))

    const { data: res } = await db.rpc('record_production', {
      p_batch_date: '2026-07-13',
      p_note: 'test undo',
      p_items: [{ variant_id: variantId, qty: 10 }],
    })
    const batchId = res.batch_id as string
    cleanups.push(async () => {
      await db.from('stock_movements').delete().eq('ref_id', batchId)
    })

    const { error: undoErr } = await db.rpc('undo_production', { p_batch_id: batchId })
    expect(undoErr).toBeNull()

    const { data: fsAfter } = await db
      .from('finished_stock')
      .select('qty')
      .eq('variant_id', variantId)
      .single()
    expect(fsAfter!.qty).toBe(fsBefore!.qty)

    const { data: ingAfter } = await db.from('ingredients').select('id, stock_qty')
    for (const line of recipe!) {
      const after = ingAfter!.find((i) => i.id === line.ingredient_id)!.stock_qty
      expect(after).toBe(stockBefore.get(line.ingredient_id))
    }

    const { data: batchAfter } = await db
      .from('production_batches')
      .select('id')
      .eq('id', batchId)
    expect(batchAfter).toEqual([])
  },
)

test.skipIf(!enabled)(
  'delete_ingredient: bahan tanpa resep terhapus; bahan dalam resep ditolak',
  async () => {
    await db.auth.signInWithPassword({ email: email!, password: password! })

    const { data: temp } = await db
      .from('ingredients')
      .insert({ name: 'ZZ Bahan Uji Hapus', unit: 'gram', cost_per_unit: 1 })
      .select('id')
      .single()
    const tempId = temp!.id as string
    cleanups.push(async () => {
      await db.from('ingredients').delete().eq('id', tempId)
    })

    const { error: delErr } = await db.rpc('delete_ingredient', { p_ingredient_id: tempId })
    expect(delErr).toBeNull()
    const { data: gone } = await db.from('ingredients').select('id').eq('id', tempId)
    expect(gone).toEqual([])

    const { data: recipeLine } = await db
      .from('recipes')
      .select('ingredient_id')
      .limit(1)
      .single()
    const { error: guardErr } = await db.rpc('delete_ingredient', {
      p_ingredient_id: recipeLine!.ingredient_id,
    })
    expect(guardErr).not.toBeNull()
    expect(guardErr!.message).toMatch(/resep/i)
  },
)
