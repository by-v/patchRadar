# Keterbatasan yang Diketahui (MVP)

Daftar keterbatasan teramati/diketahui yang relevan untuk rilis dan validasi. Item di sini bukan janji perbaikan dalam perubahan yang sama; perubahan perilaku mengikuti PRD dan persetujuan.

## Rate limit
- **404 tetap menghitung kuota FR-25a (teramati 15 Nov 2026, Fase A A4, remote v8).** Pengguna anonim baru memanggil scan 6x ke repo tak ada; scan_C_1..5 → 404 `REPO_NOT_FOUND_OR_PRIVATE`, scan_C_6 → 429 `RATE_LIMITED`. Panggilan yang menghasilkan 404 tetap terhitung terhadap batas 5 scan/10 menit per pengguna anonim. Dapat mengejutkan pada salah ketik URL, tetapi membatasi probe. Belum dinyatakan eksplisit di PRD. Lihat `docs/prd-change-proposals.md` §7.

## Observabilitas
- **Tahap `timed` bernama kini tersedia** (ditutup 20 November 2026, `T-W3-14`, commit `ed69073`, `scan` v11). `stages` memuat `rate_limit`, `persist`, dan `retention`; efek perilaku tetap dibuktikan terpisah lewat respons/DB. Yang **belum diverifikasi** adalah tampilan baris `stages` di dashboard (CLI tidak menyediakan `functions logs`), bukan keberadaan kodenya: sumber deployed 30/30 SAME dengan lokal yang lulus unit test.

## RLS & rilis
- Uji isolasi RLS pada skenario anon B vs A lulus di remote v8 (Fase A A3) dan **diulang pada build rilis** 17 November 2026 (`T-W4-04`): B 0 baris, tulis 403/42501, anon 401/42501, `leakDetected=false` (`docs/rls-test.md`).

## Hasil validasi (`T-W4-05`, `T-W4-06`)
- **Validasi MVP memakai uji mandiri 2 perangkat (PRD 1.2).** Sesi 5–10 peserta ditunda ke Tahap 2; metrik pemahaman label dan keputusan terbantu **belum terukur**. Blocker 0 pada alur yang diuji. Rincian `docs/validation-results.md`.
- **Banner/peringatan untuk repo >500 paket belum terverifikasi.** Repo `Orientasi-Jelajah-Aman` (862 paket) berhasil dipindai tanpa crash, tetapi apakah aplikasi menampilkan peringatan ukuran tidak dicatat pada sesi validasi.
- **Pengukuran waktu ke hasil pada validasi memakai bukti lama.** Sesi 19 November 2026 tidak mengukur ulang tap→render; p95 5.621 ms berasal dari `T-W4-03` (453 paket, n=5), bukan pengukuran baru.
- **Riwayat hilang setelah uninstall (R-10) tetap berlaku.** Riwayat lokal bertahan saat offline dan setelah aplikasi ditutup, tetapi tidak disinkronkan ulang pada MVP; uninstall menghapus riwayat perangkat.

## Tentang dan disclaimer (`T-W4-07`)
- **Layar Tentang memuat disclaimer dan keterbatasan utama** yang ditegaskan ulang di `app/src/app/(tabs)/tentang.tsx`: hasil bersifat potensial, tidak menjamin proyek aman, tidak menjamin perbaikan berhasil, dan bukan pengganti audit keamanan profesional.
- **Riwayat cloud bersifat upaya terbaik (`persisted=false`).** Bila penyimpanan cloud gagal, hasil tetap di perangkat dan aplikasi menampilkan "Riwayat cloud gagal disimpan; hasil tetap tersedia di perangkat." MVP tidak menyinkronkan ulang sehingga salinan cloud dapat tidak lengkap.
- **Retensi data cloud 90 hari (NFR-14) sudah diterapkan ke proyek remote (20 November 2026, `scan` v11).** `supabase/functions/scan/retention.ts` menjalankan `purge_old_scans` secara lazy (maksimal sekali per jam per instance) setelah scan sukses dan mencatat waktu serta ukuran database di log. Eksekusi nyata pada data berumur > 90 hari **belum diverifikasi** karena belum ada data uji setua itu; pembersihan juga bergantung pada scan berikutnya. Fitur dapat dimatikan dengan `RETENTION_DAYS=off`; bila dimatikan, data tersimpan sampai pembersihan manual (R-08).
- **FR-25b (batas per hash IP) aktif di remote sejak 20 November 2026** (`IP_HASH_SALT` diset, `scan` v11). Uji live: panggilan ke-20 dari 5 akun anonim berbeda pada IP yang sama menghasilkan 429 `RATE_LIMITED` (`req_f81e119e34ed48a2bdc1941d1a3f06d9`, `retryAfter` 3546). Bila garam dihapus, hanya FR-25a (5 scan/10 menit per pengguna anonim) yang berlaku. IP mentah tidak pernah disimpan.
- **Cakupan uji kegunaan terbatas.** Tentang menyatakan versi ini baru diuji mandiri pada dua perangkat dan belum pada 5–10 peserta, sehingga pemahaman label oleh pengguna luar belum terukur (lihat `docs/validation-results.md`).