import type { VariantInfo } from '../../lib/catalog'
import type { PriceResult } from '../../lib/pricing'
import { formatRupiah } from '../../lib/format'

const PROMO_LABELS: Record<string, string> = {
  jumat_berkah: 'Jumat Berkah',
  sabtu_ceria: 'Sabtu Ceria',
}

export default function CartBar({
  price,
  variantById,
  editing,
  onSetQty,
  onPay,
  onCancel,
}: {
  price: PriceResult
  variantById: Record<string, VariantInfo>
  editing: boolean
  onSetQty: (variantId: string, qty: number) => void
  onPay: () => void
  onCancel: () => void
}) {
  if (price.items.length === 0) return null
  const bottleCount = price.items.reduce((sum, i) => sum + i.qty, 0)

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 mx-auto max-w-md border-t border-gray-200 bg-white px-4 pt-2 pb-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
      {editing && (
        <p className="mb-1 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
          Mode koreksi — transaksi lama diganti saat disimpan
        </p>
      )}
      <ul className="max-h-40 divide-y divide-gray-100 overflow-y-auto">
        {price.items.map((item) => {
          const v = variantById[item.variantId]
          return (
            <li key={item.variantId} className="flex items-center gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{v?.label ?? '—'}</p>
                <p className="text-xs text-gray-500">
                  {formatRupiah(item.unitPrice)}
                  {v && item.unitPrice !== v.price && (
                    <span className="ml-1 line-through">{formatRupiah(v.price)}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Kurangi ${v?.label ?? ''}`}
                  onClick={() => onSetQty(item.variantId, item.qty - 1)}
                  className="h-11 w-11 rounded-lg border border-gray-300 text-lg font-bold text-gray-700 active:bg-gray-100"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label={`Jumlah ${v?.label ?? ''}`}
                  value={item.qty}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10)
                    // field kosong saat mengetik ulang: pertahankan item, jangan hapus
                    onSetQty(item.variantId, Number.isNaN(n) ? 1 : n)
                  }}
                  className="h-11 w-14 rounded-lg border border-gray-300 text-center text-base font-semibold"
                />
                <button
                  type="button"
                  aria-label={`Tambah ${v?.label ?? ''}`}
                  onClick={() => onSetQty(item.variantId, item.qty + 1)}
                  className="h-11 w-11 rounded-lg border border-gray-300 text-lg font-bold text-gray-700 active:bg-gray-100"
                >
                  +
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-1 flex flex-col gap-0.5 text-sm">
        {price.discount > 0 && (
          <>
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{formatRupiah(price.subtotal)}</span>
            </div>
            <div className="flex justify-between font-medium text-green-700">
              <span>
                {price.promoApplied
                  ? `Promo ${PROMO_LABELS[price.promoApplied]}`
                  : price.bulkPerBottle > 0
                    ? `Diskon bulk ${formatRupiah(price.bulkPerBottle)}/botol`
                    : 'Diskon'}
              </span>
              <span data-testid="cart-discount">−{formatRupiah(price.discount)}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-900">
            {bottleCount} botol · <span data-testid="cart-total">{formatRupiah(price.total)}</span>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-11 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-600 active:bg-gray-100"
            >
              {editing ? 'Batal koreksi' : 'Kosongkan'}
            </button>
            <button
              type="button"
              onClick={onPay}
              className="h-11 rounded-lg bg-brand px-5 text-sm font-bold text-white active:bg-brand-dark"
            >
              Bayar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
