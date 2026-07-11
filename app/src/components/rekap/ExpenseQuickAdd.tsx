import { useEffect, useState } from 'react'
import { EXPENSE_CATEGORIES } from '../../lib/reports'
import type { ExpenseCategory } from '../../lib/reports'
import { addExpense, deleteExpense, fetchExpensesOn } from '../../lib/expenses'
import type { ExpenseRow } from '../../lib/expenses'
import { formatRupiah } from '../../lib/format'

const CATEGORY_LABELS = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.key, c.label]),
) as Record<ExpenseCategory, string>

export default function ExpenseQuickAdd({
  dateStr,
  onChanged,
}: {
  dateStr: string
  onChanged: () => void
}) {
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [category, setCategory] = useState<ExpenseCategory>('bahan')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetchExpensesOn(dateStr)
      .then(setRows)
      .catch(() => setRows([]))
  }, [dateStr, refreshKey])

  async function save() {
    const value = parseInt(amount, 10)
    if (!value || value <= 0) return
    setSaving(true)
    try {
      await addExpense({ spentAt: dateStr, category, amount: value, note: note.trim() || null })
      setAmount('')
      setNote('')
      setRefreshKey((k) => k + 1)
      onChanged()
    } catch {
      window.alert('Gagal menyimpan pengeluaran. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    try {
      await deleteExpense(id)
      setRefreshKey((k) => k + 1)
      onChanged()
    } catch {
      window.alert('Gagal menghapus. Coba lagi.')
    }
  }

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-2 font-bold text-gray-900">Pengeluaran Hari Ini</h2>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {EXPENSE_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={category === c.key}
            onClick={() => setCategory(c.key)}
            className={`h-9 rounded-full px-3 text-sm font-medium ${
              category === c.key ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          placeholder="Jumlah (Rp)"
          aria-label="Jumlah pengeluaran"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-12 min-w-0 flex-1 rounded-lg border border-gray-300 px-3"
        />
        <button
          type="button"
          disabled={saving || !(parseInt(amount, 10) > 0)}
          onClick={save}
          className="h-12 rounded-lg bg-brand px-5 font-bold text-white disabled:opacity-50"
        >
          Tambah
        </button>
      </div>
      <input
        type="text"
        placeholder="Catatan (opsional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm"
      />

      {rows.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <span className="font-medium text-gray-900">{CATEGORY_LABELS[r.category]}</span>
                {r.note && <span className="text-gray-500"> · {r.note}</span>}
              </div>
              <span className="font-semibold text-gray-900">{formatRupiah(r.amount)}</span>
              <button
                type="button"
                aria-label={`Hapus pengeluaran ${CATEGORY_LABELS[r.category]}`}
                onClick={() => remove(r.id)}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-red-200 text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
