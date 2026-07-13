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
          className={`h-11 rounded-full text-[13.5px] font-bold ${
            value === c
              ? 'bg-brand text-white shadow-[0_4px_10px_rgba(226,81,126,.25)]'
              : 'bg-white text-tint-ink shadow-[0_2px_8px_rgba(160,60,95,.08)]'
          }`}
        >
          {CHANNEL_LABELS[c]}
        </button>
      ))}
    </div>
  )
}
