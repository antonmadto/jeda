# Rencana Implementasi Aplikasi JE&DA

Rencana eksekusi untuk Claude Code. Kerjakan berurutan Fase 0 sampai Fase 8. Satu fase satu sesi kerja. Setiap fase punya kriteria selesai yang bisa diverifikasi. Konteks bisnis lengkap ada di `analisis-kuesioner.md`, konvensi teknis di `CLAUDE.md` root repo.

## Tujuan Produk

Menggantikan hitung hitungan manual Aiman dengan 3 kemampuan inti sesuai prioritas yang dia pilih sendiri.

1. Catat penjualan cepat di semua kanal.
2. Tahu stok bahan dan kapan harus belanja.
3. Rekap otomatis harian, mingguan, bulanan, dengan layar rekap harian yang bisa di-screenshot dan dibagikan.

## Arsitektur

```
[PWA React+Vite]  <->  [Supabase: Postgres + Auth + RLS]
       |
  vite-plugin-pwa (installable di iPhone & Android)
       |
  deploy: Vercel (gratis)
```

Dua akun pengguna (Aiman, istri) dalam satu workspace data bersama. Tidak perlu multi tenant.

## Model Data

Migrasi SQL di `supabase/migrations/`. Semua tabel pakai `id uuid default gen_random_uuid()`, `created_at timestamptz default now()`, RLS aktif.

```sql
-- katalog
products(id, name, category text check (category in ('fresh','creamy','ramu')), is_active bool)
product_variants(id, product_id fk, size_ml int, price int)        -- harga integer rupiah

-- bahan & resep
ingredients(id, name, unit text check (unit in ('gram','ml','pcs')), cost_per_unit numeric, stock_qty int, reorder_point int)
recipes(id, variant_id fk, ingredient_id fk, qty int)              -- kebutuhan per 1 botol

-- produksi & stok
production_batches(id, batch_date date, note text)
production_items(id, batch_id fk, variant_id fk, qty int)
finished_stock(variant_id pk fk, qty int)
stock_movements(id, kind text check (kind in ('production','sale','adjustment','spoilage','giveaway')),
                ref_id uuid, variant_id fk null, ingredient_id fk null, qty_delta int, created_at)

-- penjualan
customers(id, name, phone text null, note text null)
sales(id, sold_at timestamptz, channel text check (channel in ('lapak','cfd','online','bulk')),
      payment text check (payment in ('cash','qris')), status text check (status in ('lunas','belum_lunas')),
      customer_id fk null, promo_applied text null, subtotal int, discount int, total int)
sale_items(id, sale_id fk, variant_id fk, qty int, unit_price int, line_total int)

-- pengeluaran
expenses(id, spent_at date, category text check (category in ('bahan','kemasan','listrik','bensin','galon','es','lainnya')),
         amount int, note text)
```

## Seed Data Nyata

Wajib dibuat sebagai migrasi seed. Ini menu dan harga asli dari kuesioner. Harga format 500 ml / 250 ml untuk kategori fresh.

| Produk | Kategori | Komposisi | 500 ml | 250 ml |
|---|---|---|---|---|
| Immune | fresh | sunkist, timun, nanas | 38.000 | 18.000 |
| Anti Virus | fresh | kunyit, nanas, pir | 38.000 | 18.000 |
| Retinol | fresh | wortel, sunkist, apel | 40.000 | 20.000 |
| Hydrate | fresh | semangka, lemon, apel | 38.000 | 18.000 |
| Power | fresh | bit, apel, nanas, jahe | 38.000 | 18.000 |
| Weight Loss | fresh | naga, nanas, apel | 38.000 | 18.000 |
| Pure (per jenis buah) | fresh | 1 jenis buah | 30.000 | 15.000 |

| Produk | Kategori | Harga |
|---|---|---|
| Susu Kurma | creamy | 15.000 |
| Susu Kurma Almond | creamy | 18.000 |
| Strawberry Almond | creamy | 18.000 |
| Strawberry Pisang Susu | creamy | 18.000 |
| Naga Pisang Susu | creamy | 18.000 |
| BerUbi Ubi | creamy | 20.000 |
| Kunyit Asem | ramu | 15.000 |
| Jahe Merah | ramu | 15.000 |

Ukuran tersedia 100 ml, 250 ml, 500 ml, 1 liter. Seed cukup isi varian yang harganya diketahui, varian lain ditambah pemilik lewat UI.

Contoh resep untuk validasi HPP (dari kuesioner, Susu Kurma 250 ml). Susu 167 ml biaya 3.000, kurma 42 gram biaya 2.500, air galon 500 ml biaya 1.050, botol plus stiker 1.200. Total HPP 7.750, harga jual 15.000. Unit test HPP harus mereproduksi angka ini.

## Mesin Harga

Fungsi murni `computePrice(items, channel, date)` di `src/lib/pricing.ts`.

1. Hari Jumat atau Sabtu (WIB), kanal lapak atau cfd, kategori fresh, harga per botol jadi 15.000. Nama promo `jumat_berkah` atau `sabtu_ceria` disimpan di `sales.promo_applied`.
2. Kanal bulk, total kuantitas >= 50 potong 1.000 per botol, >= 100 potong 2.000, >= 500 potong 3.000.
3. Promo dan diskon bulk tidak pernah digabung. Kanal bulk tidak kena promo Jumat Sabtu.
4. Selain itu harga normal dari `product_variants.price`.

## Fase Eksekusi

### Fase 0. Scaffold

Tugas.
1. Inisialisasi Vite + React + TypeScript + Tailwind + vite-plugin-pwa di root repo (folder `app/` supaya arsip discovery tidak tercampur).
2. Setup Vitest dan Playwright. Buat 1 test dummy masing masing.
3. Buat `.env.example` berisi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
4. Layout dasar mobile, bottom nav 4 tab. Jual, Stok, Rekap, Lainnya.

Selesai jika `npm run dev` jalan, `npm run build` bersih, kedua test runner hijau, bottom nav tampil di viewport 390 px.

### Fase 1. Data dan Auth

Tugas.
1. Buat migrasi SQL sesuai Model Data di atas, plus RLS policy semua tabel untuk authenticated user.
2. Seed data produk dan harga sesuai tabel Seed Data Nyata, plus bahan dan resep Susu Kurma 250 ml sebagai contoh.
3. Login email password Supabase untuk 2 akun. Halaman login sederhana, sesi persisten.
4. Util `formatRupiah`, tanggal WIB, dan client Supabase di `src/lib/`.

Selesai jika bisa login logout di HP, tabel terisi seed, query produk tampil di layar sementara, RLS terbukti menolak akses anon (tulis test-nya).

### Fase 2. Catat Penjualan (prioritas 1 Aiman)

Tugas.
1. Layar Jual. Pilih kanal di atas (default lapak, otomatis cfd kalau hari Minggu). Grid produk per kategori, ketuk produk lalu pilih ukuran dan jumlah, keranjang di bawah.
2. Mesin harga `pricing.ts` lengkap dengan unit test. Kasus wajib, harga normal, Jumat Berkah fresh 15.000, creamy tidak kena promo, bulk 50 100 500, bulk tidak digabung promo.
3. Pembayaran cash atau QRIS, status lunas atau belum lunas, pelanggan opsional (pilih atau tambah cepat berdasarkan nama).
4. Simpan penjualan mengurangi `finished_stock` lewat `stock.ts`, tercatat di `stock_movements`. Stok kurang tetap boleh jual, tampilkan peringatan.
5. Daftar transaksi hari ini di bawah layar Jual, bisa dikoreksi dan dihapus selama masih hari yang sama.

Selesai jika alur ketuk produk sampai tersimpan maksimal 5 ketukan untuk kasus umum, semua unit test pricing hijau, e2e Playwright satu transaksi lapak dan satu transaksi bulk 50 pcs lolos.

### Fase 3. Produksi dan Stok Bahan (prioritas 2 Aiman)

Tugas.
1. Layar Stok tab Bahan. Daftar bahan, stok, tanda merah kalau di bawah reorder point. Tambah dan koreksi stok (kind `adjustment`).
2. Layar Stok tab Produksi. Catat batch produksi dini hari, pilih varian dan jumlah botol. Batch mengurangi stok bahan sesuai resep, menambah `finished_stock`.
3. Editor resep per varian. Pilih bahan dan kuantitas per botol. Tampilkan HPP live dan margin terhadap harga jual.
4. Daftar Belanja. Tombol buat daftar belanja, hitung kebutuhan bahan untuk target produksi berikutnya (default 300 botol sesuai kebiasaan, bisa diubah) dikurangi stok tersisa, kelompokkan per bahan. Bisa dibagikan sebagai teks WhatsApp.
5. Pencatatan sisa. Aksi tandai botol dibagikan (giveaway) atau rusak (spoilage) supaya stok jadi akurat.

Selesai jika unit test HPP Susu Kurma menghasilkan 7.750, batch produksi terbukti mengurangi bahan dan menambah stok jadi lewat `stock_movements`, daftar belanja menghitung benar pada data uji.

### Fase 4. Rekap dan Laporan (prioritas 3 Aiman)

Tugas.
1. Layar Rekap Harian. Satu halaman berisi tanggal, omzet, jumlah botol, rincian per kanal, rincian cash vs QRIS, pengeluaran hari itu, laba kotor (omzet dikurangi HPP terjual dikurangi pengeluaran), 5 produk terlaris. Dirancang rapi untuk di-screenshot.
2. Tombol Bagikan. Render rekap jadi gambar PNG (html-to-image) dan share ke WhatsApp lewat Web Share API, fallback unduh gambar.
3. Input pengeluaran cepat dengan kategori (bahan, kemasan, listrik, bensin, galon, es, lainnya).
4. Rekap mingguan dan bulanan. Tren omzet, produk terlaris, laba kotor, perbandingan antar kanal.
5. Repeat customer rate bulanan, persentase transaksi dari pelanggan yang pernah beli sebelumnya, tampil di rekap bulanan.

Selesai jika angka rekap terbukti cocok dengan data uji yang dihitung manual di test, tombol bagikan menghasilkan PNG yang benar, repeat rate benar pada skenario test 2 pelanggan.

### Fase 5. Piutang dan Pelanggan

Tugas.
1. Daftar piutang dari penjualan `belum_lunas`, urut paling lama, tombol tandai lunas dengan tanggal bayar.
2. Halaman pelanggan, riwayat beli per pelanggan, total belanja, terakhir beli.
3. Pengingat visual piutang lewat badge di tab Lainnya.

Selesai jika alur belum lunas sampai lunas tercatat benar dan riwayat pelanggan akurat pada data uji.

### Fase 6. PWA, Deploy, Serah Terima

Tugas.
1. PWA manifest dan ikon JE&DA (pink #D81B60), installable di iPhone Safari dan Android Chrome, cache app shell untuk buka cepat.
2. Deploy ke Vercel, environment production terpasang.
3. Backup ekspor. Tombol ekspor semua data ke file Excel (xlsx) per rentang tanggal, untuk rasa aman pemilik yang masih ingin pegang catatan sendiri.
4. Tulis `docs/panduan-pemakaian.md` berbahasa sederhana bergambar langkah untuk Aiman dan istri, sesuai preferensi mereka diajari langsung.

Selesai jika app terpasang di HP sungguhan, Lighthouse PWA installable lolos, ekspor xlsx terbuka benar di Excel.

### Fase 7. Uji Lapangan Catat Dobel

Bukan fase koding. Satu minggu Aiman catat di aplikasi dan di buku sekaligus (dia sudah bersedia, jawaban 47). Setiap malam bandingkan. Kumpulkan koreksi, perbaiki, baru lepas buku.

### Fase 8. Laporan Investor

Ditambahkan 18 Jul 2026 atas arahan pemilik. Tujuan: aplikasi bisa menghasilkan laporan keuangan yang layak diperlihatkan ke calon investor (atau AI agent milik investor) sebagai dasar suntikan modal. Keluaran akhir: PDF laporan keuangan plus pendamping JSON yang angkanya identik, supaya bisa diverifikasi mesin. Fase ini dipecah tiga sub-fase, kerjakan berurutan. 8a boleh berjalan paralel dengan Fase 7 karena makin cepat data dikeraskan, makin panjang deret historis yang bersih untuk investor. Database produksi sudah berisi data nyata, semua migrasi wajib aditif (tidak mengubah atau menghapus kolom/fungsi yang dipakai versi app yang sedang terpasang).

#### Fase 8a. Pengerasan Data Keuangan

Menutup celah data yang membuat angka laporan tidak bisa diaudit.

Tambahan model data (migrasi aditif).

```sql
-- belanja bahan, harga historis tercatat (bukan cuma cost_per_unit terkini)
ingredient_purchases(id, ingredient_id fk, purchased_at date, qty int, total_cost int, note text null)

-- stock_movements.kind ditambah 'purchase'
-- expenses.category ditambah 'sewa','gaji','promosi'
-- expenses.purchase_id uuid null fk unique -> ingredient_purchases, biar belanja otomatis jadi pengeluaran (tidak dobel catat)
-- sale_items.hpp_at_sale int null  -- HPP per botol saat transaksi, dibekukan oleh record_sale

-- aset / modal usaha
assets(id, name, purchased_at date, cost int, useful_life_months int null, note text null, is_active bool)
```

Tugas.
1. RPC `record_purchase(ingredient_id, qty, total_cost, purchased_at, expense_category, note)`. Atomik: insert `ingredient_purchases`, tambah `ingredients.stock_qty`, update `ingredients.cost_per_unit` dengan rata rata bergerak `(stok_lama*biaya_lama + total_cost) / (stok_lama + qty)` (kalau stok lama <= 0 pakai `total_cost/qty`), catat `stock_movements` kind `purchase`, insert `expenses` kategori `bahan` atau `kemasan` yang tertaut `purchase_id`. RPC `undo_purchase` hanya untuk hari yang sama, membalik stok dan menghapus expense tertaut (cost_per_unit dibiarkan, terdokumentasi).
2. `record_sale` dimodifikasi (signature tidak berubah): hitung `hpp_at_sale` per item di sisi SQL dari resep kali `cost_per_unit` saat itu. Migrasi backfill `sale_items.hpp_at_sale` yang lama pakai biaya terkini (pendekatan terbaik yang ada).
3. Perluas kategori pengeluaran di constraint dan di UI `ExpenseQuickAdd`: tambah `sewa`, `gaji`, `promosi`.
4. `reports.ts` memakai `hpp_at_sale` bila terisi, fallback perhitungan biaya terkini bila null.
5. UI Catat Belanja di tab Bahan: pilih bahan, kuantitas, total harga, tanggal, kategori pengeluaran. Beri keterangan bahwa belanja lewat form ini otomatis tercatat sebagai pengeluaran (jangan input dobel di Rekap).
6. Halaman Aset di tab Lainnya: daftar aset/modal usaha, tambah, tandai nonaktif. Belum ada perhitungan depresiasi (itu 8b).
7. RLS aktif untuk semua tabel baru, hanya authenticated.

Selesai jika unit test rata rata bergerak dan snapshot HPP hijau, `record_purchase` terbukti atomik di integration test, `npm run build` dan `npm run test` lolos, dan migrasi terbukti aditif (app versi lama tetap jalan terhadap skema baru).

#### Fase 8b. Mesin Analisis Keuangan

Fungsi murni di `src/lib/finance.ts` dengan unit test lengkap, tanpa perhitungan di komponen UI (konvensi sama dengan `pricing.ts`).

1. Laba rugi per periode: omzet, HPP terjual (dari snapshot), laba kotor, pengeluaran operasional per kategori, depresiasi garis lurus dari `assets` yang punya `useful_life_months`, laba bersih.
2. Unit economics per kanal: omzet, botol, HPP, margin per kanal per periode.
3. Tren pertumbuhan bulanan: omzet, laba, jumlah transaksi, repeat rate.
4. Arus kas sederhana: kas masuk (penjualan lunas plus pelunasan piutang berdasar `paid_at`), kas keluar (pengeluaran), posisi piutang dan umur piutang (aging).

Selesai jika semua angka tereproduksi dari data uji yang dihitung manual di test.

##### Catatan metodologi (8b)

Keputusan basis perhitungan `src/lib/finance.ts` (untuk halaman metodologi laporan):
- **A. Laba rugi (akrual).** Omzet diakui saat penjualan (tanggal WIB `sold_at`), termasuk yang belum lunas. HPP terjual dari snapshot `hpp_at_sale` (fallback biaya resep terkini bila null). Pengeluaran operasional (opex) TIDAK memasukkan kategori `bahan` dan `kemasan` karena biaya barang itu sudah terhitung di dalam HPP; memasukkannya berarti dobel hitung. Depresiasi garis lurus `cost / useful_life_months` per bulan, hanya aset aktif ber-masa-manfaat, dihitung penuh per bulan (tanpa proporsi harian). Laba bersih = laba kotor − opex − depresiasi.
- **B. Unit economics per kanal.** Omzet, botol, HPP, laba kotor, margin %, harga jual rata-rata per botol, dan porsi diskon per kanal. Uang tetap integer rupiah; persen dibulatkan 1 desimal; pembagian nol dijaga (hasil 0).
- **C. Tren bulanan.** Per bulan WIB: omzet, laba kotor, laba bersih, jumlah transaksi, botol, pertumbuhan omzet bulan-ke-bulan (null di bulan pertama / penyebut nol), dan repeat rate (pakai `computeRepeatRate` yang sama dengan rekap, tidak dibuat ulang).
- **D. Arus kas (kas).** Kas masuk memakai `paid_at` (lunas tanpa `paid_at` dianggap tunai di `sold_at`; belum lunas tanpa `paid_at` belum jadi kas). Kas keluar mencakup SEMUA pengeluaran termasuk `bahan`/`kemasan` — sengaja asimetris dengan laba rugi karena kas mencatat belanja nyata saat uang keluar. Piutang = belum lunas tanpa `paid_at` per akhir periode, dikelompokkan umur ≤7, 8–30, dan >30 hari dari `sold_at`.

Rekap harian (`reports.ts`) sengaja TIDAK diubah: itu pandangan kas ala Aiman; `finance.ts` adalah pandangan investor yang terpisah.

#### Fase 8c. Laporan Investor, PDF dan JSON

1. Halaman Laporan Investor di tab Lainnya. Pilih rentang periode (default 3 bulan terakhir), pratinjau laporan: profil usaha singkat, laba rugi, unit economics per kanal, tren, arus kas, piutang, aset.
2. Unduh PDF. Renderer di-lazy-load supaya bundle utama tetap ringan (pilih antara `@react-pdf/renderer` atau print stylesheet, putuskan saat implementasi dengan uji di iPhone Safari).
3. Unduh JSON pendamping dengan skema stabil dan berversi (`report_version`), angka identik dengan PDF, dirancang untuk dibaca AI agent investor.
4. Halaman metodologi singkat di laporan: basis perhitungan (akrual sederhana), sumber tiap angka, tanggal cetak.

Selesai jika PDF terbuka benar di HP, angka PDF dan JSON identik dengan hasil `finance.ts` pada data uji, dan pemilik bisa menghasilkan laporan tanpa bantuan.

## Backlog Setelah MVP

1. Modul langganan paket detox dan diet Senin sampai Minggu (sedang dia rancang, jawaban 36).
2. Kanal GoFood saat sudah daftar.
3. Multi lokasi untuk rencana ruko grab and go dan 2 titik jualan (jawaban 6).
4. Umur stok jadi per batch (FEFO) kalau volume makin besar.

## Cara Menjalankan Dengan Claude Code

Buka repo ini di VS Code, jalankan `claude` di terminal, lalu per fase beri prompt seperti ini.

```
Baca CLAUDE.md dan docs/IMPLEMENTATION_PLAN.md.
Kerjakan Fase 0 saja. Jangan mengerjakan fase lain.
Setelah selesai jalankan npm run build dan npm run test,
tunjukkan hasilnya, lalu berhenti.
```

Ganti nomor fase setiap sesi. Review hasil tiap fase sebelum lanjut. Untuk Fase 1 siapkan dulu project Supabase gratis di supabase.com, isi `.env.local`, dan login `npx supabase login` supaya migrasi bisa diterapkan.
