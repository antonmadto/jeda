import { useEffect, useMemo, useState } from 'react'
import { fetchCatalog, CATEGORY_LABELS } from '../../lib/catalog'
import type { VariantInfo } from '../../lib/catalog'
import { fetchFinishedStock, fetchRecentBatches } from '../../lib/inventory'
import type { BatchRow, FinishedStockRow } from '../../lib/inventory'
import { recordProduction, writeOffFinished } from '../../lib/stock'
import type { IngredientWarning } from '../../lib/stock'
import { formatDateWIB, todayWIB } from '../../lib/date'
import type { Category } from '../../lib/pricing'

export default function ProduksiTab() {
  const [variants, setVariants] = useState<VariantInfo[]>([])
  const [finished, setFinished] = useState<FinishedStockRow[]>([])
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [refreshKey, setRefreshKey] = useState(0)
  const [warnings, setWarnings] = useState<IngredientWarning[]>([])
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    Promise.all([fetchCatalog(), fetchFinishedStock(), fetchRecentBatches()])
      .then(([v, f, b]) => {
        setVariants(v)
        setFinished(f)
        setBatches(b)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [refreshKey])

  if (status === 'loading') return <p className="text-gray-500">Memuat data produksi…</p>
  if (status === 'error') return <p className="text-red-600">Gagal memuat data produksi.</p>

  return (
    <div className="flex flex-col gap-5">
      {savedFlash && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          Batch produksi tersimpan ✓
        </p>
      )}
      {warnings.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-semibold">Stok bahan minus (periksa dan koreksi di tab Bahan):</p>
          <ul className="list-inside list-disc">
            {warnings.map((w) => (
              <li key={w.name}>
                {w.name} — sisa {w.qty_after.toLocaleString('id-ID')} {w.unit}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setWarnings([])}
            className="mt-1 h-11 font-semibold text-amber-700 underline"
          >
            Tutup
          </button>
        </div>
      )}

      <BatchForm
        variants={variants}
        onSaved={(w) => {
          setWarnings(w)
          setSavedFlash(true)
          setTimeout(() => setSavedFlash(false), 2500)
          setRefreshKey((k) => k + 1)
        }}
      />

      <FinishedStockList finished={finished} onChanged={() => setRefreshKey((k) => k + 1)} />

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Batch Terakhir
        </h2>
        {batches.length === 0 ? (
          <p className="rounded-xl bg-white px-4 py-4 text-center text-sm text-gray-400 shadow-sm">
            Belum ada batch produksi.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl bg-white shadow-sm">
            {batches.map((b) => (
              <li key={b.id} className="px-4 py-2.5">
                <p className="text-sm font-medium text-gray-900">
                  {formatDateWIB(b.batch_date)} · {b.bottles} botol
                </p>
                {b.note && <p className="text-xs text-gray-500">{b.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function BatchForm({
  variants,
  onSaved,
}: {
  variants: VariantInfo[]
  onSaved: (warnings: IngredientWarning[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [batchDate, setBatchDate] = useState(todayWIB())
  const [note, setNote] = useState('')
  const [qtyByVariant, setQtyByVariant] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const items = useMemo(
    () =>
      Object.entries(qtyByVariant)
        .map(([variantId, s]) => ({ variantId, qty: parseInt(s, 10) || 0 }))
        .filter((i) => i.qty > 0),
    [qtyByVariant],
  )
  const totalBottles = items.reduce((sum, i) => sum + i.qty, 0)

  async function save() {
    setSaving(true)
    try {
      const res = await recordProduction({ batchDate, note: note.trim() || null, items })
      setQtyByVariant({})
      setNote('')
      setOpen(false)
      onSaved(res.ingredientWarnings)
    } catch {
      window.alert('Gagal menyimpan batch. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-13 rounded-xl bg-brand text-base font-bold text-white active:bg-brand-dark"
      >
        + Catat Batch Produksi
      </button>
    )
  }

  const categories = (['fresh', 'creamy', 'ramu'] as Category[]).filter((c) =>
    variants.some((v) => v.category === c),
  )

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-bold text-gray-900">Catat Batch Produksi</h2>
      <label className="mb-3 flex items-center justify-between gap-2 text-sm">
        <span className="text-gray-700">Tanggal produksi</span>
        <input
          type="date"
          value={batchDate}
          onChange={(e) => setBatchDate(e.target.value)}
          className="h-11 rounded-lg border border-gray-300 px-2"
        />
      </label>

      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
        {categories.map((c) => (
          <div key={c}>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
              {CATEGORY_LABELS[c]}
            </h3>
            {variants
              .filter((v) => v.category === c)
              .map((v) => (
                <label
                  key={v.variantId}
                  className="flex min-h-11 items-center justify-between gap-2 text-sm"
                >
                  <span className="text-gray-800">{v.label}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="0"
                    aria-label={`Produksi ${v.label}`}
                    value={qtyByVariant[v.variantId] ?? ''}
                    onChange={(e) =>
                      setQtyByVariant((m) => ({ ...m, [v.variantId]: e.target.value }))
                    }
                    className="h-11 w-20 rounded-lg border border-gray-300 px-2 text-right"
                  />
                </label>
              ))}
          </div>
        ))}
      </div>

      <input
        type="text"
        placeholder="Catatan (opsional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-3 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm"
      />

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-700">{totalBottles} botol</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-11 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-600"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={saving || items.length === 0}
            onClick={save}
            className="h-11 rounded-lg bg-brand px-5 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? 'Menyimpan…' : 'Simpan Batch'}
          </button>
        </div>
      </div>
    </section>
  )
}

function FinishedStockList({
  finished,
  onChanged,
}: {
  finished: FinishedStockRow[]
  onChanged: () => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [qty, setQty] = useState('1')
  const [saving, setSaving] = useState(false)

  async function writeOff(variantId: string, kind: 'spoilage' | 'giveaway') {
    const n = parseInt(qty, 10)
    if (!n || n <= 0) return
    setSaving(true)
    try {
      await writeOffFinished(variantId, n, kind)
      setOpenId(null)
      setQty('1')
      onChanged()
    } catch {
      window.alert('Gagal mencatat. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  const nonZero = finished.filter((f) => f.qty !== 0)

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
        Stok Jadi di Freezer
      </h2>
      {nonZero.length === 0 ? (
        <p className="rounded-xl bg-white px-4 py-4 text-center text-sm text-gray-400 shadow-sm">
          Stok jadi kosong. Catat batch produksi untuk mengisi.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl bg-white shadow-sm">
          {nonZero.map((f) => (
            <li key={f.variantId}>
              <button
                type="button"
                onClick={() => setOpenId(openId === f.variantId ? null : f.variantId)}
                className="flex min-h-12 w-full items-center justify-between px-4 py-2 text-left"
              >
                <span className="text-sm font-medium text-gray-900">{f.label}</span>
                <span
                  className={`text-sm font-bold ${f.qty < 0 ? 'text-red-600' : 'text-gray-700'}`}
                >
                  {f.qty} botol
                </span>
              </button>
              {openId === f.variantId && (
                <div className="flex items-center gap-2 bg-gray-50 px-4 py-3">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    aria-label={`Jumlah sisa ${f.label}`}
                    className="h-11 w-20 rounded-lg border border-gray-300 px-2 text-right"
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => writeOff(f.variantId, 'spoilage')}
                    className="h-11 flex-1 rounded-lg border border-red-200 text-sm font-semibold text-red-600 disabled:opacity-60"
                  >
                    Rusak
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => writeOff(f.variantId, 'giveaway')}
                    className="h-11 flex-1 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 disabled:opacity-60"
                  >
                    Dibagikan
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
