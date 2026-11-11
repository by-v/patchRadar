# Laporan Gerbang Minggu 1 — Go/No-Go

Tanggal keputusan: **12 November 2026**  
Ruang lingkup: pipeline `scan` Supabase Edge Function, API/data eksternal, parser lockfile, dan batas performa/CPU.  
Sumber kebenaran: `docs/PRD.md` v1.1 §13.1, NFR-01, NFR-09, NFR-17, R-06, R-15.

## 1. Keputusan gerbang

**GO** untuk melanjutkan ke Minggu 2, dengan batas operasional **1.500 paket unik** dan **25 detik wall time**. Tidak ada blocker tanpa rencana tindak lanjut.

## 2. Verdict gerbang §13.1

| Gerbang | Verdict | Bukti |
|---|---|---|
| GitHub dapat diakses dengan batas laju yang layak | **Go** | Probe 12 November 2026: metadata + manifest `axios`, `lodash`, `npm-cli`, `express` berhasil; repo tidak ada → 404; batas anonim `60/jam`; batas token server-side `5.000/jam` sudah diuji 9 November 2026. Token server harus terpasang di deployment sebelum rilis. |
| OSV batch mendukung minimal 50 query | **Go** | Batch 50 → 200, 50 hasil; 1.000 → 200; 1.001 → 400 `too many queries`. Implementasi memakai chunk 50. |
| OSV menyediakan severity yang dapat dipetakan | **Go** | 40/40 detail advisory berhasil; 39 punya alias CVE, 1 GHSA tanpa CVE; CVSS_V3 dipetakan ke Critical/High/Medium/Low; `database_specific` dipakai bila hanya CVSS_V4; `MODERATE` → `MEDIUM`. |
| KEV dapat diunduh dan diparse | **Go** | 12 November 2026: `catalogVersion=2026.11.10`, `count=1.779`, seluruh field wajib ada di 1.779 entri, lisensi CC0 1.0. |
| EPSS dapat di-query per batch atau per CVE | **Go setelah perbaikan** | Semantik batch nyata: CVE harus dipisah koma dalam **satu** parameter `cve`. Setelah perbaikan, socket.io 22/23 CVE berEPSS, nestjs 76/77; `sourceStatus.epss=OK`. |
| Anonymous sign-in tersedia | **Dijadwalkan** | Bukan gerbang Minggu 1. Keputusan dan verifikasi dipindahkan ke `T-W3-03` sesuai jadwal PRD §13. |
| Performa tiga fixture ±100/±500/±1.500 paket | **Go** | Diukur pada Edge Function `cpu-spike`; lihat §3. Target p95 dan batas final ditetapkan di §4. |
| CPU `scan` pada ≥400 dan ≥1.500 paket di bawah batas platform | **Go dengan batas atas** | CPU platform tidak teramati; batas atas dari wall time sinkron/parse jauh di bawah 2.000 ms; lihat §5. |
| Edge Function cukup untuk batas keras 25 detik | **Go pada ≤1.500 paket** | Cold scan terburuk yang teramati 21,87 detik pada 1.179 paket; 1.425 paket 16,49 detik. Batas keras 25 detik dipertahankan. |

## 3. Hasil performa

### 3.1 Wall time fixture (parser, tanpa jaringan)

Diukur dengan fungsi sementara `cpu-spike` di runtime `supabase-edge-runtime-1.78.1` (kompatibel Deno v2.1.4), 9 run setelah 1 warmup. Fungsi dihapus kembali dari remote setelah pengukuran. Bukti: `docs/scan-14-cpu.json`.

| Fixture | Paket unik | Body | Wall handler median | Wall handler terburuk | Wall parser median | Wall parser terburuk |
|---|---:|---:|---:|---:|---:|---:|
| `small-100` | 107 | 51.572 B | 0,792 ms | 0,945 ms | 0,465 ms | 0,524 ms |
| `medium-500` | 491 | 267.718 B | 3,415 ms | 62,381 ms | 2,304 ms | 2,391 ms |
| `large-1500` | 1.409 | 846.584 B | 13,251 ms | 15,939 ms | 7,924 ms | 9,211 ms |

### 3.2 Wall time end-to-end remote (jaringan + cache)

Scan remote nyata; ukuran paket adalah hasil parser, bukan jumlah baris lockfile. Cache dingin = scan pertama untuk repo tersebut; hangat = scan berikutnya. Bukti: `docs/scan-14-perf.json`, `docs/scan-14-perf-medium.json`, `docs/scan-14-epss-verify.json`.

| Repo | Paket | Dingin | Hangat (min–maks) | Temuan | `sourceStatus` akhir |
|---|---:|---:|---:|---:|---|
| `koajs/koa` | 363 | 4,91 s | 2,15–2,76 s | 12 | OSV/KEV/EPSS OK |
| `axios/axios` | 680 | 4,42 s | 2,33–2,68 s | 2 | OSV/KEV/EPSS OK |
| `mochajs/mocha` | 715 | 11,28 s | 2,45–2,75 s | 55 | OSV/KEV/EPSS OK |
| `socketio/socket.io` | 1.179 | 21,87 s | 3,24 s | 28 | OSV/KEV/EPSS OK |
| `nestjs/nest` | 1.425 | 16,49 s | 3,69–3,89 s | 77 | OSV/KEV/EPSS OK |

Catatan: satu sampel dingin per repo; angka hangat memakai 4–9 sampel. Karena ukuran sampel kecil, p95 dilaporkan sebagai nilai terburuk sampel (bukan estimasi statistik formal).

## 4. Target p95 dan batas final

| Ukuran | Target p95 dingin | Target p95 hangat | Batas keras |
|---|---:|---:|---:|
| ≤500 paket | ≤15 detik | ≤6 detik | 25 detik |
| 500–1.500 paket | ≤22 detik | ≤6 detik | 25 detik |

**Batas atas final: 1.500 paket unik dan 25 detik wall time.** Repo di atas 1.500 paket ditolak `413 MANIFEST_TOO_LARGE`; konstanta `MAX_PACKAGES` dan pesan pengguna diperbarui pada 12 November 2026. Batas 2.000 paket di PRD tetap berstatus sementara dan diusulkan berubah ke 1.500 di `docs/prd-change-proposals.md`; `docs/PRD.md` tidak diubah pada tugas ini.

Target 15 detik untuk 500 paket terpenuhi: `mochajs/mocha` 715 paket dingin 11,28 detik. Target hangat terpenuhi dengan margin besar: maksimum 3,89 detik pada 1.425 paket.

## 5. Keputusan CPU

- **CPU platform tidak teramati.** Tidak ada header CPU pada respons; `Deno.cpuUsage`/`node:process.cpuUsage` mengembalikan 0 bahkan untuk loop parse berulang. Angka CPU tidak diperkirakan.
- **Batas atas CPU** memakai wall time tahap sinkron. Log `T-W1-12d` menunjukkan `syncMs` 1–18 ms untuk 1.425 paket. Pengukuran ulang parser 12 November 2026: wall parser terburuk 9,211 ms (1.409 paket) dan wall handler terburuk 15,939 ms (1.409 paket); outlier 62,381 ms pada 491 paket tetap **3,1%** dari batas 2.000 ms.
- **Ambang 70%** (1.400 ms) tidak terlampaui. Mitigasi R-15 (pecah pekerjaan per chunk atau pindahkan pekerjaan berat) **tidak diaktifkan**.
- Keputusan: satu Edge Function `scan` tetap cukup. CPU dashboard dipantau ulang pada `T-W3-13`; bila CPU per scan mendekati 1.400 ms, mitigasi R-15 dijalankan.

## 6. Timeout, parsial, dan kegagalan satu sumber

| Skenario | Hasil | Bukti |
|---|---|---|
| Timeout upstream | 504 `SCAN_TIMEOUT`; `AbortController` dipakai | Unit test handler; `T-W1-11`/`T-W1-12d` |
| OSV gagal total | 502 `UPSTREAM_UNAVAILABLE`, tidak ada baris scan sukses | Fault-test `T-W1-12d`, `req_a325466ea90f49829c367306168bd506` |
| KEV kosong / basi | 200 + `KEV_UNAVAILABLE` / `KEV_STALE`, scan tetap berjalan | Fault-test `T-W1-12d` |
| EPSS gagal | 200 + `partial=true` + `EPSS_UNAVAILABLE`, findings tetap ada | Scan nyata 07:13–07:19 UTC dan unit test |
| Lockfile sebagian | 200 + `LOCKFILE_PARTIAL`, `partial=true` | `nestjs/nest`, lihat §7(a) |

## 7. Penyelesaian item terbuka `T-W1-12d`

### (a) `LOCKFILE_PARTIAL` nestjs/nest

21 entri dilewati: 10 `node_modules/@nestjs/*` bertipe `link/workspace` dan 11 direktori `packages/*` (non-`node_modules`). Pemeriksaan dependensi workspace menunjukkan **tidak ada dependensi eksternal yang hilang**; seluruh dependensi eksternal workspace tersedia di entri `node_modules/*` lain, termasuk `content-type@2.1.0`. Paket yang dilewati adalah paket milik monorepo sendiri, bukan dependensi registry. `partial=true` **sesuai PRD §9** karena daftar paket memang tidak lengkap; warning tetap ditampilkan.

### (b) Penyebab EPSS gagal 8–14 ms

Penyebabnya adalah konstruksi URL batch: parameter `cve` diulang (`?cve=A&cve=B&cve=C`). EPSS hanya memproses **parameter terakhir**, sehingga untuk 23 CVE socket.io hanya `CVE-2026-93753` yang dikirim; CVE itu tidak ada di EPSS → `total=0`/`data=[]` → diklasifikasikan gagal. Perbaikannya: satu parameter `cve` berisi daftar dipisah koma. Unit test regresi ditambahkan, fungsi `scan` versi 5 di-deploy, dan verifikasi remote menghasilkan EPSS OK (socket.io 22/23, nestjs 76/77).

### (c) Pengukuran ulang setelah perbaikan batching/cache

- Fixture `medium-500` (491 paket): parser wall median 2,304 ms; handler wall median 3,415 ms.
- Fixture `large-1500` (1.409 paket): parser wall median 7,924 ms; handler wall median 13,251 ms.
- End-to-end: axios 680 paket dingin 4,42 detik / hangat 2,33–2,68 detik; mocha 715 paket dingin 11,28 detik / hangat 2,45–2,75 detik; nest 1.425 paket dingin 16,49 detik / hangat 3,69–3,89 detik.

### (d) Redirect GitHub 301

Keputusan: redirect **tidak diikuti** pada Minggu 1 (perilaku saat ini 502 `UPSTREAM_UNAVAILABLE`, bukan kegagalan senyap). Implementasi Minggu 2/3: ikuti **maksimal satu** redirect hanya bila `Location` tetap `https://api.github.com`, tanpa userinfo/port/skema turun, dan path tetap dalam allowlist. Redirect berantai, tujuan host lain, alamat IP privat/loopback, dan `http://` tetap ditolak. Kasus uji SSRF ditambahkan di `T-W3-07b`.

### (e) Dua tugas prioritas S

Diputuskan **ditunda** setelah MVP: (1) query `kev_entries` hanya untuk CVE yang dibutuhkan dan (2) baca cache OSV paralel dengan konkurensi terbatas. Alasan: target p95 sudah terpenuhi (hangat maksimum 3,89 detik; `osvMs` hangat nest 2,29–2,51 detik, turun dari baseline 4,15 detik) dan biaya `kevMs` 700–900 ms masih di bawah anggaran. Pemicu untuk mengerjakan: p95 hangat >6 detik, `kevMs` >1 detik, atau CPU dashboard mendekati 1.400 ms. Keduanya dicatat sebagai kandidat optimasi pasca-MVP, bukan blocker gerbang.

### (f) Usulan batas paket

Usulan ±1.500 paket beserta ekstrapolasi berlabel diperbarui di `docs/prd-change-proposals.md` §4. `docs/PRD.md` tidak diubah. Batas 1.500 sudah diterapkan pada kode sebagai keputusan gerbang.

## 8. Tindak lanjut dan blocker

Tidak ada blocker. Tindak lanjut yang tercatat:

1. `T-W3-03`: verifikasi anonymous sign-in.
2. `T-W3-07b`: redirect 301 satu hop + uji SSRF.
3. `T-W3-13`: pantau CPU dashboard dan p95 hangat; aktifkan R-15 bila ambang terlampaui.
4. Sebelum rilis: pastikan secret `GITHUB_TOKEN` terpasang di deployment dan audit ulang di `T-W4-04`.
