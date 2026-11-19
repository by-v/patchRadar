# Hasil Validasi — `T-W4-05` (uji mandiri 2 perangkat)

Uji mandiri (self-test) sebagai pengganti sementara sesi 5–10 peserta PRD §16.2.
Status: **sebagian** — validasi perangkat selesai; validasi peserta dan sebagian metrik wawancara **belum terpenuhi**.

## 1. Metode

- Uji mandiri, bukan moderated think-aloud dengan peserta luar. Tanggal **19 November 2026**, sesi mulai **20:30 WIB** (jam selesai tidak dicatat).
- Perangkat A: laptop, aplikasi dijalankan lewat **Expo web (`expo start`)** — build pengembangan, bukan paritas rilis.
- Perangkat B: **Realme XT**, APK rilis **1.0.0 versionCode 2**.
- Sesi anonim baru per pengujian; tidak ada rekaman layar, isi repo, atau data pribadi yang disimpan.
- Semua repo uji adalah repo publik; tidak ada isi repo yang disalin ke dokumen ini.

## 2. Perangkat dan build

| Perangkat | Build | Versi | Tanggal |
|---|---|---|---|
| A Laptop | Expo web (`expo start`) | commit kerja saat uji | 19 Nov 2026, 20:30 WIB |
| B Realme XT | APK rilis | 1.0.0 (vc2) | 19 Nov 2026, 20:30 WIB |

## 3. Hasil per tugas

| Tugas | Web | Android | Catatan |
|---|---|---|---|
| T1 — repo privat `by-v/venue-booking-system` | layar repo privat tampil | layar repo privat tampil | teks verbatim sesi ini tidak dikutip ulang; rujuk `T-W4-09` (`req_0fb7577d0d864245aece0e417178bec`) |
| T1 — repo Python `by-v/bugHunter_cli` | pesan "package.json tidak ditemukan" | tidak diuji | parafrase; teks persis UI tidak dicatat |
| T1 — `stylelint/stylelint` | berhasil, Detail terbuka | berhasil, hasil sama | 453 paket diperiksa, 2 paket bertemuan, 2 temuan: **Pantau ×2** |
| T1 — `zalden-programmer/Orientasi-Jelajah-Aman` | berhasil, Detail terbuka | berhasil, hasil sama | 862 paket diperiksa, 8 paket bertemuan, 31 temuan: **Jadwalkan ×14, Pantau ×17, FIX_NOW ×0** |
| T1 — `zalden-programmer/patchradar-fixnow-fixture` (fixture, lockfile v3, 1 paket) | berhasil | berhasil, hasil sama | 2 temuan: **Tambal sekarang ×1 (CVE-2020-11023, KEV), Jadwalkan ×1 (CVE-2020-11022, EPSS 0,992)** |
| T2 — tiga label | self-check, bukan metrik | self-check, bukan metrik | tidak sah dihitung sebagai "pemahaman label ≥80%" |
| T3 — prioritas | dapat membedakan Tambal sekarang vs Jadwalkan | dapat membedakan | urutan pilihan akhir tidak dicatat |
| T4 — salin perintah | **berhasil**, perintah `npm install jquery@3.5.0` tersalin dan ditempel | **berhasil**, percobaan pertama | dari layar Detail temuan `FIX_NOW` pada fixture |
| T5 — offline | Wi-Fi dimatikan: Riwayat → Hasil → Detail berjalan | Wi-Fi dimatikan, aplikasi ditutup lalu dibuka tanpa internet: Riwayat → Hasil → Detail berjalan | lulus di kedua perangkat |
| Crash | tidak ada | tidak ada | 2/2 sesi tanpa crash |

Percobaan scan: web 5 percobaan (3 berhasil, 2 penolakan yang diharapkan), Android 4 percobaan (3 berhasil, 1 penolakan yang diharapkan).

## 4. Metrik PRD §16.1

| Metrik | Target | Hasil | Status |
|---|---|---|---|
| Tingkat scan berhasil | ≥85% | Jalur normal **6/6 (100%)**; termasuk jalur error **6/9 (67%)** | Lulus pada jalur normal; angka total turun karena 3 percobaan memang menguji penolakan yang diharapkan |
| Waktu ke hasil | p95 ≤15 s (≤500 paket) | Tidak diukur ulang sesi ini; pengembang menyatakan "sama seperti pengujian sebelumnya" → rujuk `T-W4-03` p95 **5.621 ms** (453 paket, n=5) | Bukti pendukung, bukan pengukuran baru |
| Crash-free | 100% | **2/2 (100%)** | Lulus |
| Riwayat offline | 100% | **2/2 (100%)** — Riwayat→Hasil→Detail di kedua perangkat | Lulus |
| Pemahaman label | ≥80% | — | **Belum diverifikasi** (tanpa peserta) |
| Keputusan terbantu | ≥70% | — | **Belum diverifikasi** (self-rating bias) |
| Repo dengan temuan | deskriptif | **3/3** repo npm valid (2, 2, dan 31 temuan) | Deskriptif |
| Repo dengan Tambal sekarang | deskriptif | **1/3** (fixture `jquery@3.4.1`) | Deskriptif |
| Salin perintah | ≥90% | **2/2 (100%)** — perintah `npm install jquery@3.5.0` tersalin di web dan Android | Lulus (deskriptif, n=2) |

## 5. Observasi

- Hasil web dan Android konsisten pada ketiga repo npm yang diuji.
- Panduan perbaikan untuk temuan transitif yang terlihat sebelumnya: "Perbarui paket induk atau jalankan `npm audit fix`". Untuk dependensi langsung `jquery`, perintah yang tersalin adalah `npm install jquery@3.5.0`.
- `Orientasi-Jelajah-Aman` melebihi ambang 500 paket (862). Perilaku banner/peringatan ukuran tidak dicatat pada sesi ini.
- Dua repo pertama (stylelint dan Orientasi) tidak menghasilkan `FIX_NOW`; jalur "Tambal sekarang" baru teruji lewat fixture.

## 6. Kriteria lulus PRD §16.2

- [x] Tidak ada bug blocker (tidak ada crash; T1, T4, T5, salin perintah, dan jalur error berjalan)
- [ ] ≥80% menyelesaikan T1 dan T5 — T5 **lulus 2/2**, tetapi persentase peserta **tidak dapat dihitung** (n=2 perangkat)
- [ ] ≥80% benar menjelaskan tiga label — **belum diverifikasi**
- [ ] ≥70% merasa terbantu — **belum diverifikasi**
- [x] Tidak ada peserta menyimpulkan "proyek saya pasti aman" — tidak ada peserta; ketiga repo memang punya temuan dengan label Pantau/Jadwalkan/Tambal sekarang

## 7. Bug dan triase (input `T-W4-06`)

| # | Temuan | Perangkat | Tingkat | Tindakan |
|---|---|---|---|---|
| 1 | Tidak ada bug fungsional teramati | web + Android | — | tidak ada perbaikan blocker |

## 8. Penyimpangan dan keterbatasan

- Peserta 5–10 diganti uji mandiri 2 perangkat; AC "minimal 5 peserta" **tidak terpenuhi**.
- Metrik wawancara (pemahaman label, keputusan terbantu) **tidak diukur**; tidak diklaim lulus.
- Build web adalah build pengembangan (`expo start`), bukan paritas rilis APK.
- Waktu ke hasil tidak diukur ulang dengan stopwatch; angka p95 berasal dari `T-W4-03`.
- Jam selesai sesi dan urutan prioritas yang dipilih tidak dicatat.
- Tidak ada data pribadi atau isi repo yang disimpan; hanya metadata paket, jumlah temuan, dan tautan repo publik.

## 9. Ringkasan

Pada 19 November 2026 pukul 20:30 WIB, aplikasi diuji mandiri di dua perangkat: Expo web di laptop dan APK 1.0.0 (vc2) di Realme XT. Alur utama berjalan tanpa crash di keduanya dengan hasil identik; jalur error repo privat dan repo tanpa `package.json` menampilkan pesan yang sesuai; Riwayat → Hasil → Detail tetap berjalan tanpa koneksi di kedua perangkat. Dari tiga repo npm valid, semuanya menghasilkan temuan (2, 31, dan 2 temuan). Fixture `jquery@3.4.1` menghasilkan satu `FIX_NOW` dan satu `SCHEDULE`, dan perintah `npm install jquery@3.5.0` berhasil disalin serta ditempel dari layar Detail pada kedua perangkat. Metrik yang membutuhkan peserta manusia (pemahaman label dan keputusan terbantu) tetap belum terverifikasi, sehingga `T-W4-05` belum dapat ditutup.

## 10. Repo uji

| Repo | Keterangan |
|---|---|
| `https://github.com/by-v/venue-booking-system` | privat (uji jalur error) |
| `https://github.com/by-v/bugHunter_cli` | Python, tanpa `package.json` (uji jalur error) |
| `https://github.com/stylelint/stylelint` | publik, 453 paket |
| `https://github.com/zalden-programmer/Orientasi-Jelajah-Aman` | publik, 862 paket |
| `https://github.com/zalden-programmer/patchradar-fixnow-fixture` | fixture `jquery@3.4.1`, 1 paket, menghasilkan `FIX_NOW` + `SCHEDULE` |
