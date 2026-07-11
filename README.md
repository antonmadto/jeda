# JE&DA, Aplikasi Pencatatan Usaha Jus

Proyek pengembangan aplikasi pencatatan untuk usaha jus JE&DA. Usaha sudah berjalan 1 tahun, pencatatan masih manual, pemilik ingin berkembang. Tahap saat ini adalah penggalian kebutuhan lewat kuesioner sebelum menentukan arah teknis.

## Isi Repo

| Berkas | Fungsi |
|---|---|
| `kuesioner-jeda.html` | Form kuesioner interaktif. Dibuka di browser HP, diisi, lalu tombol Simpan PDF menghasilkan file PDF jawaban untuk dikirim lewat WhatsApp. Bekerja penuh offline, jawaban tersimpan otomatis di perangkat |
| `docs/rencana-aplikasi.md` | Rencana pengembangan keseluruhan. Prinsip desain, prioritas fitur MVP, usulan teknologi, tahapan kerja, risiko |
| `docs/kuesioner.md` | Kuesioner versi teks, 47 pertanyaan dalam 9 bagian |
| `cetak/kuesioner-print.html` | Layout kuesioner versi cetak A4 |
| `cetak/kuesioner-jeda.pdf` | PDF siap cetak untuk pengisian tulis tangan |
| `tools/` | Skrip pembuat PDF dan pengujian otomatis berbasis Playwright |

## Cara Pakai Form Kuesioner

1. Kirim `kuesioner-jeda.html` ke pengisi lewat WhatsApp.
2. Pengisi membuka file di browser HP lalu mengisi. Jawaban tersimpan otomatis walau browser ditutup.
3. Setelah selesai, tekan tombol Simpan PDF. File PDF jawaban terunduh ke folder Unduhan.
4. Pengisi mengirim PDF tersebut secara manual lewat WhatsApp.

## Menjalankan Pengujian

```bash
npm install playwright
node tools/test-form.js
node tools/test-pdf-export.js
```

## Langkah Berikutnya

1. Isi kuesioner bersama pemilik usaha.
2. Putuskan pakai aplikasi kasir jadi atau bangun sendiri, lihat `docs/rencana-aplikasi.md` bagian 3.
3. Kalau bangun sendiri, lanjut ke mockup dan MVP sesuai tahapan di bagian 6.
