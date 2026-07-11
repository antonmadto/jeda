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
      <div role="radiogroup" aria-label="Bagian stok" className="grid grid-cols-4 gap-1 rounded-xl bg-gray-200 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`h-11 rounded-lg text-sm font-semibold ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
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
