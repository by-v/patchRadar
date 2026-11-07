# Matriks Penugasan Error PatchRadar

Sumber kondisi: `docs/PRD.md` §12 (23 kondisi). Tabel ini memetakan setiap kondisi ke tugas implementasi dan uji.

| No | Kondisi (ringkas) | Kelompok | Tugas |
|---:|---|---|---|
| 1 | Input kosong | A — masukan dan manifest | `T-W3-07a` |
| 2 | Format URL bukan `https://github.com/pemilik/repo` | A — masukan dan manifest | `T-W3-07a` |
| 3 | Host selain `github.com` | A — masukan dan manifest | `T-W3-07a` |
| 4 | Path tambahan atau query | A — masukan dan manifest | `T-W3-07a` |
| 5 | Repo tidak ditemukan (404) | A — masukan dan manifest | `T-W3-07a` |
| 6 | Repo privat/forbidden (403) | A — masukan dan manifest | `T-W3-07a` |
| 7 | 404 yang tidak bisa dibedakan dari privat | A — masukan dan manifest | `T-W3-07a` |
| 8 | Tanpa `package.json` | A — masukan dan manifest | `T-W3-07a` |
| 9 | Manifest di atas batas ukuran | A — masukan dan manifest | `T-W3-07a` |
| 10 | Lockfile rusak/tidak didukung | A — masukan dan manifest | `T-W3-07a` |
| 11 | GitHub rate limit | B — sumber eksternal dan batas laju | `T-W3-07b` |
| 12 | OSV rate limit/5xx | B — sumber eksternal dan batas laju | `T-W3-07b` |
| 13 | EPSS gagal | B — sumber eksternal dan batas laju | `T-W3-07b` |
| 14 | KEV gagal, salinan lama ada | B — sumber eksternal dan batas laju | `T-W3-07b` |
| 15 | KEV belum pernah tersedia | B — sumber eksternal dan batas laju | `T-W3-07b` |
| 16 | Timeout total | B — sumber eksternal dan batas laju | `T-W3-07b` |
| 17 | Tidak ada koneksi | C — jaringan, auth, dan cloud | `T-W3-07c` |
| 18 | Sesi anonim gagal dibuat | C — jaringan, auth, dan cloud | `T-W3-07c` |
| 19 | JWT kedaluwarsa | C — jaringan, auth, dan cloud | `T-W3-07c` |
| 20 | Batas laju aplikasi | B — sumber eksternal dan batas laju | `T-W3-07b` |
| 21 | Gagal simpan SQLite | C — jaringan, auth, dan cloud | `T-W3-07c` |
| 22 | Respons server tidak valid | C — jaringan, auth, dan cloud | `T-W3-07c` |
| 23 | Gagal simpan cloud | C — jaringan, auth, dan cloud | `T-W3-07c` |

## Bukti Uji

Isi tabel ini saat implementasi. Setiap baris wajib memiliki bukti uji dan status.

| No | Bukti uji (perintah/langkah) | Status |
|---:|---|---|
| 1–23 | Diisi oleh `T-W3-07a`, `T-W3-07b`, dan `T-W3-07c` | `[ ]` |
