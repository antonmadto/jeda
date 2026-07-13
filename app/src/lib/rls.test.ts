import { createClient } from '@supabase/supabase-js'
import { expect, test } from 'vitest'

// Test integrasi: RLS harus menolak akses tanpa login.
// E2E_SUPABASE_* mengarahkan test ke project khusus test; tanpa itu memakai .env.local.
declare const process: { env: Record<string, string | undefined> }

const url = process.env.E2E_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL
const key = process.env.E2E_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

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
