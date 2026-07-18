import { useEffect, useState } from 'react'
import type { IngredientRow } from '../../lib/inventory'
import { recordPurchase, undoPurchase } from '../../lib/stock'
import type { PurchaseExpenseCategory } from '../../lib/stock'
import { fetchRecentPurchases } from '../../lib/purchasesData'
import type { PurchaseRow } from '../../lib/purchasesData'
import { formatRupiah } from '../../lib/format'
import { formatDateWIB, todayWIB } from '../../lib/date'

const CATEGORY_OPTIONS: { key: PurchaseExpenseCategory; label: string }[] = [
  { key: 'bahan', label: 'Bahan' },
  { key: 'kemasan', label: 'Kemasan' },
]

export default function CatatBelanja({
  ingredients,
  onChanged,
}: {
  ingredients: IngredientRow[]
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [purchases, setPurchases] = useState<PurchaseRow[]>([])
  const [purchasesKey, setPurchasesKey] = useState(0)

  useEffect(() => {
    fetchRecentPurchases()
      .then(setPurchases)
      .catch(() => setPurchases([]))
  }, [purchasesKey])

  function refreshAll() {
    setPurchasesKey((k) => k + 1)
    onChanged()
  }

  return (
    <div className="flex flex-col gap-3">
      {open ? (
        <PurchaseForm
          ingredients={ingredients}
          onRecorded={() => {
            setOpen(false)
            refreshAll()
          }}
          onCancel={() => setOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={ingredients.length === 0}
          className="h-[50px] rounded-2xl bg-brand font-extrabold text-white shadow-[0_6px_16px_rgba(226,81,126,.28)] active:bg-brand-dark disabled:opacity-50 disabled:shadow-none"
        >
          + Catat Belanja
        </button>
      )}

      {purchases.length > 0 && (
        <RecentPurchases rows={purchases} onChanged={refreshAll} />
      )}
    </div>
  )
}

function PurchaseForm({
  ingredients,
  onRecorded,
  onCancel,
}: {
  ingredients: IngredientRow[]
  onRecorded: () => void
  onCancel: () => void
}) {
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? '')
  const [qty, setQty] = useState('')
  const [totalCost, setTotalCost] = useState('')
  const [date, setDate] = useState(todayWIB())
  const [category, setCategory] = useState<PurchaseExpenseCategory>('bahan')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selected = ingredients.find((i) => i.id === ingredientId)
  const unit = selected?.unit ?? ''
  const qtyValue = parseInt(qty, 10)
  const costValue = parseInt(totalCost, 10)
  const valid = !!ingredientId && qtyValue > 0 && costValue > 0

  async function save() {
    if (!valid) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await recordPurchase({
        ingredientId,
        qty: qtyValue,
        totalCost: costValue,
        purchasedAt: date,
        expenseCategory: category,
        note: note.trim() || null,
      })
      setSuccess(
        `Tercatat. Stok ${selected?.name ?? 'bahan'} sekarang ${res.stockQty.toLocaleString(
          'id-ID',
        )} ${unit}.`,
      )
      // beri jeda singkat agar pengguna sempat membaca konfirmasi stok baru
      setTimeout(onRecorded, 900)
    } catch (e) {
      const msg = (e as { message?: string })?.message
      setError(msg || 'Gagal mencatat belanja. Coba lagi.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]">
      <h3 className="text-base font-extrabold text-ink">Catat Belanja</h3>
      <p className="rounded-[12px] bg-tint px-3 py-2 text-[12.5px] font-medium text-tint-ink">
        Belanja lewat form ini otomatis tercatat sebagai pengeluaran — jangan dicatat lagi di Rekap.
      </p>

      <label className="mt-1 flex flex-col gap-1 text-[13.5px]">
        <span className="font-medium text-ink-2">Bahan</span>
        <select
          value={ingredientId}
          onChange={(e) => setIngredientId(e.target.value)}
          className="h-12 rounded-[12px] border-[1.5px] border-border-soft bg-white px-3 text-ink"
        >
          {ingredients.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.unit})
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center justify-between gap-2 text-[13.5px]">
        <span className="font-medium text-ink-2">Jumlah{unit ? ` (${unit})` : ''}</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="h-11 w-32 rounded-[12px] border-[1.5px] border-border-soft bg-white px-3 text-right text-ink placeholder:text-faint"
        />
      </label>

      <label className="flex items-center justify-between gap-2 text-[13.5px]">
        <span className="font-medium text-ink-2">Total harga (Rp)</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={totalCost}
          onChange={(e) => setTotalCost(e.target.value)}
          className="h-11 w-32 rounded-[12px] border-[1.5px] border-border-soft bg-white px-3 text-right text-ink placeholder:text-faint"
        />
      </label>

      <label className="flex items-center justify-between gap-2 text-[13.5px]">
        <span className="font-medium text-ink-2">Tanggal</span>
        <input
          type="date"
          value={date}
          max={todayWIB()}
          onChange={(e) => setDate(e.target.value)}
          className="h-11 rounded-[12px] border-[1.5px] border-border-soft bg-white px-3 text-ink"
        />
      </label>

      <div className="flex flex-col gap-1 text-[13.5px]">
        <span className="font-medium text-ink-2">Kategori pengeluaran</span>
        <div className="flex gap-2">
          {CATEGORY_OPTIONS.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={category === c.key}
              onClick={() => setCategory(c.key)}
              className={`h-11 flex-1 rounded-[12px] text-[13.5px] font-bold ${
                category === c.key
                  ? 'bg-brand text-white'
                  : 'bg-tint text-tint-ink active:bg-tint-dark'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <input
        type="text"
        placeholder="Catatan (opsional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="h-11 w-full rounded-[12px] border-[1.5px] border-border-soft bg-white px-3 text-sm text-ink placeholder:text-faint"
      />

      {error && <p className="text-[13px] font-semibold text-danger">{error}</p>}
      {success && <p className="text-[13px] font-semibold text-money-dark">{success}</p>}

      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-11 flex-1 rounded-[12px] bg-tint font-bold text-tint-ink active:bg-tint-dark disabled:opacity-60"
        >
          Batal
        </button>
        <button
          type="button"
          disabled={saving || !valid}
          onClick={save}
          className="h-11 flex-1 rounded-[12px] bg-brand font-bold text-white active:bg-brand-dark disabled:opacity-60"
        >
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  )
}

function RecentPurchases({ rows, onChanged }: { rows: PurchaseRow[]; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const today = todayWIB()

  async function undo(row: PurchaseRow) {
    if (
      !window.confirm(
        `Urungkan belanja ${row.ingredientName} ${formatRupiah(row.totalCost)}? Stok dan pengeluaran tertaut akan dibalik.`,
      )
    )
      return
    setBusyId(row.id)
    try {
      await undoPurchase(row.id)
      onChanged()
    } catch (e) {
      const msg = (e as { message?: string })?.message
      window.alert(msg || 'Gagal mengurungkan belanja. Mungkin hanya bisa di hari yang sama.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]">
      <h3 className="mb-2 text-base font-extrabold text-ink">Belanja Terbaru</h3>
      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const sameDay = r.purchasedAt === today
          return (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-[13.5px]">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">
                  {r.ingredientName}
                  <span className="font-medium text-muted">
                    {' '}
                    · {r.qty.toLocaleString('id-ID')} {r.unit}
                  </span>
                </p>
                <p className="text-xs font-medium text-muted">
                  {formatDateWIB(r.purchasedAt)}
                  {r.note ? ` · ${r.note}` : ''}
                </p>
              </div>
              <span className="shrink-0 font-bold text-ink">{formatRupiah(r.totalCost)}</span>
              {sameDay && (
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => undo(r)}
                  className="h-10 shrink-0 rounded-[12px] bg-danger-tint px-3 text-[12.5px] font-bold text-danger disabled:opacity-60"
                >
                  {busyId === r.id ? '…' : 'Urungkan'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
