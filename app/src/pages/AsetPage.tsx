import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { addAsset, fetchAssets, setAssetActive } from '../lib/assetsData'
import type { AssetRow } from '../lib/assetsData'
import { formatRupiah } from '../lib/format'
import { formatDateWIB, todayWIB } from '../lib/date'

export default function AsetPage() {
  const [rows, setRows] = useState<AssetRow[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(() => {
    setStatus('loading')
    fetchAssets()
      .then((r) => {
        setRows(r)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggleActive(row: AssetRow) {
    const next = !row.isActive
    if (
      !window.confirm(
        next ? `Aktifkan lagi aset "${row.name}"?` : `Tandai aset "${row.name}" nonaktif?`,
      )
    )
      return
    setBusyId(row.id)
    try {
      await setAssetActive(row.id, next)
      load()
    } catch {
      window.alert('Gagal mengubah status aset. Coba lagi.')
    } finally {
      setBusyId(null)
    }
  }

  const totalActive = rows.filter((r) => r.isActive).reduce((sum, r) => sum + r.cost, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link
          to="/lainnya"
          aria-label="Kembali"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-2xl text-ink-2 shadow-[0_2px_10px_rgba(160,60,95,.07)]"
        >
          ‹
        </Link>
        <h2 className="text-[22px] font-extrabold tracking-[-.01em] text-ink">Aset Usaha</h2>
      </div>

      {status === 'loading' && <p className="text-muted">Memuat aset…</p>}
      {status === 'error' && <p className="text-danger">Gagal memuat aset.</p>}

      {status === 'ready' && (
        <>
          <div className="rounded-[20px] bg-brand-light px-[18px] py-4">
            <p className="text-[13px] font-semibold text-brand">Total aset aktif</p>
            <p className="text-[28px] font-extrabold tracking-[-.02em] text-brand-dark">
              {formatRupiah(totalActive)}
            </p>
            <p className="text-[13px] text-brand">
              {rows.filter((r) => r.isActive).length} aset aktif
            </p>
          </div>

          {showAdd ? (
            <NewAssetForm
              onDone={() => {
                setShowAdd(false)
                load()
              }}
              onCancel={() => setShowAdd(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="h-[50px] rounded-2xl bg-brand font-extrabold text-white shadow-[0_6px_16px_rgba(226,81,126,.28)] active:bg-brand-dark"
            >
              + Tambah Aset
            </button>
          )}

          {rows.length === 0 ? (
            <p className="rounded-[20px] bg-white px-4 py-8 text-center text-faint shadow-[0_2px_10px_rgba(160,60,95,.07)]">
              Belum ada aset tercatat.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className={`rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)] ${
                    r.isActive ? '' : 'opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-extrabold text-ink">
                        {r.name}
                        {!r.isActive && (
                          <span className="ml-2 rounded-full bg-tint px-2 py-0.5 align-middle text-[11px] font-bold text-tint-ink">
                            Nonaktif
                          </span>
                        )}
                      </p>
                      <p className="text-xs font-medium text-muted">
                        Beli {formatDateWIB(r.purchasedAt)}
                        {r.usefulLifeMonths ? ` · umur pakai ${r.usefulLifeMonths} bln` : ''}
                      </p>
                      {r.note && <p className="mt-0.5 text-xs text-muted">{r.note}</p>}
                    </div>
                    <p className="shrink-0 text-lg font-extrabold text-ink">
                      {formatRupiah(r.cost)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => toggleActive(r)}
                    className={`mt-3 h-[46px] w-full rounded-[14px] font-bold disabled:opacity-60 ${
                      r.isActive
                        ? 'bg-tint text-tint-ink active:bg-tint-dark'
                        : 'bg-money text-white shadow-[0_6px_16px_rgba(46,155,104,.25)] active:bg-money-dark'
                    }`}
                  >
                    {busyId === r.id
                      ? 'Menyimpan…'
                      : r.isActive
                        ? 'Tandai Nonaktif'
                        : 'Aktifkan Lagi'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function NewAssetForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [purchasedAt, setPurchasedAt] = useState(todayWIB())
  const [cost, setCost] = useState('')
  const [usefulLife, setUsefulLife] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const costValue = parseInt(cost, 10)
  const valid = !!name.trim() && costValue > 0

  async function save() {
    if (!valid) return
    setSaving(true)
    try {
      const life = parseInt(usefulLife, 10)
      await addAsset({
        name: name.trim(),
        purchasedAt,
        cost: costValue,
        usefulLifeMonths: life > 0 ? life : null,
        note: note.trim() || null,
      })
      onDone()
    } catch {
      window.alert('Gagal menyimpan aset. Coba lagi.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[20px] bg-white p-4 shadow-[0_2px_10px_rgba(160,60,95,.07)]">
      <h3 className="text-base font-extrabold text-ink">Tambah Aset</h3>
      <input
        type="text"
        placeholder="Nama aset (mis. Cold Press, Freezer)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-12 rounded-[12px] border-[1.5px] border-border-soft bg-white px-3 text-ink placeholder:text-faint"
      />
      <label className="flex items-center justify-between gap-2 text-[13.5px]">
        <span className="font-medium text-ink-2">Tanggal beli</span>
        <input
          type="date"
          value={purchasedAt}
          max={todayWIB()}
          onChange={(e) => setPurchasedAt(e.target.value)}
          className="h-11 rounded-[12px] border-[1.5px] border-border-soft bg-white px-3 text-ink"
        />
      </label>
      <label className="flex items-center justify-between gap-2 text-[13.5px]">
        <span className="font-medium text-ink-2">Harga (Rp)</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="h-11 w-32 rounded-[12px] border-[1.5px] border-border-soft bg-white px-3 text-right text-ink placeholder:text-faint"
        />
      </label>
      <label className="flex flex-col gap-1 text-[13.5px]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-ink-2">Umur pakai (bulan)</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="opsional"
            value={usefulLife}
            onChange={(e) => setUsefulLife(e.target.value)}
            className="h-11 w-32 rounded-[12px] border-[1.5px] border-border-soft bg-white px-3 text-right text-ink placeholder:text-faint"
          />
        </div>
        <span className="text-xs text-faint">untuk perhitungan penyusutan nanti</span>
      </label>
      <input
        type="text"
        placeholder="Catatan (opsional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="h-11 w-full rounded-[12px] border-[1.5px] border-border-soft bg-white px-3 text-sm text-ink placeholder:text-faint"
      />
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-11 flex-1 rounded-[12px] bg-tint font-bold text-tint-ink active:bg-tint-dark disabled:opacity-60"
        >
          Batal
        </button>
        <button
          type="button"
          disabled={saving || !valid}
          onClick={save}
          className="h-11 flex-1 rounded-[12px] bg-brand font-bold text-white active:bg-brand-dark disabled:opacity-60"
        >
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  )
}
