# Keterbatasan yang Diketahui (MVP)

Daftar keterbatasan teramati/diketahui yang relevan untuk rilis dan validasi. Item di sini bukan janji perbaikan dalam perubahan yang sama; perubahan perilaku mengikuti PRD dan persetujuan.

## Rate limit
- **404 tetap menghitung kuota FR-25a (teramati 15 Nov 2026, Fase A A4, remote v8).** Pengguna anonim baru memanggil scan 6x ke repo tak ada; scan_C_1..5 → 404 `REPO_NOT_FOUND_OR_PRIVATE`, scan_C_6 → 429 `RATE_LIMITED`. Panggilan yang menghasilkan 404 tetap terhitung terhadap batas 5 scan/10 menit per pengguna anonim. Dapat mengejutkan pada salah ketik URL, tetapi membatasi probe. Belum dinyatakan eksplisit di PRD. Lihat `docs/prd-change-proposals.md` §7.

## Observabilitas
- **Tahap `timed` bernama untuk rate limit/persist belum ada di `stages` log** (teramati Fase A, handler v8). Efek terverifikasi lewat respons/DB (persisted, baris `rate_limit_events`/429), tetapi tidak sebagai stage bernama eksplisit. Ditunda sebagai tugas S (T-W3-14).

## RLS & rilis
- Uji isolasi RLS pada skenario anon B vs A lulus di remote v8 (Fase A A3) dan **diulang pada build rilis** 17 November 2026 (`T-W4-04`): B 0 baris, tulis 403/42501, anon 401/42501, `leakDetected=false` (`docs/rls-test.md`).

## Hasil validasi (`T-W4-05`, `T-W4-06`)
- **Validasi belum memakai 5–10 peserta.** Sesi PRD §16.2 diganti uji mandiri 2 perangkat (Expo web + APK 1.0.0 vc2) pada 19 November 2026; metrik pemahaman label dan keputusan terbantu **belum terverifikasi**. Blocker 0 pada alur yang diuji. Rincian `docs/validation-results.md`.
- **Banner/peringatan untuk repo >500 paket belum terverifikasi.** Repo `Orientasi-Jelajah-Aman` (862 paket) berhasil dipindai tanpa crash, tetapi apakah aplikasi menampilkan peringatan ukuran tidak dicatat pada sesi validasi.
- **Pengukuran waktu ke hasil pada validasi memakai bukti lama.** Sesi 19 November 2026 tidak mengukur ulang tap→render; p95 5.621 ms berasal dari `T-W4-03` (453 paket, n=5), bukan pengukuran baru.
- **Riwayat hilang setelah uninstall (R-10) tetap berlaku.** Riwayat lokal bertahan saat offline dan setelah aplikasi ditutup, tetapi tidak disinkronkan ulang pada MVP; uninstall menghapus riwayat perangkat.