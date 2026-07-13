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

  if (status === 'loading') return <p className="text-muted">Memuat…</p>
  if (status === 'error') return <p className="text-danger">Gagal memuat data belanja.</p>

  if (variantsWithRecipe.length === 0) {
    return (
      <p className="rounded-[20px] bg-white px-4 py-6 text-center text-[13.5px] text-muted shadow-[0_2px_10px_rgba(160,60,95,.07)]">
        Belum ada varian yang punya resep. Isi resep dulu di tab Resep supaya kebutuhan belanja
        bisa dihitung.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]">
        <h2 className="mb-1 text-base font-extrabold text-ink">Rencana produksi berikutnya</h2>
        <p className="mb-2 text-xs font-medium text-muted">
          Hanya varian yang punya resep yang ikut dihitung.
        </p>
        {variantsWithRecipe.map((v) => (
          <label
            key={v.variantId}
            className="flex min-h-11 items-center justify-between gap-2 text-[13.5px]"
          >
            <span className="font-medium text-ink">{v.label}</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                aria-label={`Target ${v.label}`}
                value={plan[v.variantId] ?? ''}
                onChange={(e) => setPlan((m) => ({ ...m, [v.variantId]: e.target.value }))}
                className="h-11 w-20 rounded-[12px] border-[1.5px] border-border-soft px-2 text-right text-ink"
              />
              <span className="text-xs font-medium text-muted">botol</span>
            </div>
          </label>
        ))}
        <p className="mt-2 border-t border-line pt-2 text-right text-[13.5px] font-extrabold text-ink">
          Target total: {totalBottles} botol
        </p>
      </section>

      <section
        className="rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]"
        aria-label="Daftar belanja"
      >
        <h2 className="mb-2 text-base font-extrabold text-ink">Daftar Belanja</h2>
        {list.length === 0 ? (
          <p className="text-[13.5px] text-faint">Isi target produksi untuk menghitung.</p>
        ) : (
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-left text-[11px] font-extrabold tracking-[.09em] text-label uppercase">
                <th className="py-1 font-extrabold">Bahan</th>
                <th className="py-1 text-right font-extrabold">Butuh</th>
                <th className="py-1 text-right font-extrabold">Stok</th>
                <th className="py-1 text-right font-extrabold">Beli</th>
              </tr>
            </thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.ingredientId} className="border-t border-line">
                  <td className="py-1.5 font-bold text-ink">{l.name}</td>
                  <td className="py-1.5 text-right font-medium text-ink-2">
                    {l.needed.toLocaleString('id-ID')} {l.unit}
                  </td>
                  <td className="py-1.5 text-right font-medium text-ink-2">
                    {l.inStock.toLocaleString('id-ID')}
                  </td>
                  <td
                    className={`py-1.5 text-right font-extrabold ${
                      l.toBuy > 0 ? 'text-brand' : 'text-faint'
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
        <p
          role="status"
          className="rounded-[14px] bg-money-tint px-3 py-2 text-[13.5px] font-bold text-money-dark"
        >
          Daftar tersalin — tinggal tempel di WhatsApp ✓
        </p>
      )}
      <button
        type="button"
        disabled={list.length === 0}
        onClick={share}
        className="h-[54px] rounded-2xl bg-money text-base font-extrabold text-white shadow-[0_6px_16px_rgba(46,155,104,.25)] active:bg-money-dark disabled:opacity-50"
      >
        Bagikan ke WhatsApp
      </button>
    </div>
  )
}
