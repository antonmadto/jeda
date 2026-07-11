import type { Channel } from '../../lib/pricing'

export const CHANNEL_LABELS: Record<Channel, string> = {
  lapak: 'Lapak',
  cfd: 'CFD',
  online: 'Online',
  bulk: 'Bulk',
}

export default function ChannelTabs({
  value,
  onChange,
}: {
  value: Channel
  onChange: (c: Channel) => void
}) {
  return (
    <div role="radiogroup" aria-label="Kanal penjualan" className="grid grid-cols-4 gap-2">
      {(Object.keys(CHANNEL_LABELS) as Channel[]).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          onClick={() => onChange(c)}
          className={`h-11 rounded-full text-sm font-semibold ${
            value === c ? 'bg-brand text-white' : 'border border-gray-300 bg-white text-gray-700'
          }`}
        >
          {CHANNEL_LABELS[c]}
        </button>
      ))}
    </div>
  )
}
