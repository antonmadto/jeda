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

  if (status === 'loading') return <p className="text-muted">Memuat…</p>
  if (status === 'error') return <p className="text-danger">Gagal memuat data resep.</p>

  const categories = (['fresh', 'creamy', 'ramu'] as Category[]).filter((c) =>
    variants.some((v) => v.category === c),
  )

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-[11px] font-extrabold tracking-[.09em] text-label uppercase">
          Varian produk
        </span>
        <select
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          className="h-[50px] rounded-[14px] border-[1.5px] border-border-soft bg-white px-3 text-[14.5px] font-bold text-ink"
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
          <section className="rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]">
            <h2 className="mb-2 text-base font-extrabold text-ink">Resep per 1 botol</h2>
            {lines.length === 0 && (
              <p className="mb-2 text-[13.5px] text-faint">Belum ada bahan di resep ini.</p>
            )}
            <ul className="divide-y divide-line">
              {lines.map((l) => {
                const ing = ingredientById[l.ingredient_id]
                return (
                  <li key={l.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-bold text-ink">
                        {ing?.name ?? '—'}
                      </p>
                      <p className="text-xs font-medium text-muted">
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
                      className="h-11 w-20 rounded-[12px] border-[1.5px] border-border-soft px-2 text-right text-ink"
                    />
                    <span className="w-10 text-xs font-medium text-muted">{ing?.unit}</span>
                    <button
                      type="button"
                      aria-label={`Hapus ${ing?.name ?? ''} dari resep`}
                      onClick={() => removeLine(l)}
                      className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-danger-tint text-danger"
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

          <section className="rounded-[20px] bg-brand-light p-4">
            <div className="flex justify-between text-[13.5px]">
              <span className="font-medium text-tint-ink">HPP per botol</span>
              <span className="font-extrabold text-ink" data-testid="hpp-value">
                {formatRupiah(hpp)}
              </span>
            </div>
            <div className="flex justify-between text-[13.5px]">
              <span className="font-medium text-tint-ink">Harga jual</span>
              <span className="font-extrabold text-ink">{formatRupiah(variant.price)}</span>
            </div>
            {margin && (
              <div className="mt-1.5 flex justify-between border-t-[1.5px] border-white pt-1.5 text-[13.5px]">
                <span className="font-medium text-tint-ink">Laba kotor / botol</span>
                <span
                  className={`font-extrabold ${margin.profit < 0 ? 'text-danger' : 'text-money-dark'}`}
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
    <div className="mt-2 flex items-center gap-2 border-t border-line pt-3">
      <select
        aria-label="Pilih bahan"
        value={ingredientId}
        onChange={(e) => setIngredientId(e.target.value)}
        className="h-11 min-w-0 flex-1 rounded-[12px] border-[1.5px] border-border-soft bg-white px-2 text-[13.5px] font-medium text-ink"
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
        className="h-11 w-20 rounded-[12px] border-[1.5px] border-border-soft px-2 text-right text-ink placeholder:text-faint"
      />
      <span className="w-10 text-xs font-medium text-muted">{selected?.unit ?? ''}</span>
      <button
        type="button"
        disabled={!ingredientId || !(parseInt(qty, 10) > 0)}
        onClick={() => {
          onAdd(ingredientId, parseInt(qty, 10))
          setIngredientId('')
          setQty('')
        }}
        className="h-11 rounded-[12px] bg-brand px-3 text-[13.5px] font-extrabold text-white active:bg-brand-dark disabled:opacity-50"
      >
        OK
      </button>
    </div>
  )
}
