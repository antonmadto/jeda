import { createClient } from '@supabase/supabase-js'
import { afterAll, expect, test } from 'vitest'

// Test integrasi gerbang Fase 3: batch produksi terbukti mengurangi stok bahan
// dan menambah stok jadi lewat stock_movements.
// Jalan hanya dengan kredensial akun test:
//   E2E_EMAIL=... E2E_PASSWORD=... npm run test
// Semua perubahan dikembalikan persis seperti semula di akhir test.

declare const process: { env: Record<string, string | undefined> }

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
const email = process.env.E2E_EMAIL
const password = process.env.E2E_PASSWORD
const enabled = Boolean(url && key && email && password)

const db = createClient(url, key, { auth: { persistSession: false } })
let cleanup: (() => Promise<void>) | null = null

afterAll(async () => {
  await cleanup?.()
})

test.skipIf(!enabled)(
  'batch produksi Susu Kurma 10 botol: bahan berkurang sesuai resep, stok jadi +10, tercatat di stock_movements',
  async () => {
    const { error: loginError } = await db.auth.signInWithPassword({
      email: email!,
      password: password!,
    })
    expect(loginError).toBeNull()

    // varian Susu Kurma 250 ml + resepnya
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

    // kondisi awal
    const { data: fsBefore } = await db
      .from('finished_stock')
      .select('qty')
      .eq('variant_id', variantId)
      .single()
    const { data: ingBefore } = await db.from('ingredients').select('id, stock_qty')
    const stockBefore = new Map(ingBefore!.map((i) => [i.id, i.stock_qty]))

    // catat batch lewat RPC (jalur yang sama dengan stock.ts)
    const { data: result, error } = await db.rpc('record_production', {
      p_batch_date: '2026-07-11',
      p_note: 'test integrasi',
      p_items: [{ variant_id: variantId, qty: 10 }],
    })
    expect(error).toBeNull()
    const batchId = result.batch_id as string

    cleanup = async () => {
      // kembalikan database persis seperti semula (khusus test)
      await db.from('stock_movements').delete().eq('ref_id', batchId)
      await db.from('production_batches').delete().eq('id', batchId)
      await db.from('finished_stock').update({ qty: fsBefore!.qty }).eq('variant_id', variantId)
      for (const [id, qty] of stockBefore) {
        await db.from('ingredients').update({ stock_qty: qty }).eq('id', id)
      }
      await db.auth.signOut()
    }

    // stok jadi bertambah 10
    const { data: fsAfter } = await db
      .from('finished_stock')
      .select('qty')
      .eq('variant_id', variantId)
      .single()
    expect(fsAfter!.qty).toBe(fsBefore!.qty + 10)

    // stok tiap bahan berkurang qty resep x 10
    const { data: ingAfter } = await db.from('ingredients').select('id, stock_qty')
    for (const line of recipe!) {
      const before = stockBefore.get(line.ingredient_id)!
      const after = ingAfter!.find((i) => i.id === line.ingredient_id)!.stock_qty
      expect(after).toBe(before - line.qty * 10)
    }

    // semua tercatat di stock_movements dengan ref batch
    const { data: movements } = await db
      .from('stock_movements')
      .select('kind, variant_id, ingredient_id, qty_delta')
      .eq('ref_id', batchId)
    expect(movements!.length).toBe(1 + recipe!.length) // 1 varian + 4 bahan
    const variantMove = movements!.find((m) => m.variant_id === variantId)
    expect(variantMove).toMatchObject({ kind: 'production', qty_delta: 10 })
    for (const line of recipe!) {
      const move = movements!.find((m) => m.ingredient_id === line.ingredient_id)
      expect(move).toMatchObject({ kind: 'production', qty_delta: -line.qty * 10 })
    }
  },
)
