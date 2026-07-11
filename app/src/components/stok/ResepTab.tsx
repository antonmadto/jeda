import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchCatalog, CATEGORY_LABELS } from '../../lib/catalog'
import type { VariantInfo } from '../../lib/catalog'
import { fetchIngredients, fetchRecipeLines } from '../../lib/inventory'
import type { IngredientRow, RecipeLineRow } from '../../lib/inventory'
import { computeHpp, computeMargin } from '../../lib/hpp'
import { formatRupiah } from '../../lib/format'
import type { Category } from '../../lib/pricing'

export default function ResepTab() {
  const [variants, setVariants] = useState<VariantInfo[]>([])
  const [ingredients, setIngredients] = useState<IngredientRow[]>([])
  const [variantId, setVariantId] = useState('')
  const [lines, setLines] = useState<RecipeLineRow[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [lineStatus, setLineStatus] = useState<'idle' | 'loading'>('idle')

  useEffect(() => {
    Promise.all([fetchCatalog(), fetchIngredients()])
      .then(([v, ing]) => {
        setVariants(v)
        setIngredients(ing)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    if (!variantId) {
      setLines([])
      return
    }
    setLineStatus('loading')
    fetchRecipeLines(variantId)
      .then(setLines)
      .catch(() => window.alert('Gagal memuat resep.'))
      .finally(() => setLineStatus('idle'))
  }, [variantId])

  const ingredientById = useMemo(
    () => Object.fromEntries(ingredients.map((i) => [i.id, i])),
    [ingredients],
  )
  const variant = variants.find((v) => v.variantId === variantId)

  const hpp = computeHpp(
    lines.map((l) => ({
      qty: l.qty,
      costPerUnit: ingredientById[l.ingredient_id]?.cost_per_unit ?? 0,
    })),
  )
  const margin = variant ? computeMargin(variant.price, hpp) : null

  async function updateQty(line: RecipeLineRow, qty: number) {
    setLines((ls) => ls.map((l) => (l.id === line.id ? { ...l, qty } : l)))
    if (qty > 0) {
      await supabase.from('recipes').update({ qty }).eq('id', line.id)
    }
  }

  async function removeLine(line: RecipeLineRow) {
    const { error } = await supabase.from('recipes').delete().eq('id', line.id)
    if (!error) setLines((ls) => ls.filter((l) => l.id !== line.id))
  }

  async function addLine(ingredientId: string, qty: number) {
    const { data, error } = await supabase
      .from('recipes')
      .insert({ variant_id: variantId, ingredient_id: ingredientId, qty })
      .select('id, ingredient_id, qty')
      .single()
    if (!error && data) setLines((ls) => [...ls, data as RecipeLineRow])
  }

  if (status === 'loading') return <p className="text-gray-500">Memuat…</p>
  if (status === 'error') return <p className="text-red-600">Gagal memuat data resep.</p>

  const categories = (['fresh', 'creamy', 'ramu'] as Category[]).filter((c) =>
    variants.some((v) => v.category === c),
  )

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">Varian produk</span>
        <select
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          className="h-12 rounded-lg border border-gray-300 bg-white px-3"
        >
          <option value="">— Pilih varian —</option>
          {categories.map((c) => (
            <optgroup key={c} label={CATEGORY_LABELS[c]}>
              {variants
                .filter((v) => v.category === c)
                .map((v) => (
                  <option key={v.variantId} value={v.variantId}>
                    {v.label} · {formatRupiah(v.price)}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      {variant && lineStatus === 'idle' && (
        <>
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-bold text-gray-900">Resep per 1 botol</h2>
            {lines.length === 0 && (
              <p className="mb-2 text-sm text-gray-400">Belum ada bahan di resep ini.</p>
            )}
            <ul className="divide-y divide-gray-100">
              {lines.map((l) => {
                const ing = ingredientById[l.ingredient_id]
                return (
                  <li key={l.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {ing?.name ?? '—'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatRupiah(Math.round(l.qty * (ing?.cost_per_unit ?? 0)))}
                      </p>
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      aria-label={`Kuantitas ${ing?.name ?? ''}`}
                      value={l.qty}
                      onChange={(e) => updateQty(l, parseInt(e.target.value, 10) || 0)}
                      className="h-11 w-20 rounded-lg border border-gray-300 px-2 text-right"
                    />
                    <span className="w-10 text-xs text-gray-500">{ing?.unit}</span>
                    <button
                      type="button"
                      aria-label={`Hapus ${ing?.name ?? ''} dari resep`}
                      onClick={() => removeLine(l)}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-200 text-red-600"
                    >
                      ×
                    </button>
                  </li>
                )
              })}
            </ul>
            <AddLineForm
              ingredients={ingredients.filter(
                (i) => !lines.some((l) => l.ingredient_id === i.id),
              )}
              onAdd={addLine}
            />
          </section>

          <section className="rounded-xl bg-brand-light p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">HPP per botol</span>
              <span className="font-bold text-gray-900" data-testid="hpp-value">
                {formatRupiah(hpp)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-700">Harga jual</span>
              <span className="font-bold text-gray-900">{formatRupiah(variant.price)}</span>
            </div>
            {margin && (
              <div className="mt-1 flex justify-between border-t border-white pt-1 text-sm">
                <span className="text-gray-700">Laba kotor / botol</span>
                <span
                  className={`font-bold ${margin.profit < 0 ? 'text-red-600' : 'text-green-700'}`}
                >
                  {formatRupiah(margin.profit)} ({margin.marginPct.toFixed(1)}%)
                </span>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function AddLineForm({
  ingredients,
  onAdd,
}: {
  ingredients: IngredientRow[]
  onAdd: (ingredientId: string, qty: number) => void
}) {
  const [ingredientId, setIngredientId] = useState('')
  const [qty, setQty] = useState('')

  if (ingredients.length === 0) return null
  const selected = ingredients.find((i) => i.id === ingredientId)

  return (
    <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-3">
      <select
        aria-label="Pilih bahan"
        value={ingredientId}
        onChange={(e) => setIngredientId(e.target.value)}
        className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-sm"
      >
        <option value="">+ Tambah bahan…</option>
        {ingredients.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        placeholder="Jml"
        aria-label="Kuantitas bahan baru"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        className="h-11 w-20 rounded-lg border border-gray-300 px-2 text-right"
      />
      <span className="w-10 text-xs text-gray-500">{selected?.unit ?? ''}</span>
      <button
        type="button"
        disabled={!ingredientId || !(parseInt(qty, 10) > 0)}
        onClick={() => {
          onAdd(ingredientId, parseInt(qty, 10))
          setIngredientId('')
          setQty('')
        }}
        className="h-11 rounded-lg bg-brand px-3 text-sm font-bold text-white disabled:opacity-50"
      >
        OK
      </button>
    </div>
  )
}
