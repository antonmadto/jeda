import type { VariantInfo } from '../../lib/catalog'
import { CATEGORY_LABELS } from '../../lib/catalog'
import type { Category } from '../../lib/pricing'
import { formatRupiah } from '../../lib/format'

export default function ProductGrid({
  variants,
  qtyByVariant,
  onTap,
}: {
  variants: VariantInfo[]
  qtyByVariant: Record<string, number>
  onTap: (variantId: string) => void
}) {
  const categories = (['fresh', 'creamy', 'ramu'] as Category[]).filter((c) =>
    variants.some((v) => v.category === c),
  )

  return (
    <div className="flex flex-col gap-5">
      {categories.map((category) => (
        <div key={category}>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
            {CATEGORY_LABELS[category]}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {variants
              .filter((v) => v.category === category)
              .map((v) => {
                const qty = qtyByVariant[v.variantId] ?? 0
                return (
                  <button
                    key={v.variantId}
                    type="button"
                    aria-label={v.label}
                    onClick={() => onTap(v.variantId)}
                    className={`relative flex min-h-16 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left shadow-sm active:scale-95 ${
                      qty > 0 ? 'bg-brand-light ring-2 ring-brand' : 'bg-white'
                    }`}
                  >
                    {v.imageUrl ? (
                      <img
                        src={v.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-11 w-11 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-light text-lg font-bold text-brand"
                      >
                        {v.productName.charAt(0)}
                      </span>
                    )}
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm leading-tight font-semibold text-gray-900">
                        {v.productName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {v.sizeMl} ml · {formatRupiah(v.price)}
                      </span>
                    </span>
                    {qty > 0 && (
                      <span className="absolute top-1.5 right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-1 text-xs font-bold text-white">
                        {qty}
                      </span>
                    )}
                  </button>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
