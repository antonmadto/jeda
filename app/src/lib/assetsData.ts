import { supabase } from './supabase'

// Akses data aset / modal usaha (tabel assets). Aset bukan stok, jadi akses
// tabel langsung (bukan lewat stock.ts). Depresiasi dihitung nanti di Fase 8b.

export type AssetRow = {
  id: string
  name: string
  purchasedAt: string
  cost: number
  usefulLifeMonths: number | null
  note: string | null
  isActive: boolean
}

/** Daftar aset, aktif dulu lalu urut tanggal beli terbaru. */
export async function fetchAssets(): Promise<AssetRow[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('id, name, purchased_at, cost, useful_life_months, note, is_active')
    .order('is_active', { ascending: false })
    .order('purchased_at', { ascending: false })
  if (error) throw error
  type Row = {
    id: string
    name: string
    purchased_at: string
    cost: number
    useful_life_months: number | null
    note: string | null
    is_active: boolean
  }
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    name: r.name,
    purchasedAt: r.purchased_at,
    cost: r.cost,
    usefulLifeMonths: r.useful_life_months,
    note: r.note,
    isActive: r.is_active,
  }))
}

export async function addAsset(input: {
  name: string
  purchasedAt: string
  cost: number
  usefulLifeMonths: number | null
  note: string | null
}): Promise<void> {
  const { error } = await supabase.from('assets').insert({
    name: input.name,
    purchased_at: input.purchasedAt,
    cost: input.cost,
    useful_life_months: input.usefulLifeMonths,
    note: input.note,
  })
  if (error) throw error
}

/** Tandai aset aktif/nonaktif (mis. sudah dijual atau rusak). */
export async function setAssetActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('assets').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}
