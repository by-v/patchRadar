# Smoke Test APK — `T-W4-03`

Bukti uji untuk tugas `[MANUAL]` "Smoke test APK di perangkat". Status keseluruhan: **sebagian**; AC performa perangkat masih terbuka (lihat bagian Keterbatasan).

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

Catatan: `requestId` pada layar sukses tidak ditampilkan aplikasi dan tidak disimpan, sehingga bukti performa di bawah memakai `requestId` dari respons API.

## Performa p95 — pengukuran API (bukan perangkat)

Alasan: pengukuran tap→Hasil di perangkat belum dapat dilakukan otomatis (tidak ada akses `adb` ke perangkat saat pengukuran). Angka di bawah adalah **latensi panggilan HTTPS** ke Edge Function `scan` dari PC, bukan waktu tap sampai Hasil tampil di HP.

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

- p95 3690 ms **di bawah** target 15.000 ms untuk beban ≤500 paket, tetapi angka ini **bukan** ukuran "tap Pindai → Hasil terisi" di perangkat dan bukan fixture 500 paket.
- Karena itu AC `p95 waktu ke hasil pada fixture 500 paket ≤ 15 detik` **belum dicentang**.

## Yang masih diperlukan untuk menutup AC

1. Repo demo publik berisi `fixtures/lockfiles/medium-500/` (`package.json` + `package-lock.json`, 491 paket unik).
2. Pengukuran **di perangkat**: rekam layar 60 fps, 5× tap **Mulai pemindaian** → layar "Hasil pemindaian" tampil; hitung selisih frame; hitung p95.
3. Catat `requestId` tiap run dari dashboard **Edge Functions → scan → Logs** (layar sukses tidak menampilkannya).
4. Bila p95 perangkat > 15.000 ms: catat penyimpangan (jaringan, cold start, perangkat) dan tindakan yang diambil.

## Catatan kuota

Total panggilan pengukuran: 1 warm-up + 5 sampel + 1 konfirmasi paket = 7 scan, memakai 3 sesi anonim (A, B, C). Tidak ada 429 selama pengukuran. Token/anon key tidak dicetak ke log.
