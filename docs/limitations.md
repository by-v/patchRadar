# Keterbatasan yang Diketahui (MVP)

Daftar keterbatasan teramati/diketahui yang relevan untuk rilis dan validasi. Item di sini bukan janji perbaikan dalam perubahan yang sama; perubahan perilaku mengikuti PRD dan persetujuan.

## Rate limit
- **404 tetap menghitung kuota FR-25a (teramati 15 Nov 2026, Fase A A4, remote v8).** Pengguna anonim baru memanggil scan 6x ke repo tak ada; scan_C_1..5 → 404 `REPO_NOT_FOUND_OR_PRIVATE`, scan_C_6 → 429 `RATE_LIMITED`. Panggilan yang menghasilkan 404 tetap terhitung terhadap batas 5 scan/10 menit per pengguna anonim. Dapat mengejutkan pada salah ketik URL, tetapi membatasi probe. Belum dinyatakan eksplisit di PRD. Lihat `docs/prd-change-proposals.md` §7.

## Observabilitas
- **Tahap `timed` bernama untuk rate limit/persist belum ada di `stages` log** (teramati Fase A, handler v8). Efek terverifikasi lewat respons/DB (persisted, baris `rate_limit_events`/429), tetapi tidak sebagai stage bernama eksplisit. Ditunda sebagai tugas S (T-W3-14).

## RLS & rilis
- Uji isolasi RLS pada skenario anon B vs A lulus di remote v8 (Fase A A3), namun **wajib diulang pada build rilis** (T-W4-04).