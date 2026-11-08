# Log Due Diligence API/Data PatchRadar

Catat setiap verifikasi klaim eksternal di sini **sebelum** klaim tersebut dianggap fakta.
Satu baris per pemeriksaan. Simpan respons mentah sebagai fixture bila memungkinkan, dan
sebutkan jalur fixture pada kolom "hasil".

Aturan:
- Jangan menulis batas laju, kuota, atau format respons dari ingatan; tulis hanya hasil pengamatan.
- Jika hasil berbeda dari PRD, catat keputusan dan perbarui rencana cadangan.
- Tanda `[PERLU DIVERIFIKASI]` di PRD hanya boleh dihapus setelah ada baris log yang mendukung.

| Tanggal | Sumber | Yang dicek | Hasil | Keputusan |
|---|---|---|---|---|
| 9 November 2026 | Repo lokal (`git grep`, termasuk `--untracked`) | Pola `service_role`, `ghp_`, `github_pat_`, `BEGIN PRIVATE KEY` | Tidak ada nilai secret; hanya rujukan teks di `TASKS.md` dan komentar `supabase/config.toml` | Baseline bersih; pemindaian diulang sebelum build rilis (`T-W4-01`) |
| 9 November 2026 | GitHub REST + raw | Metadata dan manifest root `axios/axios`, `lodash/lodash`, `npm/cli`, `expressjs/express` | Metadata 200; default branch `v1.x`, `main`, `latest`, `master`; tiga `package-lock.json` 200 (355.049, 207.142, 437.638 byte); `expressjs/express` lock 404; semua `text/plain; charset=utf-8`; fixture di `fixtures/github/` | REST untuk metadata + raw untuk manifest; lockfile hilang ditangani lewat fallback `package.json` (FR-05) |
| 9 November 2026 | GitHub REST (`/rate_limit`, token dijalankan pengembang) | Batas laju terautentikasi dan pengaruh pengambilan raw | `core.limit=5000`; `used` 1→6 selama 5 panggilan REST; 8 pengambilan raw di antaranya tidak menambah `used`; fixture `fixtures/github/summary.json` | Token server-side menaikkan jatah ke 5000/jam; raw tidak memakai jatah REST core |
| 9 November 2026 | GitHub REST tanpa token | Batas laju anonim dan perilaku saat jatah habis | `core.limit=60`, reset `2026-11-08T20:29:40Z`; 52 panggilan menaikkan `used` ke 60 dan `remaining` ke 0; panggilan berikutnya 403 `API rate limit exceeded` dengan `x-ratelimit-remaining: 0` dan tanpa `Retry-After`; fixture `fixtures/github/rate-limit-exhaustion.json` | 403 dipetakan ke `RATE_LIMITED`; server memakai `x-ratelimit-reset` untuk pesan coba lagi |
| 9 November 2026 | GitHub REST | Beda 403 dan 404 untuk repo tidak ada/privat | Repo tidak ada saat jatah tersedia: 404 `Not Found`; repo tidak ada saat jatah habis: 403 rate limit; repo privat belum diuji langsung `[PERLU DIVERIFIKASI]` | Jangan menyimpulkan privat dari 403; untuk 404 tampilkan pesan gabungan tidak ditemukan/privat (R-02) |
| 9 November 2026 | `raw.githubusercontent.com` | Ketersediaan manifest saat jatah REST habis | `axios/axios` `package.json` tetap 200, 6.662 byte, sha256 sama dengan fixture, tanpa header `x-ratelimit-*` | Raw dapat dipakai sebagai jalur manifest saat REST dibatasi; default branch perlu cache |
