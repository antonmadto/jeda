# Analisis Jawaban Kuesioner

Pengisi Aiman Faidz, 11 Juli 2026. Terjawab 48 dari 48. Sumber `docs/jawaban-kuesioner-aiman.pdf`.

## 1. Temuan Kunci

1. Usaha lebih besar dari asumsi awal. Bukan satu lapak, tapi 4 kanal penjualan. Lapak Toko Dirgantara Senin sd Sabtu, CFD Pandeglang tiap Minggu pagi, order online tiap hari jam 08.00 sd 20.00, dan bulk pre order untuk acara olahraga, kantor, pernikahan, dan jumat berkah.
2. Produksi model batch, bukan per pesanan. Belanja bahan Selasa dan Kamis, produksi jam 3 sd 5 pagi, target 300 botol per siklus belanja, stok disimpan di freezer, umur simpan 3 sd 5 hari tergantung buah. Penjualan 45 sd 120 botol per hari.
3. Katalog produk kompleks. Sekitar 16 produk dalam 3 kategori. Coldpressed dan fresh juice 7 macam dengan 2 tingkat harga, creamy 6 macam, ramu 2 macam. Kemasan 4 ukuran, 100 ml, 250 ml, 500 ml, 1 liter.
4. Ada aturan harga otomatis yang rumit kalau dihitung manual. Promo Jumat Berkah dan Sabtu Ceria semua fresh juice jadi 15 ribu. Diskon bulk bertingkat, 50 pcs potong 1.000 per botol, 100 pcs potong 2.000, 500 pcs potong 3.000.
5. Aiman sudah paham HPP. Dia bisa merinci biaya per botol, contoh susu kurma 250 ml biayanya 7.750 dijual 15.000. Uang usaha sudah terpisah dari uang pribadi, QRIS BTN rekening khusus usaha. Ini tingkat kesiapan yang tinggi.
6. Pencatatan sudah rajin tapi manual. Buku tulis dan HP, dicatat sekali sehari jam 20.00. Yang dicatat sudah banyak, cash flow, transaksi, menu terlaris, repeat customer. Keluhan utamanya persis dua hal, menghitung tidak praktis dan repeat customer rate suka lupa.
7. Ada piutang informal. Pelanggan dekat suka bayar telat. Perlu pencatatan piutang sederhana.
8. Program langganan sedang dibuat, paket detox dan diet Senin sampai Minggu. Ini fitur masa depan yang jelas.
9. Kebiasaan unik, screenshot rekap tiap hari sebagai bukti harian, dan catatan tulis tetap ingin dipertahankan. Aplikasi harus punya satu layar rekap harian yang enak di-screenshot.
10. Pengguna aplikasi 2 orang, Aiman dan istri. HP iPhone dan Android. Sinyal lancar. Belum pernah pakai aplikasi kasir apa pun. Minta diajari langsung. Bersedia catat dobel seminggu pertama.

## 2. Prioritas Dari Pengisi

Urutan yang dia pilih sendiri di pertanyaan 44.

1. Catat penjualan cepat.
2. Ingat stok bahan dan kapan harus belanja.
3. Rekap otomatis buat evaluasi bulanan.

Harapan satu kalimatnya, semua tentang data dan hitung hitungan menjadi mudah dengan otomatis.

## 3. Keputusan Arah Teknis

Bangun aplikasi sendiri, bukan pakai aplikasi kasir jadi. Alasannya spesifik.

1. Aplikasi kasir umum tidak punya model produksi batch dengan resep bahan baku dan siklus belanja 2 kali seminggu. Ini kebutuhan inti nomor 2 versi Aiman.
2. Aturan promo hari tertentu plus diskon bulk bertingkat butuh mesin harga khusus.
3. Multi kanal dengan jam operasional berbeda per kanal perlu dipisahkan di laporan.
4. Program langganan paket detox akan butuh modul sendiri, tidak ada di kasir gratis.

## 4. Implikasi Desain

| Temuan | Implikasi ke aplikasi |
|---|---|
| 45 sd 120 transaksi botol per hari, catat sekali sehari jam 20.00 | Mode input cepat per transaksi di lapak, plus mode rekap malam untuk yang terlewat |
| Produksi batch 300 botol, umur simpan 3 sd 5 hari | Catat batch produksi per tanggal, stok jadi berkurang otomatis saat penjualan, peringatan stok tua |
| Belanja Selasa dan Kamis di 2 pasar | Daftar belanja otomatis dari selisih stok bahan vs kebutuhan produksi berikutnya |
| Promo Jumat Sabtu dan diskon bulk | Harga dihitung mesin promo, kasir tidak pernah menghitung manual |
| Screenshot bukti harian | Layar Rekap Harian satu halaman, tombol bagikan gambar ke WhatsApp |
| 2 pengguna, iPhone dan Android | PWA web app, login 2 akun, data di cloud |
| Piutang pelanggan dekat | Penjualan bisa ditandai belum lunas, daftar piutang |
| Repeat customer rate suka lupa | Pelanggan opsional per transaksi, hitung repeat rate otomatis |
| Minta diajari langsung | Alur UI sesederhana mungkin, sesi latihan seminggu catat dobel |

## 5. Yang Ditunda

1. Modul langganan paket detox dan diet. Masuk fase lanjutan setelah MVP dipakai rutin.
2. Integrasi GoFood. Belum masuk GoFood, cukup kanal online manual dulu.
3. Multi lokasi ruko grab and go. Arsitektur data disiapkan multi kanal, UI multi lokasi menyusul.
4. Foto catatan manual tidak tersedia, pengisi belum berkenan. Validasi desain input dilakukan lewat sesi catat dobel minggu pertama.
