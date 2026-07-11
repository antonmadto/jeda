import { create } from 'zustand'
import { fetchReceivablesCount } from '../lib/customersData'

type ReceivablesState = {
  count: number
  refresh: () => Promise<void>
}

/** Jumlah piutang (penjualan belum lunas) untuk badge di tab Lainnya. */
export const useReceivablesStore = create<ReceivablesState>((set) => ({
  count: 0,
  refresh: async () => {
    try {
      set({ count: await fetchReceivablesCount() })
    } catch {
      // diamkan; badge sekadar pengingat
    }
  },
}))
