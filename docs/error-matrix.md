# Matriks Penugasan dan Bukti Error PatchRadar

Sumber kondisi: `docs/PRD.md` §12 (23 kondisi). Setiap baris dipetakan ke tugas implementasi, bukti uji, dan status. Teks memakai sapuan bahasa T-W2-07 ("repo" menjadi "repositori"); batas paket memakai keputusan `T-W1-14` (1.500 paket, bukan 2.000).

## Kelompok A — masukan dan manifest (`T-W3-07a`)

| No | Kondisi (ringkas) | Perilaku | Bukti uji | Status |
|---:|---|---|---|---|
| 1 | Input kosong | Inline; fokus ke input; tidak ada request | `app/src/lib/url.test.ts` — "menolak string kosong", "menolak spasi saja"; `app/src/errors/messages.test.ts` | `[x]` |
| 2 | Format URL bukan `https://github.com/pemilik/repo` | Inline; tombol nonaktif | `app/src/lib/url.test.ts` — blok format (tanpa skema, `http://`, skema lain, tanpa pemilik, karakter tidak sah) | `[x]` |
| 3 | Host selain `github.com` | Inline | `app/src/lib/url.test.ts` — blok host (gitlab, subdomain, alamat IP) | `[x]` |
| 4 | Path tambahan atau query | Inline | `app/src/lib/url.test.ts` — blok path (`/tree`, `/blob`, query, fragmen) | `[x]` |
| 5 | Repo tidak ditemukan (404) | Layar error; kembali dan coba lagi | `supabase/functions/scan/handler.test.ts` — "repo tidak ada menghasilkan 404..."; `app/src/api/scan.test.ts` — pemetaan 404 | `[x]` |
| 6 | Repo privat/forbidden (403) | Layar error; tidak menawarkan login | `supabase/functions/scan/handler.test.ts` — "repo privat/forbidden menghasilkan 403"; `github.test.ts` — 403 metadata | `[x]` |
| 7 | 404 yang tidak bisa dibedakan dari privat | Layar error dengan dua saran | `supabase/functions/scan/handler.test.ts` — kode `REPO_NOT_FOUND_OR_PRIVATE`; `app/src/api/scan.test.ts` — pesan pengguna | `[x]` |
| 8 | Tanpa `package.json` | Layar error; saran periksa struktur | `supabase/functions/scan/handler.test.ts` — "package.json tidak ada menghasilkan 422"; `lib/lockfile.test.ts` — error terklasifikasi | `[x]` |
| 9 | Manifest di atas batas (5 MB atau 1.500 paket) | Layar error; tidak ada retry otomatis | `supabase/functions/scan/handler.test.ts` — "manifest > 5 MB" dan "lebih dari 1.500 paket unik" | `[x]` |
| 10 | Lockfile rusak/tidak didukung | Lanjut fallback `package.json`; banner perkiraan + warning | `lib/lockfile.test.ts` — "lockfile rusak memakai fallback", "lockfile v1"; `handler.test.ts` — repo tanpa lockfile | `[x]` |

## Kelompok B — sumber eksternal dan batas laju (`T-W3-07b`)

| No | Kondisi (ringkas) | Perilaku | Bukti uji | Status |
|---:|---|---|---|---|
| 11 | GitHub rate limit | Layar error; tombol coba lagi setelah waktu | — | `[ ]` |
| 12 | OSV rate limit/5xx | 502; tawarkan hasil cache terakhir | — | `[ ]` |
| 13 | EPSS gagal | 200 parsial; banner peringatan | — | `[ ]` |
| 14 | KEV gagal, salinan lama ada | 200 parsial; `sourceStatus.kev=STALE` | — | `[ ]` |
| 15 | KEV belum pernah tersedia | 200 parsial; banner | — | `[ ]` |
| 16 | Timeout total | 504; tawarkan cache dan coba lagi | — | `[ ]` |
| 20 | Batas laju aplikasi | 429; hitung mundur di UI | — | `[ ]` |

## Kelompok C — jaringan, auth, dan cloud (`T-W3-07c`)

| No | Kondisi (ringkas) | Perilaku | Bukti uji | Status |
|---:|---|---|---|---|
| 17 | Tidak ada koneksi | Inline; tautan ke Riwayat; tanpa retry otomatis | — | `[ ]` |
| 18 | Sesi anonim gagal dibuat | Pindai nonaktif; Riwayat tetap bisa dibuka | — | `[ ]` |
| 19 | JWT kedaluwarsa | Refresh sekali; jika gagal minta coba lagi | — | `[ ]` |
| 21 | Gagal simpan SQLite | Tetap tampilkan Hasil; Riwayat tidak bertambah | — | `[ ]` |
| 22 | Respons server tidak valid | Pesan dengan `requestId`; tombol coba lagi | — | `[ ]` |
| 23 | Gagal simpan cloud | 200 `persisted=false` + warning; hasil tetap tampil | — | `[ ]` |

## Catatan bukti

- Teks kondisi 1–4, 18, 19, 21–23 dan pemetaan presentasi berada di `app/src/errors/messages.ts`; `REPO_LINK_MESSAGES` dan `AUTH_MESSAGES` diekspor ulang dari modul asalnya agar pemanggil lama tetap bekerja.
- Kondisi 10 bukan error penghenti: respons tetap 200 dengan `manifest.estimated=true` dan warning `LOCKFILE_INVALID_JSON`, `LOCKFILE_V1`, `LOCKFILE_UNSUPPORTED`, atau `LOCKFILE_MISSING`.
- Kondisi 5–9 tampil sebagai layar error di layar Pindai dengan tombol **Coba lagi** dan **Kembali**; kondisi 1–4 tetap inline di bawah input.
