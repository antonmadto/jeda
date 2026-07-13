import type { VariantInfo } from '../../lib/catalog'
import { CATEGORY_LABELS } from '../../lib/catalog'
import type { Category } from '../../lib/pricing'
import { formatRupiah } from '../../lib/format'

const CATEGORY_DOT: Record<Category, string> = {
  fresh: 'bg-money',
  creamy: 'bg-cat-creamy-ink',
  ramu: 'bg-cat-ramu-ink',
}

const CATEGORY_INITIAL: Record<Category, string> = {
  fresh: 'bg-cat-fresh text-cat-fresh-ink',
  creamy: 'bg-cat-creamy text-cat-creamy-ink',
  ramu: 'bg-cat-ramu text-cat-ramu-ink',
}

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
          <h2 className="mb-2 flex items-center gap-2 text-xs font-extrabold tracking-[.09em] text-label uppercase">
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[category]}`}
            />
            {CATEGORY_LABELS[category]}
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
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
                    className={`relative flex min-h-[66px] items-center gap-2.5 overflow-visible rounded-[18px] border-[1.5px] px-[11px] py-[9px] text-left active:scale-95 ${
                      qty > 0
                        ? 'border-brand bg-brand-light shadow-[0_4px_12px_rgba(226,81,126,.18)]'
                        : 'border-transparent bg-white shadow-[0_2px_10px_rgba(160,60,95,.07)]'
                    }`}
                  >
                    {v.imageUrl ? (
                      <img
                        src={v.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-11 w-11 shrink-0 rounded-[12px] object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-lg font-extrabold ${CATEGORY_INITIAL[v.category]}`}
                      >
                        {v.productName.charAt(0)}
                      </span>
                    )}
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[13.5px] leading-tight font-bold text-ink">
                        {v.productName}
                      </span>
                      <span className="text-xs font-medium text-muted">
                        {v.sizeMl} ml · {formatRupiah(v.price)}
                      </span>
                    </span>
                    {qty > 0 && (
                      <span className="absolute -top-[7px] -right-[5px] flex h-[22px] min-w-[26px] items-center justify-center rounded-full bg-brand px-1.5 text-[13px] font-extrabold text-white shadow-[0_3px_8px_rgba(226,81,126,.35)]">
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
