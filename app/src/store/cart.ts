import { create } from 'zustand'
import type { Channel } from '../lib/pricing'
import { dayOfWeekWIB } from '../lib/date'

export type CartLine = { variantId: string; qty: number }

type CartState = {
  channel: Channel
  lines: CartLine[]
  /** Terisi kalau sedang mengoreksi transaksi lama. */
  editingSaleId: string | null
  setChannel: (channel: Channel) => void
  addOne: (variantId: string) => void
  setQty: (variantId: string, qty: number) => void
  clear: () => void
  loadForEdit: (saleId: string, channel: Channel, lines: CartLine[]) => void
}

/** Default lapak; otomatis cfd kalau hari Minggu (jadwal CFD Pandeglang). */
export function defaultChannel(now: Date = new Date()): Channel {
  return dayOfWeekWIB(now) === 0 ? 'cfd' : 'lapak'
}

export const useCartStore = create<CartState>((set) => ({
  channel: defaultChannel(),
  lines: [],
  editingSaleId: null,
  setChannel: (channel) => set({ channel }),
  addOne: (variantId) =>
    set((s) => {
      const existing = s.lines.find((l) => l.variantId === variantId)
      return {
        lines: existing
          ? s.lines.map((l) => (l.variantId === variantId ? { ...l, qty: l.qty + 1 } : l))
          : [...s.lines, { variantId, qty: 1 }],
      }
    }),
  setQty: (variantId, qty) =>
    set((s) => ({
      lines:
        qty <= 0
          ? s.lines.filter((l) => l.variantId !== variantId)
          : s.lines.map((l) => (l.variantId === variantId ? { ...l, qty } : l)),
    })),
  clear: () => set({ lines: [], editingSaleId: null }),
  loadForEdit: (saleId, channel, lines) =>
    set({ editingSaleId: saleId, channel, lines }),
}))
