import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchIngredients } from '../../lib/inventory'
import type { IngredientRow } from '../../lib/inventory'
import { adjustIngredientStock, deleteIngredient } from '../../lib/stock'
import { formatRupiah } from '../../lib/format'

const UNIT_OPTIONS = ['gram', 'ml', 'pcs'] as const

export default function BahanTab() {
  const [rows, setRows] = useState<IngredientRow[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [openId, setOpenId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetchIngredients()
      .then((r) => {
        setRows(r)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [refreshKey])

  if (status === 'loading') return <p className="text-gray-500">Memuat bahan…</p>
  if (status === 'error') return <p className="text-red-600">Gagal memuat bahan.</p>

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-gray-100 rounded-xl bg-white shadow-sm">
        {rows.map((row) => {
          const low = row.stock_qty < row.reorder_point
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setOpenId(openId === row.id ? null : row.id)}
                className="flex min-h-14 w-full items-center justify-between px-4 py-2 text-left"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {row.name}
                    {low && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                        Perlu belanja
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatRupiah(Math.round(row.cost_per_unit))}/{row.unit} · titik pesan ulang{' '}
                    {row.reorder_point.toLocaleString('id-ID')} {row.unit}
                  </p>
                </div>
                <span className={`text-sm font-bold ${low ? 'text-red-600' : 'text-gray-700'}`}>
                  {row.stock_qty.toLocaleString('id-ID')} {row.unit}
                </span>
              </button>
              {openId === row.id && (
                <IngredientEditor
                  row={row}
                  onDone={() => {
                    setOpenId(null)
                    setRefreshKey((k) => k + 1)
                  }}
                />
              )}
            </li>
          )
        })}
      </ul>

      {showAdd ? (
        <NewIngredientForm
          onDone={() => {
            setShowAdd(false)
            setRefreshKey((k) => k + 1)
          }}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="h-12 rounded-xl border border-dashed border-brand font-semibold text-brand"
        >
          + Bahan baru
        </button>
      )}
    </div>
  )
}

function IngredientEditor({ row, onDone }: { row: IngredientRow; onDone: () => void }) {
  const [stockQty, setStockQty] = useState(String(row.stock_qty))
  const [cost, setCost] = useState(String(row.cost_per_unit))
  const [reorder, setReorder] = useState(String(row.reorder_point))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const newQty = parseInt(stockQty, 10)
      if (!Number.isNaN(newQty) && newQty !== row.stock_qty) {
        await adjustIngredientStock(row.id, newQty)
      }
      const newCost = parseFloat(cost)
      const newReorder = parseInt(reorder, 10)
      if (
        (!Number.isNaN(newCost) && newCost !== row.cost_per_unit) ||
        (!Number.isNaN(newReorder) && newReorder !== row.reorder_point)
      ) {
        const { error } = await supabase
          .from('ingredients')
          .update({ cost_per_unit: newCost, reorder_point: newReorder })
          .eq('id', row.id)
        if (error) throw error
      }
      onDone()
    } catch {
      window.alert('Gagal menyimpan. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Hapus bahan "${row.name}"? Tindakan ini tidak bisa dibatalkan.`)) return
    setSaving(true)
    try {
      await deleteIngredient(row.id)
      onDone()
    } catch (e) {
      // fungsi DB memberi pesan jelas bila bahan masih dipakai di resep
      const msg = (e as { message?: string })?.message
      window.alert(msg || 'Gagal menghapus bahan. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 bg-gray-50 px-4 py-3">
      <label className="flex items-center justify-between gap-2 text-sm">
        <span className="text-gray-700">Stok sekarang ({row.unit})</span>
        <input
          type="number"
          inputMode="numeric"
          value={stockQty}
          onChange={(e) => setStockQty(e.target.value)}
          className="h-11 w-28 rounded-lg border border-gray-300 px-2 text-right"
        />
      </label>
      <label className="flex items-center justify-between gap-2 text-sm">
        <span className="text-gray-700">Biaya per {row.unit} (Rp)</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.0001"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="h-11 w-28 rounded-lg border border-gray-300 px-2 text-right"
        />
      </label>
      <label className="flex items-center justify-between gap-2 text-sm">
        <span className="text-gray-700">Titik pesan ulang ({row.unit})</span>
        <input
          type="number"
          inputMode="numeric"
          value={reorder}
          onChange={(e) => setReorder(e.target.value)}
          className="h-11 w-28 rounded-lg border border-gray-300 px-2 text-right"
        />
      </label>
      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="h-11 rounded-lg bg-brand font-semibold text-white disabled:opacity-60"
      >
        {saving ? 'Menyimpan…' : 'Simpan'}
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={remove}
        className="h-11 rounded-lg border border-red-200 font-semibold text-red-600 active:bg-red-50 disabled:opacity-60"
      >
        Hapus bahan
      </button>
    </div>
  )
}

function NewIngredientForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<(typeof UNIT_OPTIONS)[number]>('gram')
  const [cost, setCost] = useState('')
  const [reorder, setReorder] = useState('0')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('ingredients').insert({
      name: name.trim(),
      unit,
      cost_per_unit: parseFloat(cost) || 0,
      reorder_point: parseInt(reorder, 10) || 0,
    })
    setSaving(false)
    if (error) {
      window.alert('Gagal menambah bahan.')
    } else {
      onDone()
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-gray-900">Bahan baru</h3>
      <input
        type="text"
        placeholder="Nama bahan"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-12 rounded-lg border border-gray-300 px-3"
      />
      <div className="flex gap-2">
        {UNIT_OPTIONS.map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => setUnit(u)}
            className={`h-11 flex-1 rounded-lg text-sm font-semibold ${
              unit === u ? 'bg-brand text-white' : 'border border-gray-300 text-gray-700'
            }`}
          >
            {u}
          </button>
        ))}
      </div>
      <label className="flex items-center justify-between gap-2 text-sm">
        <span className="text-gray-700">Biaya per {unit} (Rp)</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.0001"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="h-11 w-28 rounded-lg border border-gray-300 px-2 text-right"
        />
      </label>
      <label className="flex items-center justify-between gap-2 text-sm">
        <span className="text-gray-700">Titik pesan ulang ({unit})</span>
        <input
          type="number"
          inputMode="numeric"
          value={reorder}
          onChange={(e) => setReorder(e.target.value)}
          className="h-11 w-28 rounded-lg border border-gray-300 px-2 text-right"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 rounded-lg border border-gray-300 font-semibold text-gray-600"
        >
          Batal
        </button>
        <button
          type="button"
          disabled={saving || !name.trim()}
          onClick={save}
          className="h-11 flex-1 rounded-lg bg-brand font-semibold text-white disabled:opacity-60"
        >
          Simpan
        </button>
      </div>
    </div>
  )
}
