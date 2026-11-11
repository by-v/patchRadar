# Usulan Perubahan PRD — Temuan Minggu 1

Status: **usulan, belum disetujui**. `docs/PRD.md` v1.1 tetap menjadi sumber kebenaran
sampai pengembang menyetujui perubahan di bawah ini. Dokumen ini tidak mengubah PRD.

## 1. Definisi `partial` yang dipakai implementasi

PRD §9.3/FR-23 mendefinisikan `partial=true` sebagai kondisi **ada sumber data yang
gagal atau tidak lengkap**: pengayaan KEV/EPSS gagal, atau lockfile hanya sebagian
dilewati. Fallback lockfile dan hasil perkiraan sudah punya penanda sendiri, yaitu
`manifest.estimated=true` dan banner "Hasil perkiraan", sehingga tidak perlu menyalakan
`partial`.

Implementasi membedakan dua kelompok warning:

| Warning | `partial` | Alasan |
|---|---|---|
| `OSV_PARTIAL` | `true` | Sebagian chunk OSV gagal; cakupan kerentanan tidak lengkap. |
| `OSV_DETAIL_PARTIAL` | `true` | Sebagian detail advisory gagal; severity/referensi bisa tidak lengkap. |
| `KEV_STALE` | `true` | Katalog KEV basi; status eksploitasi bisa berubah. |
| `KEV_UNAVAILABLE` | `true` | Katalog KEV tidak tersedia. |
| `EPSS_UNAVAILABLE` | `true` | Skor EPSS tidak tersedia untuk permintaan yang valid. |
| `LOCKFILE_PARTIAL` | `true` | Sebagian entri lockfile dilewati, sehingga daftar paket tidak lengkap. |
| `LOCKFILE_MISSING`, `LOCKFILE_INVALID_JSON`, `LOCKFILE_V1`, `LOCKFILE_UNSUPPORTED` | `false` | Fallback utuh ke `package.json`; status dibawa `manifest.estimated=true`. |
| `REGISTRY_PARTIAL` | `false` | Versi perkiraan jatuh ke batas bawah range; hasil tetap konsisten dan `estimated=true`. |
| `OSV_CACHE_READ_FAILED`, `OSV_CACHE_WRITE_FAILED` | `false` | Cache internal gagal, tetapi sumber OSV tetap dipanggil. |
| `KEV_CACHE_READ_FAILED` | `false` | Cache internal gagal; refresh feed tetap dicoba. |
| `CLOUD_PERSIST_FAILED` (Minggu 3) | `false` | PRD §327 secara eksplisit menyatakan kegagalan simpan cloud tidak mengubah `partial`. |

Usulan teks PRD: tambahkan paragraf di FR-23/§9.3 yang menyatakan bahwa fallback
lockfile, hasil `estimated`, kegagalan cache internal, dan kegagalan resolusi registry
**tidak** menyalakan `partial`; masing-masing diwakili `manifest.estimated`,
`sourceStatus`, atau warning informatif.

## 2. Kode warning tambahan

PRD §9.3 hanya menyebut lima kode: `EPSS_UNAVAILABLE`, `KEV_STALE`,
`KEV_UNAVAILABLE`, `LOCKFILE_PARTIAL`, `CLOUD_PERSIST_FAILED`. Implementasi Minggu 1
memakai kode tambahan berikut agar penyebab degradasi dapat dibedakan tanpa mengubah
kontrak utama:

| Kode | Asal | `partial` | Usulan ke PRD |
|---|---|---|---|
| `OSV_PARTIAL` | Sebagian chunk query OSV gagal setelah retry | `true` | Tambahkan ke daftar kode §9.3 dan matriks error §12. |
| `OSV_DETAIL_PARTIAL` | Sebagian pengambilan detail advisory gagal | `true` | Tambahkan; findings yang terdampak tetap tampil dengan metadata minimal. |
| `REGISTRY_PARTIAL` | Resolusi versi fallback `package.json` gagal untuk sebagian paket | `false` | Tambahkan sebagai warning informatif khusus jalur `estimated`. |
| `OSV_CACHE_READ_FAILED` | Baca `osv_cache` gagal | `false` | Tambahkan sebagai warning diagnostik internal. |
| `OSV_CACHE_WRITE_FAILED` | Tulis `osv_cache` gagal | `false` | Tambahkan sebagai warning diagnostik internal. |
| `KEV_CACHE_READ_FAILED` | Baca `kev_entries` gagal | `false` | Tambahkan sebagai warning diagnostik internal. |

`LOCKFILE_ENTRY_SKIPPED` tetap menjadi kode internal parser. Di respons publik, seluruh
entri yang dilewati digabung menjadi satu warning `LOCKFILE_PARTIAL` agar kontrak §9.3
tidak berubah.

## 3. Temuan lain Minggu 1 yang menyimpang dari PRD

1. **`persisted=false` di Minggu 1–2.** PRD §9.3/FR-22 mengartikan `persisted=false`
   sebagai kegagalan penyimpanan cloud. Sampai penyimpanan Minggu 3 dibangun, nilai ini
   berarti "belum dicoba disimpan". Usulan: beri catatan sementara di PRD atau pastikan
   Minggu 3 mengirim `CLOUD_PERSIST_FAILED` hanya saat penyimpanan benar-benar dicoba
   dan gagal.
2. **Bentuk respons batch OSV.** Respons batch hanya memuat `id` dan `modified`, tanpa
   severity/alias. Detail advisory harus diambil terpisah; kegagalan sebagian detail
   menjadi `OSV_DETAIL_PARTIAL`. Usulan: catat perilaku ini di FR-07/FR-11.
3. **Batas OSV.** Pengamatan nyata: 1.000 query per request diterima, 1.001 ditolak
   `too many queries`. Implementasi memakai chunk 50 untuk membatasi ukuran respons.
   Usulan: ganti penanda `[PERLU DIVERIFIKASI]` dengan angka ini di PRD.
4. **EPSS.** API mengembalikan maksimal 100 CVE secara default dan membutuhkan parameter
   `cve`; tanpa parameter, seluruh basis dikembalikan. `total=0`/`data=[]` untuk
   permintaan tidak kosong diperlakukan sebagai kegagalan (`EPSS_UNAVAILABLE`), bukan
   "tidak ada skor". CVE tanpa skor dalam respons campuran tetap `null`. Usulan: catat
   di FR-10 dan §12.
5. **KEV.** `knownRansomwareCampaignUse` bernilai `Known`/`Unknown`, bukan boolean.
   Hanya `Known` dipetakan ke `known_ransomware=true`. Usulan: catat di FR-09.
6. **Cache negatif OSV.** Hasil kosong ikut di-cache dengan TTL 24 jam, sehingga
   kerentanan yang baru diumumkan dalam jendela itu bisa terlewat. Ini sudah tercatat
   sebagai risiko A-03/Q-01; usulan: pertahankan sebagai keterbatasan MVP dan sebutkan
   di laporan akhir.
7. **Resolver npm registry pada jalur `estimated`.** PRD FR-05 menyebut pemakaian versi
   terbaru yang tersedia, tetapi tidak merinci kegagalan registry. Implementasi
   mempertahankan `estimated=true` dan memakai batas bawah range dengan warning
   `REGISTRY_PARTIAL`. Usulan: tambahkan satu kalimat di FR-05.

## 4. Batas atas paket sementara ±1.500 (usulan)

Gerbang `T-W1-14` (12 November 2026) menetapkan batas final **1.500 paket unik** dan **25 detik wall time**. Batas ini sudah diterapkan pada kode (`MAX_PACKAGES = 1_500`, respons `413 MANIFEST_TOO_LARGE`), tetapi `docs/PRD.md` belum diubah.

Dasar pengukuran final:

- Fixture `large-1500` (1.409 paket): wall parser median 7,924 ms, terburuk 9,211 ms; wall handler median 13,251 ms.
- `nestjs/nest` 1.425 paket: dingin 16,49 detik, hangat 3,69–3,89 detik.
- `socketio/socket.io` 1.179 paket: dingin 21,87 detik, hangat 3,24 detik.
- `mochajs/mocha` 715 paket: dingin 11,28 detik, hangat 2,45–2,75 detik.

Ekstrapolasi lama ≈11,8 ms/paket (2.000 paket ≈26 s) tidak lagi dipakai sebagai dasar keputusan. Batas 1.500 memberi margin di bawah batas keras 25 detik; 2.000 paket tidak dijamin dan ditolak.

Usulan teks PRD: cantumkan batas final ini di NFR-09 dan mekanisme penolakan/peringatan yang jelas untuk repositori di atas batas.

