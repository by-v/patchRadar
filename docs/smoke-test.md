# Smoke Test APK — `T-W4-03`

Bukti uji untuk tugas `[MANUAL]` "Smoke test APK di perangkat". Status: **selesai dengan penyimpangan tercatat** — p95 perangkat 5.621 ms (target ≤15.000 ms), diukur pada repo publik 453 paket (bukan fixture 491) dan memakai durasi server, bukan stopwatch tap→render. Rincian penyimpangan di bagian "Penyimpangan dan tindakan".

## Perangkat dan build

| Item | Nilai | Sumber |
|---|---|---|
| Perangkat | Realme XT | laporan pengembang |
| Android | 8 | laporan pengembang |
| Versi APK | 1.0.0 | laporan pengembang |
| Paket aplikasi | `com.codebyv.patchradar` | `app/app.json` |
| Edge Function | `scan` v9 (`UPDATED_AT` 2026-11-17 13:58:25 UTC) | `functions list` |

## Bukti UI di perangkat

| Langkah | Hasil | Bukti |
|---|---|---|
| Pindai repo privat `by-v/venue-booking-system` | Layar "Pemindaian gagal", `Kode: req_0fb7577d0d864245aece0e417178bec` (dilaporkan 31 karakter; format server 32), card merah "Repositori ini privat atau tidak dapat diakses. PatchRadar hanya memindai repositori publik.", tombol **Coba lagi** dan **kembali** | laporan pengembang 17 Nov 2026; rincian di `TASKS.md` `T-W4-09` dan `docs/due-diligence-log.md` |
| Alur utama dan mode pesawat | Ditandai lulus oleh pengembang (attestasi) | `TASKS.md` `T-W4-03` |

Catatan: `requestId` pada layar sukses tidak ditampilkan aplikasi dan tidak disimpan, sehingga `requestId` diambil dari log Edge Function di dashboard dan dicocokkan dengan waktu tap.

## Performa p95 — pengukuran perangkat (17 November 2026)

Pengukuran dilakukan pada APK rilis di perangkat, bukan lewat API dari PC. Tanggal 17 November 2026, pukul 21:59–22:04 WIB (14:59–15:04 UTC).

- Repo uji: `https://github.com/stylelint/stylelint` — `manifest.source=LOCKFILE`, `lockfileFormat=v3`, **453 paket unik**, tanpa warning. Repo publik nyata, bukan fixture `medium-500` (491 paket).
- Perangkat: Realme XT, Android 8, APK **1.0.0**.
- Sesi: 1 sesi anonim perangkat (bukan sesi API agent). Cache OSV/KEV/EPSS sudah dihangatkan oleh panggilan pemanas `req_28dc103ab768485f959faedaec4d2964` (21:56:38 WIB), yang **tidak** dihitung sebagai sampel.
- Metode: 5 kali tap **Mulai pemindaian** pada URL yang sama sampai layar "Hasil pemindaian" terisi (tampil "453 paket diperiksa"). Durasi diambil dari `timings.totalMs` pada log Edge Function dan dicocokkan dengan kolom `scans.duration_ms` (selisih konsisten 242–252 ms karena titik ukur berbeda).
- p95 dihitung *nearest-rank*: `ceil(0,95 × 5) = 5` → nilai terbesar dari 5 sampel.

### Hasil

| # | Waktu lokal (WIB) | Waktu UTC | `requestId` | `timings.totalMs` (ms) | `scans.duration_ms` (ms) |
|---:|---|---|---|---:|---:|
| 1 | 21:59:54 | 14:59:53 | `req_c328959c63594e9b859c0afff428b21f` | 5621 | 5354 |
| 2 | 22:03:19 | 15:03:19 | `req_52e2fbefab944fe1a2d3605612b91ed1` | 4358 | 4112 |
| 3 | 22:03:27 | 15:03:27 | `req_87a38107d9d14b2a93d04bc9361dbb24` | 2954 | 2707 |
| 4 | 22:03:35 | 15:03:34 | `req_c5d450c07ccc4ad59a36e9ae84b4cc75` | 4105 | 3853 |
| 5 | 22:03:40 | 15:03:40 | `req_b3c0eeb39b95482aa19828382fe65c14` | 3313 | 3071 |

Ringkasan:

- `totalMs` urut naik `[2954, 3313, 4105, 4358, 5621]` → median 4105 ms, **p95 = 5621 ms**.
- `duration_ms` urut naik `[2707, 3071, 3853, 4112, 5354]` → median 3853 ms, **p95 = 5354 ms**.
- Run 1 paling lambat karena `kev.catalog.load` 1426,709 ms (`req_c328…`); run 2–5 memuat katalog yang sama dalam 459–532 ms.
- Pengamatan pengembang di layar: hasil muncul dalam **2–3 detik** pada run cepat. Angka 2–3 detik ini adalah pengamatan, bukan stopwatch terinstrumentasi, sehingga tidak dipakai sebagai dasar p95.
- Semua run: `sourceStatus` = `osv CACHE`, `kev CACHE`, `epss CACHE`; hasil 453 paket konsisten di UI dan di log.

### Bukti rate limit (tambahan, di luar sampel)

Percobaan ke-6 pada 22:03:43 WIB (3 detik setelah run 5) ditolak:

```
{"requestId":"req_44df351c7d304de5b41e586b89668701","owner":"stylelint","repo":"stylelint","status":429,
 "githubMs":0,"parseMs":0,"registryMs":0,"osvMs":0,"kevMs":0,"epssMs":0,"findingsMs":0,"labelMs":0,"syncMs":0,
 "totalMs":144,"sourceStatus":{"osv":null,"kev":null,"epss":null},"stages":[]}
```

Ini bukti tambahan FR-25a di perangkat (5 scan berhasil, ke-6 ditolak). `retryAfter` tidak tertangkap pada uji ini sehingga masih **belum diverifikasi** untuk `T-W4-04`.

## Performa p95 — pengukuran API (bukti pendukung, bukan perangkat)

Angka di bawah adalah **latensi panggilan HTTPS** ke Edge Function `scan` dari PC, bukan waktu tap sampai Hasil tampil di HP. Pengukuran ini dilakukan 17 November 2026 sebelum sesi perangkat tersedia, dan dipertahankan sebagai pembanding lintas repo.

- Tanggal: 17 November 2026.
- Repo uji: `https://github.com/koajs/koa` — `manifest.source=LOCKFILE`, `lockfileFormat=v3`, **363 paket unik** (`summary.totalPackages`). Ini **bukan** fixture 491 paket (`medium-500`) yang disebut AC.
- Metode: 1 warm-up dengan sesi anonim A, lalu 5 sampel dengan sesi anonim B (sesi terpisah agar kuota 5 scan/10 menit tidak terpicu). Waktu diukur dengan `performance.now()` di sekitar `fetch` (`wall`), ditambah `timings.totalMs` dari server.
- p95 dihitung *nearest-rank*: `ceil(0,95 × 5) = 5` → nilai terbesar dari 5 sampel.

### Hasil

| Run | `requestId` | Wall (ms) | `timings.totalMs` (ms) | `sourceStatus` |
|---|---|---:|---:|---|
| Warm-up | `req_6c08de9a986c4558849df04dd84ba3db` | 9517 | 9326 | github OK, osv OK, kev CACHE, epss OK |
| 1 | `req_065de6f83df64d4f989920c337b4f73e` | 3690 | 3254 | github OK, osv CACHE, kev CACHE, epss CACHE |
| 2 | `req_cd101df55d1348c8832b0c80ff771574` | 2872 | 2689 | github OK, osv CACHE, kev CACHE, epss CACHE |
| 3 | `req_f739962f5a0445d79928448dfc87ade4` | 2767 | 2619 | github OK, osv CACHE, kev CACHE, epss CACHE |
| 4 | `req_a093980019c5480197a954ca795f0c12` | 2962 | 2854 | github OK, osv CACHE, kev CACHE, epss CACHE |
| 5 | `req_8309421201b54357b614eceb551b5230` | 2791 | 2720 | github OK, osv CACHE, kev CACHE, epss CACHE |
| Konfirmasi paket (di luar sampel) | `req_75f327a986214c52b0b0b7b50197477f` | — | 4857 | 363 paket, LOCKFILE v3 |

Ringkasan 5 sampel:

- Wall: `[3690, 2872, 2767, 2962, 2791]` → median 2872 ms, **p95 3690 ms**.
- Server `totalMs`: `[3254, 2689, 2619, 2854, 2720]` → median 2720 ms, **p95 3254 ms**.
- Warm-up (dingin relatif): 9517 ms wall / 9326 ms server; `osv=OK` menandakan cache OSV belum hangat pada run itu.

### Tafsiran

- p95 3690 ms **di bawah** target 15.000 ms untuk beban ≤500 paket, tetapi angka ini **bukan** ukuran "tap Pindai → Hasil terisi" di perangkat dan bukan fixture 500 paket. Nilai ini dipakai hanya sebagai bukti pendukung lintas repo (363 paket) di samping pengukuran perangkat pada 453 paket.

## Penyimpangan dan tindakan

AC `p95 waktu ke hasil pada fixture 500 paket ≤ 15 detik, atau penyimpangan dicatat beserta tindakan` dipenuhi lewat jalur penyimpangan:

1. **Cakupan repo.** AC menyebut fixture ±500 paket (`medium-500`, 491 paket unik). Pengukuran perangkat memakai repo publik nyata `stylelint/stylelint` dengan **453 paket unik** (−38, −7,7%), masih di bawah ambang banner "Repositori besar" (500).
   - **Alasan:** tidak ada repositori publik yang menyediakan fixture 491 paket; membuat repo demo baru di luar lingkup pekerjaan agent (tidak ada kredensial GitHub).
   - **Tindakan:** jumlah paket dicatat apa adanya, hasil UI diverifikasi menampilkan "453 paket diperiksa", dan pengukuran API pendukung pada 363 paket (`koajs/koa`) tetap dilampirkan.
2. **Metode ukur.** Waktu diambil dari durasi server (`timings.totalMs` log Edge Function, dicocokkan dengan `scans.duration_ms`), bukan stopwatch/frame tap→render.
   - **Alasan:** pengukuran frame-perfect memerlukan rekaman 60 fps dan perkakas tambahan; pengamatan pengembang menunjukkan hasil muncul 2–3 detik.
   - **Tindakan:** dipakai angka server yang paling konservatif (`totalMs`, p95 5621 ms) sebagai batas bawah waktu nyata; margin terhadap ambang 15.000 ms masih 9.379 ms untuk jaringan + render.

Kedua penyimpangan tidak mengubah hasil keputusan: **p95 5621 ms ≤ 15.000 ms**.

## Sisa yang belum diverifikasi

1. `retryAfter` pada respons 429 perangkat tidak tertangkap (hanya status 429 + `requestId`); relevan untuk `T-W4-04`.
2. Waktu tap→render di perangkat hanya diamati (2–3 detik pada run cepat), tidak diinstrumentasi dengan stopwatch/frame counter.

## Catatan kuota

Pengukuran perangkat: 5 scan berhasil + 1 percobaan ke-6 yang ditolak 429 (kuota 5 scan/10 menit), seluruhnya dalam satu sesi anonim perangkat. Pengukuran API pendukung: 1 warm-up + 5 sampel + 1 konfirmasi paket = 7 scan pada 3 sesi anonim (A, B, C). Token/anon key tidak dicetak ke log.

