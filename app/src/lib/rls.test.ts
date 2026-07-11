import { createClient } from '@supabase/supabase-js'
import { expect, test } from 'vitest'

// Test integrasi: RLS harus menolak akses tanpa login.
// Butuh migrasi sudah diterapkan di project Supabase pada .env.local.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

test.skipIf(!url || !key)('RLS menolak akses anon: select products mengembalikan 0 baris', async () => {
  const anon = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await anon.from('products').select('id')
  expect(error).toBeNull()
  expect(data).toEqual([]) // seed berisi 15 produk, anon tidak boleh melihat satu pun
})

test.skipIf(!url || !key)('RLS menolak akses anon: insert products ditolak', async () => {
  const anon = createClient(url, key, { auth: { persistSession: false } })
  const { error } = await anon.from('products').insert({ name: 'Produk Ilegal', category: 'fresh' })
  expect(error).not.toBeNull()
})
