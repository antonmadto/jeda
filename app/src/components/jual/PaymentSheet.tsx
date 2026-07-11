import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatRupiah } from '../../lib/format'
import type { PriceResult } from '../../lib/pricing'

type CustomerRow = { id: string; name: string }

export type PaymentChoice = {
  payment: 'cash' | 'qris'
  status: 'lunas' | 'belum_lunas'
  customerId: string | null
}

export default function PaymentSheet({
  price,
  saving,
  onSave,
  onClose,
}: {
  price: PriceResult
  saving: boolean
  onSave: (choice: PaymentChoice) => void
  onClose: () => void
}) {
  const [payment, setPayment] = useState<'cash' | 'qris'>('cash')
  const [status, setStatus] = useState<'lunas' | 'belum_lunas'>('lunas')
  const [customer, setCustomer] = useState<CustomerRow | null>(null)
  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState<CustomerRow[]>([])

  useEffect(() => {
    if (search.trim().length < 2) {
      setMatches([])
      return
    }
    let cancelled = false
    supabase
      .from('customers')
      .select('id, name')
      .ilike('name', `%${search.trim()}%`)
      .limit(5)
      .then(({ data }) => {
        if (!cancelled) setMatches(data ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [search])

  async function addCustomer() {
    const name = search.trim()
    if (!name) return
    const { data, error } = await supabase
      .from('customers')
      .insert({ name })
      .select('id, name')
      .single()
    if (!error && data) {
      setCustomer(data)
      setSearch('')
    }
  }

  return (
    <div className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col justify-end bg-black/40">
      <div className="rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Pembayaran</h2>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-gray-400 active:bg-gray-100"
          >
            ×
          </button>
        </div>

        <p className="mb-4 text-center text-3xl font-bold text-gray-900">
          {formatRupiah(price.total)}
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Metode bayar">
          {(['cash', 'qris'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={payment === p}
              onClick={() => setPayment(p)}
              className={`h-12 rounded-lg font-semibold ${
                payment === p ? 'bg-brand text-white' : 'border border-gray-300 text-gray-700'
              }`}
            >
              {p === 'cash' ? 'Cash' : 'QRIS'}
            </button>
          ))}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Status bayar">
          {(['lunas', 'belum_lunas'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={status === s}
              onClick={() => setStatus(s)}
              className={`h-12 rounded-lg font-semibold ${
                status === s
                  ? s === 'lunas'
                    ? 'bg-green-600 text-white'
                    : 'bg-amber-500 text-white'
                  : 'border border-gray-300 text-gray-700'
              }`}
            >
              {s === 'lunas' ? 'Lunas' : 'Belum lunas'}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700" htmlFor="customer-search">
            Pelanggan (opsional{status === 'belum_lunas' ? ', disarankan untuk piutang' : ''})
          </label>
          {customer ? (
            <div className="mt-1 flex items-center justify-between rounded-lg bg-brand-light px-3 py-2">
              <span className="font-medium text-gray-900">{customer.name}</span>
              <button
                type="button"
                aria-label="Hapus pelanggan"
                onClick={() => setCustomer(null)}
                className="flex h-11 w-11 items-center justify-center text-xl text-gray-500"
              >
                ×
              </button>
            </div>
          ) : (
            <>
              <input
                id="customer-search"
                type="text"
                placeholder="Cari atau ketik nama baru"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1 h-12 w-full rounded-lg border border-gray-300 px-3"
              />
              {search.trim().length >= 2 && (
                <div className="mt-1 flex flex-col gap-1">
                  {matches.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setCustomer(m)
                        setSearch('')
                      }}
                      className="h-11 rounded-lg bg-gray-100 px-3 text-left font-medium text-gray-800"
                    >
                      {m.name}
                    </button>
                  ))}
                  {!matches.some((m) => m.name.toLowerCase() === search.trim().toLowerCase()) && (
                    <button
                      type="button"
                      onClick={addCustomer}
                      className="h-11 rounded-lg border border-dashed border-brand px-3 text-left font-medium text-brand"
                    >
                      + Tambah “{search.trim()}”
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => onSave({ payment, status, customerId: customer?.id ?? null })}
          className="h-13 w-full rounded-xl bg-brand text-lg font-bold text-white active:bg-brand-dark disabled:opacity-60"
        >
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  )
}
