import { useEffect, useMemo, useState } from 'react'
import { fetchCatalog, CATEGORY_LABELS } from '../../lib/catalog'
import type { VariantInfo } from '../../lib/catalog'
import { fetchFinishedStock, fetchRecentBatches } from '../../lib/inventory'
import type { BatchRow, FinishedStockRow } from '../../lib/inventory'
import {
  adjustFinishedStock,
  recordProduction,
  undoProduction,
  writeOffFinished,
} from '../../lib/stock'
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
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null)

  async function handleDeleteBatch(b: BatchRow) {
    if (
      !window.confirm(
        `Hapus batch ${formatDateWIB(b.batch_date)} (${b.bottles} botol)? Stok bahan & stok jadi akan dikembalikan seperti sebelum batch.`,
      )
    )
      return
    setDeletingBatchId(b.id)
    try {
      await undoProduction(b.id)
      setRefreshKey((k) => k + 1)
    } catch {
      window.alert('Gagal menghapus batch. Coba lagi.')
    } finally {
      setDeletingBatchId(null)
    }
  }

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

  if (status === 'loading') return <p className="text-muted">Memuat data produksi…</p>
  if (status === 'error') return <p className="text-danger">Gagal memuat data produksi.</p>

  return (
    <div className="flex flex-col gap-5">
      {savedFlash && (
        <p
          role="status"
          className="rounded-[14px] bg-money-tint px-3 py-2 text-[13.5px] font-bold text-money-dark"
        >
          Batch produksi tersimpan ✓
        </p>
      )}
      {warnings.length > 0 && (
        <div className="rounded-[14px] bg-owe-tint px-3 py-2 text-[13.5px] text-owe">
          <p className="font-bold">Stok bahan minus (periksa dan koreksi di tab Bahan):</p>
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
            className="mt-1 h-11 font-bold text-owe-deep underline"
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
        <h2 className="mb-2 text-[11px] font-extrabold tracking-[.09em] text-label uppercase">
          Batch Terakhir
        </h2>
        {batches.length === 0 ? (
          <p className="rounded-[20px] bg-white px-4 py-4 text-center text-[13.5px] text-faint shadow-[0_2px_10px_rgba(160,60,95,.07)]">
            Belum ada batch produksi.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[20px] bg-white shadow-[0_2px_10px_rgba(160,60,95,.07)]">
            {batches.map((b) => (
              <li key={b.id} className="flex items-center gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-ink">
                    {formatDateWIB(b.batch_date)} · {b.bottles} botol
                  </p>
                  {b.note && <p className="text-xs font-medium text-muted">{b.note}</p>}
                </div>
                <button
                  type="button"
                  disabled={deletingBatchId === b.id}
                  onClick={() => handleDeleteBatch(b)}
                  className="h-11 rounded-[12px] bg-danger-tint px-3 text-xs font-bold text-danger disabled:opacity-60"
                >
                  {deletingBatchId === b.id ? '…' : 'Hapus'}
                </button>
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
        className="h-[54px] rounded-2xl bg-brand text-base font-extrabold text-white shadow-[0_6px_16px_rgba(226,81,126,.28)] active:bg-brand-dark"
      >
        + Catat Batch Produksi
      </button>
    )
  }

  const categories = (['fresh', 'creamy', 'ramu'] as Category[]).filter((c) =>
    variants.some((v) => v.category === c),
  )

  return (
    <section className="rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]">
      <h2 className="mb-3 text-base font-extrabold text-ink">Catat Batch Produksi</h2>
      <label className="mb-3 flex items-center justify-between gap-2 text-[13.5px]">
        <span className="font-medium text-ink-2">Tanggal produksi</span>
        <input
          type="date"
          value={batchDate}
          onChange={(e) => setBatchDate(e.target.value)}
          className="h-11 rounded-[12px] border-[1.5px] border-border-soft px-2 text-ink"
        />
      </label>

      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
        {categories.map((c) => (
          <div key={c}>
            <h3 className="mb-1 text-[11px] font-extrabold tracking-[.09em] text-label uppercase">
              {CATEGORY_LABELS[c]}
            </h3>
            {variants
              .filter((v) => v.category === c)
              .map((v) => (
                <label
                  key={v.variantId}
                  className="flex min-h-11 items-center justify-between gap-2 text-[13.5px]"
                >
                  <span className="font-medium text-ink">{v.label}</span>
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
                    className="h-11 w-20 rounded-[12px] border-[1.5px] border-border-soft px-2 text-right text-ink placeholder:text-faint"
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
        className="mt-3 h-11 w-full rounded-[12px] border-[1.5px] border-border-soft px-3 text-[13.5px] text-ink placeholder:text-faint"
      />

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[13.5px] font-extrabold text-ink-2">{totalBottles} botol</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-11 rounded-[12px] bg-tint px-4 text-[13.5px] font-bold text-tint-ink active:bg-tint-dark"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={saving || items.length === 0}
            onClick={save}
            className="h-11 rounded-[12px] bg-brand px-5 text-[13.5px] font-extrabold text-white active:bg-brand-dark disabled:opacity-60"
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
  const [correctQty, setCorrectQty] = useState('0')
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

  async function saveCorrection(variantId: string) {
    const n = parseInt(correctQty, 10)
    if (Number.isNaN(n)) return
    setSaving(true)
    try {
      await adjustFinishedStock(variantId, n)
      setOpenId(null)
      onChanged()
    } catch {
      window.alert('Gagal koreksi jumlah. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  const nonZero = finished.filter((f) => f.qty !== 0)

  return (
    <section>
      <h2 className="mb-2 text-[11px] font-extrabold tracking-[.09em] text-label uppercase">
        Stok Jadi di Freezer
      </h2>
      {nonZero.length === 0 ? (
        <p className="rounded-[20px] bg-white px-4 py-4 text-center text-[13.5px] text-faint shadow-[0_2px_10px_rgba(160,60,95,.07)]">
          Stok jadi kosong. Catat batch produksi untuk mengisi.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[20px] bg-white shadow-[0_2px_10px_rgba(160,60,95,.07)]">
          {nonZero.map((f) => (
            <li key={f.variantId}>
              <button
                type="button"
                onClick={() => {
                  const next = openId === f.variantId ? null : f.variantId
                  setOpenId(next)
                  if (next) setCorrectQty(String(f.qty))
                }}
                className="flex min-h-12 w-full items-center justify-between px-4 py-2 text-left"
              >
                <span className="text-[14.5px] font-bold text-ink">{f.label}</span>
                <span
                  className={`rounded-full bg-tint px-2.5 py-1 text-[13px] font-extrabold ${
                    f.qty < 0 ? 'text-danger' : 'text-tint-ink'
                  }`}
                >
                  {f.qty} botol
                </span>
              </button>
              {openId === f.variantId && (
                <div className="flex flex-col gap-3 bg-bg-soft px-4 py-3">
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted">
                      Koreksi jumlah (set ke angka benar)
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={correctQty}
                        onChange={(e) => setCorrectQty(e.target.value)}
                        aria-label={`Koreksi jumlah ${f.label}`}
                        className="h-11 w-24 rounded-[12px] border-[1.5px] border-border-soft bg-white px-2 text-right text-ink"
                      />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => saveCorrection(f.variantId)}
                        className="h-11 flex-1 rounded-[12px] bg-brand text-[13.5px] font-bold text-white active:bg-brand-dark disabled:opacity-60"
                      >
                        Simpan jumlah
                      </button>
                    </div>
                  </div>
                  <div className="border-t border-line-2 pt-3">
                    <p className="mb-1 text-xs font-medium text-muted">
                      Tandai keluar (kurangi stok)
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        aria-label={`Jumlah sisa ${f.label}`}
                        className="h-11 w-20 rounded-[12px] border-[1.5px] border-border-soft bg-white px-2 text-right text-ink"
                      />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => writeOff(f.variantId, 'spoilage')}
                        className="h-11 flex-1 rounded-[12px] bg-danger-tint text-[13.5px] font-bold text-danger disabled:opacity-60"
                      >
                        Rusak
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => writeOff(f.variantId, 'giveaway')}
                        className="h-11 flex-1 rounded-[12px] bg-tint text-[13.5px] font-bold text-tint-ink active:bg-tint-dark disabled:opacity-60"
                      >
                        Dibagikan
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
