import { useState } from 'react'
import BahanTab from '../components/stok/BahanTab'
import ProduksiTab from '../components/stok/ProduksiTab'
import ResepTab from '../components/stok/ResepTab'
import BelanjaTab from '../components/stok/BelanjaTab'

const TABS = [
  { key: 'bahan', label: 'Bahan' },
  { key: 'produksi', label: 'Produksi' },
  { key: 'resep', label: 'Resep' },
  { key: 'belanja', label: 'Belanja' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function StokPage() {
  const [tab, setTab] = useState<TabKey>('bahan')

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Bagian stok" className="grid grid-cols-4 gap-1 rounded-2xl bg-track p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`h-[42px] rounded-[13px] text-[13.5px] ${
              tab === t.key
                ? 'bg-white font-extrabold text-ink shadow-[0_2px_8px_rgba(160,60,95,.12)]'
                : 'font-bold text-[#A17F8F]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'bahan' && <BahanTab />}
      {tab === 'produksi' && <ProduksiTab />}
      {tab === 'resep' && <ResepTab />}
      {tab === 'belanja' && <BelanjaTab />}
    </div>
  )
}
