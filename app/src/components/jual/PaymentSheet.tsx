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
    <div className="fixed inset-0 z-30 mx-auto flex max-w-md flex-col justify-end bg-[rgba(51,34,43,.45)]">
      <div className="rounded-t-[28px] bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div aria-hidden="true" className="mx-auto mb-2 h-[5px] w-11 rounded-full bg-border-soft" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-ink">Pembayaran</h2>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-faint active:bg-tint"
          >
            ×
          </button>
        </div>

        <p className="mb-4 text-center text-[34px] font-extrabold tracking-[-.02em] text-ink">
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
              className={`h-[50px] rounded-[14px] font-bold ${
                payment === p
                  ? 'bg-brand text-white'
                  : 'border-[1.5px] border-border-soft bg-white text-tint-ink'
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
              className={`h-[50px] rounded-[14px] font-bold ${
                status === s
                  ? s === 'lunas'
                    ? 'bg-money text-white'
                    : 'bg-warn text-white'
                  : 'border-[1.5px] border-border-soft bg-white text-tint-ink'
              }`}
            >
              {s === 'lunas' ? 'Lunas' : 'Belum lunas'}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <label className="text-[13px] font-bold text-ink-2" htmlFor="customer-search">
            Pelanggan (opsional{status === 'belum_lunas' ? ', disarankan untuk piutang' : ''})
          </label>
          {customer ? (
            <div className="mt-1 flex items-center justify-between rounded-[14px] bg-brand-light px-3 py-2">
              <span className="font-bold text-brand-deep">{customer.name}</span>
              <button
                type="button"
                aria-label="Hapus pelanggan"
                onClick={() => setCustomer(null)}
                className="flex h-11 w-11 items-center justify-center text-xl text-tint-ink"
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
                className="mt-1 h-12 w-full rounded-[14px] border-[1.5px] border-border-soft px-3 text-ink placeholder:text-faint"
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
                      className="h-11 rounded-[12px] bg-tint px-3 text-left font-bold text-tint-ink active:bg-tint-dark"
                    >
                      {m.name}
                    </button>
                  ))}
                  {!matches.some((m) => m.name.toLowerCase() === search.trim().toLowerCase()) && (
                    <button
                      type="button"
                      onClick={addCustomer}
                      className="h-11 rounded-[12px] border-[1.5px] border-dashed border-brand px-3 text-left font-bold text-brand"
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
          className="h-[54px] w-full rounded-2xl bg-brand text-[17px] font-extrabold text-white shadow-[0_6px_16px_rgba(226,81,126,.28)] active:bg-brand-dark disabled:opacity-60"
        >
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  )
}
