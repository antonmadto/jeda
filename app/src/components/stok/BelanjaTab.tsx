import { useEffect, useMemo, useState } from 'react'
import { fetchCatalog } from '../../lib/catalog'
import type { VariantInfo } from '../../lib/catalog'
import { fetchAllRecipeLines, fetchIngredients } from '../../lib/inventory'
import type { IngredientRow } from '../../lib/inventory'
import { buildShoppingText, computeShoppingList } from '../../lib/shopping'
import { formatDateWIB, todayWIB } from '../../lib/date'

const DEFAULT_TARGET = 300 // kebiasaan produksi per siklus belanja

export default function BelanjaTab() {
  const [variants, setVariants] = useState<VariantInfo[]>([])
  const [recipes, setRecipes] = useState<{ variant_id: string; ingredient_id: string; qty: number }[]>([])
  const [ingredients, setIngredients] = useState<IngredientRow[]>([])
  const [plan, setPlan] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    Promise.all([fetchCatalog(), fetchAllRecipeLines(), fetchIngredients()])
      .then(([v, r, ing]) => {
        setVariants(v)
        setRecipes(r)
        setIngredients(ing)
        // prefill: bagi rata target 300 botol ke varian yang punya resep
        const withRecipe = v.filter((x) => r.some((line) => line.variant_id === x.variantId))
        if (withRecipe.length > 0) {
          const each = Math.floor(DEFAULT_TARGET / withRecipe.length)
          const remainder = DEFAULT_TARGET - each * withRecipe.length
          setPlan(
            Object.fromEntries(
              withRecipe.map((x, idx) => [x.variantId, String(each + (idx === 0 ? remainder : 0))]),
            ),
          )
        }
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  const variantsWithRecipe = useMemo(
    () => variants.filter((v) => recipes.some((r) => r.variant_id === v.variantId)),
    [variants, recipes],
  )

  const planLines = useMemo(
    () =>
      variantsWithRecipe.map((v) => ({
        variantId: v.variantId,
        bottles: parseInt(plan[v.variantId] ?? '', 10) || 0,
      })),
    [variantsWithRecipe, plan],
  )
  const totalBottles = planLines.reduce((sum, p) => sum + p.bottles, 0)

  const list = useMemo(
    () =>
      computeShoppingList(
        planLines,
        recipes.map((r) => ({
          variantId: r.variant_id,
          ingredientId: r.ingredient_id,
          qtyPerBottle: r.qty,
        })),
        ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit, stockQty: i.stock_qty })),
      ),
    [planLines, recipes, ingredients],
  )

  async function share() {
    const text = buildShoppingText(list, formatDateWIB(todayWIB()))
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        // dibatalkan pengguna atau tidak didukung; lanjut ke fallback
      }
    }
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  if (status === 'loading') return <p className="text-gray-500">Memuat…</p>
  if (status === 'error') return <p className="text-red-600">Gagal memuat data belanja.</p>

  if (variantsWithRecipe.length === 0) {
    return (
      <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-gray-500 shadow-sm">
        Belum ada varian yang punya resep. Isi resep dulu di tab Resep supaya kebutuhan belanja
        bisa dihitung.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-1 font-bold text-gray-900">Rencana produksi berikutnya</h2>
        <p className="mb-2 text-xs text-gray-500">
          Hanya varian yang punya resep yang ikut dihitung.
        </p>
        {variantsWithRecipe.map((v) => (
          <label
            key={v.variantId}
            className="flex min-h-11 items-center justify-between gap-2 text-sm"
          >
            <span className="text-gray-800">{v.label}</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                aria-label={`Target ${v.label}`}
                value={plan[v.variantId] ?? ''}
                onChange={(e) => setPlan((m) => ({ ...m, [v.variantId]: e.target.value }))}
                className="h-11 w-20 rounded-lg border border-gray-300 px-2 text-right"
              />
              <span className="text-xs text-gray-500">botol</span>
            </div>
          </label>
        ))}
        <p className="mt-2 border-t border-gray-100 pt-2 text-right text-sm font-semibold text-gray-900">
          Target total: {totalBottles} botol
        </p>
      </section>

      <section className="rounded-xl bg-white p-4 shadow-sm" aria-label="Daftar belanja">
        <h2 className="mb-2 font-bold text-gray-900">Daftar Belanja</h2>
        {list.length === 0 ? (
          <p className="text-sm text-gray-400">Isi target produksi untuk menghitung.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="py-1 font-semibold">Bahan</th>
                <th className="py-1 text-right font-semibold">Butuh</th>
                <th className="py-1 text-right font-semibold">Stok</th>
                <th className="py-1 text-right font-semibold">Beli</th>
              </tr>
            </thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.ingredientId} className="border-t border-gray-100">
                  <td className="py-1.5 font-medium text-gray-900">{l.name}</td>
                  <td className="py-1.5 text-right text-gray-600">
                    {l.needed.toLocaleString('id-ID')} {l.unit}
                  </td>
                  <td className="py-1.5 text-right text-gray-600">
                    {l.inStock.toLocaleString('id-ID')}
                  </td>
                  <td
                    className={`py-1.5 text-right font-bold ${
                      l.toBuy > 0 ? 'text-brand-dark' : 'text-gray-400'
                    }`}
                  >
                    {l.toBuy > 0 ? `${l.toBuy.toLocaleString('id-ID')} ${l.unit}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {copied && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          Daftar tersalin — tinggal tempel di WhatsApp ✓
        </p>
      )}
      <button
        type="button"
        disabled={list.length === 0}
        onClick={share}
        className="h-13 rounded-xl bg-green-600 text-base font-bold text-white active:bg-green-700 disabled:opacity-50"
      >
        Bagikan ke WhatsApp
      </button>
    </div>
  )
}
