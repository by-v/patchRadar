# Gate Minggu 3 (T-W3-13)

**Tanggal evaluasi:** 15 November 2026  
**Ruang lingkup:** kesiapan offline, cloud, RLS, rate limit, dan penanganan error untuk masuk Minggu 4 (rilis).  
**Prasyarat (TASKS):** `T-W3-01` s.d. `T-W3-06`, `T-W3-07a` s.d. `T-W3-07c`, `T-W3-08`, `T-W1-13`, `T-W3-11` terpenuhi sesuai status/catatan tugas; `T-W3-12` (S) **ditunda/tidak dipertahankan** (Catatan Keputusan 15 Nov 2026) sehingga tidak menjadi syarat gate. `T-W3-14` (S) ditunda/tidak dikerjakan (lihat Addendum 20 November 2026 di bagian akhir).

> Catatan bukti: setiap klaim merujuk keluaran mentah/test/requestId/dokumen yang tersedia. Item tanpa bukti memadai ditandai **belum diverifikasi** dan tidak dicentang `[x]`.

## Ringkasan AC

| AC | Ringkasan | Status | Bukti utama |
|---:|---|---|---|
| 1 | Riwayat→Hasil→Detail berhasil dalam mode pesawat | **[x]** (attestasi manual pengembang) | Laporan manual pengembang (Android, 15 Nov 2026) |
| 2 | Dua pengguna anonim terisolasi | **[x]** | A3/Fase B: `scripts/rls-check.mjs`, `req_29bdf45c091b48d6a2a7ae4fa0f9cfa0`, SQL/pg_policies, `docs/rls-test.md` |
| 3 | Gerbang anonymous sign-in punya verdict Go/No-Go | **[x]** | Due diligence 15 Nov 2026 + bukti scan A2/A3; verdict pengembang: **Go** (§Verdict) |
| 4 | 23 kondisi error teruji tanpa crash | **[x]** (attestasi manual pengembang) | `docs/error-matrix.md`, test T-W3-07a/b/c + suite lulus; attestasi pengembang (Android, 15 Nov 2026): 23 kondisi diuji sesuai rencana tanpa crash (rincian per-kondisi/screenshot/keluaran mentah UI tidak dilampirkan); beberapa kondisi layanan nyata **belum diverifikasi** di lingkungan nyata |
| 5 | `persisted=false` dan warning tampil benar | **[x]** (attestasi manual, simulasi terkontrol) | Kontrak/test server OK; UI diverifikasi via simulasi terkontrol klien (Android realme XT, Expo Go, axios, 16 Nov 2026): banner "Riwayat cloud — Riwayat cloud gagal disimpan; hasil tetap tersedia di perangkat" tampil, hasil/temuan tetap tampil, tanpa crash (attestasi, tanpa screenshot; deskripsi spesifik hasil tidak dirinci) |
| 6 | Scan ke-6 menghasilkan 429 | **[x]** | A4 remote v8: ke-6 429 `RATE_LIMITED` `req_c937fcfcecfc45daaa768587dfca3822`, SQL `rate_limit_events` konsisten |
| 7 | p95 hangat & CPU dashboard diukur ulang; keputusan R-15/optimasi S dicatat | **[x]** | p95 hangat 15 Nov 2026 (p50 3084 ms, p95 4006 ms < 6 s, requestId tercatat); CPU/execution dashboard fungsi `scan` (Edge Functions > scan > Metrics, 24 jam terakhir per 16 Nov 2026): Avg Exec 3578 ms, Max 13762 ms, Avg CPU 70 ms, Max 179 ms, Avg Mem 9.2 MB; keputusan R-15/optimasi S dicatat |
| 8 | Verdict Go/No-Go tercatat | **[x]** | Verdict **Go (bersyarat)** tercatat di dokumen ini dengan sisa risiko |

## Bukti per AC

### AC 1 — Riwayat→Hasil→Detail berhasil dalam mode pesawat
- **Laporan manual pengembang (15 Nov 2026):** "Android — pindai repo — sesuai dengan rencana bisa masuk sampai detail temuan dan sudah ada di riwayat, saat dijalankan offline bagian Riwayat bisa diakses tanpa perlu menggunakan internet." Konfirmasi lanjutan: "ya saya menggunakan android dan bisa melakukan tersebut tanpa ada error" (alur **Riwayat → pilih item → Hasil → Detail** saat mode pesawat, tanpa crash).
- **Keterbatasan bukti:** model/perangkat/versi OS dan screenshot tidak dilampirkan. AC dicentang berdasarkan **attestasi eksplisit** pengembang; bukti visual **belum diverifikasi** secara independen.

### AC 2 — Dua pengguna anonim terisolasi
- **Bukti terverifikasi (remote v8, Fase A/B, 15 Nov 2026):** `docs/rls-test.md`, `docs/due-diligence-log.md`.
  - A3 (`scripts/rls-check.mjs`): scan A `req_29bdf45c091b48d6a2a7ae4fa0f9cfa0`, `scanId 14671da2-19a2-4bfa-aad7-c08a7a76d763`, HTTP 200, `persisted=true`, findings 2 (A `52c4d6dc`, B `77383519`).
  - A baca scans 1 & findings 2; B baca scans/findings/scan-A-by-id → 0; B insert(user_id A) 403 `42501`, B patch 403, B delete 403; A masih baca scan 1 & findings 2; anon scans/findings 401 `42501`; B/anon `osv_cache,kev_entries,epss_cache,rate_limit_events` → 403/401 `42501`; `leakDetected=false`.
  - SQL (disediakan/terkonfirmasi pengembang): scans 2, findings 4, events 7; 5 terbaru memuat `14671da2/52c4d6dc` & `aaf77259/21f91cd4`.
  - `pg_policies` (disediakan): `scans_select_own` SELECT authenticated USING `user_id=auth.uid()`, `findings_select_own_scan` SELECT authenticated USING EXISTS scan milik user, `with_check` null, tanpa `USING (true)`, semua tabel `rowsecurity=true`.
- **Risiko/syarat:** uji isolasi RLS **wajib diulang pada build rilis** (T-W4-04). RLS check ulang opsional tidak dijalankan pada penutupan gate ini.

### AC 3 — Gerbang anonymous sign-in punya verdict Go/No-Go
- **Bukti ketersediaan (15 Nov 2026, `docs/due-diligence-log.md`):** `GET /auth/v1/settings` menunjukkan `external.anonymous_users=true` (GoTrue allow-anonymous aktif). `POST /auth/v1/signup` anonim mengembalikan 200 dan `user.is_anonymous=true` (tanpa token dicatat). A2/A3 sukses dengan sesi anonim (bukti di AC 2/6).
- **Verdict:** **Go** (dinyatakan pengembang), dicatat sebagai **Go bersyarat** di §Verdict (syarat: uji ulang RLS pada build rilis T-W4-04 dan tindak lanjut item belum diverifikasi).

### AC 4 — 23 kondisi error teruji tanpa crash
- **Sumber konsolidasi:** `docs/error-matrix.md` (23 kondisi, Kelompok A 1–10, B 11–16/20, C 17–19/21–23) dengan rujukan test & status per T-W3-07a/b/c.
- **Bukti otomatis (keluaran mentah ringkas, 15 Nov 2026):**
  - Edge: `node --test "supabase/functions/scan/**/*.test.ts"` → `tests 196, pass 196, fail 0, duration_ms 2462.4617, scan_exit=0`.
  - App (`app/`): `npm run lint` exit 0, `npm run typecheck` exit 0, `npm test -- --ci` → `Test Suites: 14 passed, Tests: 121 passed, fail 0, test=0`.
- **Attestasi manual pengembang (15 Nov 2026, Android, disetujui untuk penutupan AC 4):** pengembang menyatakan 23 kondisi error telah diuji dan hasilnya sesuai rencana tanpa crash (termasuk skenario scan offline yang menampilkan pesan gagal dan tombol buka Riwayat tanpa crash). **Rincian per-kondisi, screenshot, dan keluaran mentah UI tidak dilampirkan**; klaim manual dicatat sebagai attestasi.
- **Keterbatasan:** beberapa kondisi bergantung layanan nyata tetap **belum diverifikasi** di lingkungan nyata (sesuai catatan `error-matrix.md`, mis. 429 GitHub/OSV/EPSS real, auth rate limit nyata, edge runtime error nyata), namun tertutup oleh uji handler/tiruan pada suite yang lulus. AC dicentang berdasarkan kombinasi attestasi manual + bukti otomatis/matriks dengan keterbatasan di atas.

### AC 5 — `persisted=false` dan warning tampil benar
- **Bukti kontrak/server (ada):** unit/integrasi test persist/handler/composition menunjukkan kegagalan simpan cloud → respons 200 dengan `persisted=false`, warning `CLOUD_PERSIST_FAILED`, hasil/temuan tidak berubah (rujuk test T-W3-07c/handler/persist). Kontras sukses: A2 `req_e0e3d447cccd4f57841b635ec2dbf375` dan A3 `req_29bdf45c091b48d6a2a7ae4fa0f9cfa0` (`persisted=true`, warningCodes kosong).
- **Bukti UI (attestasi manual, simulasi terkontrol, 16 Nov 2026):** Android realme XT, Expo Go, repo `https://github.com/axios/axios`. Metode: respons scan dimodifikasi sementara di klien (`app/src/api/scan.ts`) agar `persisted=false` dan menambah warning `CLOUD_PERSIST_FAILED` (simulasi terkontrol, bukan kegagalan DB produksi). Pengembang melaporkan: banner "Riwayat cloud — Riwayat cloud gagal disimpan; hasil tetap tersedia di perangkat" tampil: **ya**; hasil/temuan tetap tampil: **ya** (deskripsi spesifik tampilan hasil tidak dirinci); tanpa crash: **ya**. **Bukti visual/screenshot tidak dilampirkan** (attestasi pengujian nyata).
- **Catatan:** laporan sebelumnya tentang `ERROR [Error: Cannot find native module 'ExpoSQLite']` adalah kegagalan modul native lokal terpisah, bukan bukti jalur `CLOUD_PERSIST_FAILED` (tetap dicatat terpisah sebagai isu lingkungan, bukan penentu AC 5). `app/src/api/scan.ts` diperiksa pada 16 Nov 2026: tidak ditemukan marker mock sementara (dikembalikan seperti semula). AC dicentang berdasarkan kombinasi kontrak/test server + attestasi UI terkontrol dengan keterbatasan bukti di atas.

### AC 6 — Scan ke-6 menghasilkan 429
- **Bukti terverifikasi (A4, remote v8, 15 Nov 2026):** anon C `041ed725`, repo tak ada. `scan_C_1..5` → 404 `REPO_NOT_FOUND_OR_PRIVATE` (req `cdfbecf2..,9e11d95a..,e5f50ffe..,cb545f75..,9ac82220..` sesuai `docs/rls-test.md`), `scan_C_6` → **429 `RATE_LIMITED`** `req_c937fcfcecfc45daaa768587dfca3822`. Respons 404 terhitung kuota (sesuai temuan A4). SQL agregat: `rate_limit_events` events 7 konsisten (A2+A3+5, Q6 di `docs/metrics.md`).
- **Sisa terbuka (di luar syarat AC ini, dicatat):** nilai `retryAfter` tidak tertangkap mentah pada A4; "diterima setelah jendela berlalu" belum diuji (AC terbuka T-W3-06, tindak lanjut T-W4-04).

### AC 7 — p95 hangat dan CPU dashboard diukur ulang; keputusan R-15/optimasi S dicatat
- **p95 hangat (terukur, 15 Nov 2026, dengan izin pengembang; pemanggilan remote, menulis data):** repo `https://github.com/axios/axios`, akun anonim uji `userId8 c2e3ee2c`.
  - Warmup: HTTP 200, `req_a4f6f1d897f443a18f1f9014c33d1d81`, `scanId 6bbb20ec-2378-481f-b569-9811f5203efc`, `persisted=true`, `partial=false`, `totalMs=5713`, `sourceStatus {github:OK, osv:CACHE, kev:CACHE, epss:CACHE}`.
  - Warm 1: HTTP 200, `req_22ad076a2d314edea401c79fd69bf896`, `scanId 4f52e313-f841-4f7b-a3b0-2e77331c0243`, `totalMs=3440`, `persisted=true`.
  - Warm 2: HTTP 200, `req_a9c8709547ee488f993878b3153f1c5b`, `scanId b096d237-6614-495d-ae7c-b8fff6239f9e`, `totalMs=4006`, `persisted=true`.
  - Warm 3: HTTP 200, `req_88a9e6de716d4a7c904751d60bcdc4c7`, `scanId d36b15c1-a53b-482b-a086-56375cff55ba`, `totalMs=3084`, `persisted=true`.
  - Warm 4: HTTP 200, `req_c655d6c1c68b4ae9b45aee1ec63ed327`, `scanId 2ad1d924-5232-4c1e-9364-d787db86b1b8`, `totalMs=2919`, `persisted=true`.
  - Warm 5 (masih dalam sesi/jendela sama): HTTP 429 `RATE_LIMITED`, `req_bb74e537dd214eda835ba31aa6e6a9e6`, `errorCode RATE_LIMITED`.
  - Ringkasan warm sukses (n=4): `totalsMs [2919,3084,3440,4006]`, **p50 3084 ms, p95 4006 ms** (< 6.000 ms). Sumber cache hangat terlihat (OSV/KEV/EPSS CACHE).
- **CPU/execution dashboard `scan` (dilaporkan pengembang, 16 Nov 2026):** sumber **Edge Functions > scan > Metrics**, rentang **24 jam terakhir (per 16 Nov 2026)**. Data: **Average Execution Time 3.578 ms**, **Max Execution Time 13.762 ms**, **Average CPU Time 70 ms**, **Max CPU Time 179 ms**, **Average Memory Usage 9,2 MB** (Heap 73,8%, External 26,2%). (Screenshot/bukti visual mentah tidak dilampirkan; nilai dicatat sesuai laporan pengembang.)
- **Keputusan R-15 / optimasi S:** **Tidak mengaktifkan** mitigasi R-15 dan **tidak mengambil** optimasi S yang ditunda saat ini (T-W3-12, T-W3-14 tetap ditunda). **Alasan:** p95 hangat 4.006 ms (< 6 s) tidak memicu ambang; CPU time avg 70 ms / max 179 ms jauh di bawah ~1.400 ms. Average execution time 3.578 ms konsisten di bawah ambang hangat; max execution time 13.762 ms tercatat sebagai observasi (invokasi lambat/cold/variasi) tanpa memicu kriteria gate yang ditetapkan.

### AC 8 — Verdict Go/No-Go tercatat
- Lihat §Verdict.

## Sisa risiko dan tindak lanjut

| Item | Status | Dampak / tindak lanjut |
|---|---|---|
| Bukti visual perangkat (AC 1/4/5) | Attestasi tanpa screenshot | AC 1/4/5 `[x]` berdasarkan attestasi (dan kontrak/test/simulasi terkontrol untuk AC 5); tidak ada screenshot mentah UI. |
| AC 4 kondisi layanan nyata | Belum diverifikasi di lingkungan nyata (sebagian) | 23 kondisi terpetakan & teruji di suite; beberapa kondisi bergantung layanan nyata tetap **belum diverifikasi** (tertutup uji handler/tiruan). |
| T-W3-06 `retryAfter` & scan diterima setelah jendela | Belum terverifikasi mentah | 429 terbukti (AC 6); sisa dibuktikan di **T-W4-04**. |
| Uji ulang RLS pada build rilis | Wajib | **T-W4-04**. |
| AC 7 metrik dashboard tanpa screenshot | Nilai dilaporkan (teks) | CPU/execution dicatat sesuai laporan (Edge Functions > scan > Metrics, 24 jam per 16 Nov 2026); screenshot mentah dashboard tidak dilampirkan. |
| T-W3-12, T-W3-14 (S) | Ditunda/tidak dikerjakan | Tidak memblokir gate; keputusan saat ini: tidak diaktifkan (R-15 tidak dipicu). |

## Verdict

**Verdict: Go (bersyarat)** — dinyatakan pengembang ("Go") dan dicatat dengan syarat.

**Dasar:** AC 1 (attestasi), AC 2 (RLS terisolasi terbukti remote v8), AC 3 (anonymous sign-in aktif & dipakai), AC 4 (attestasi pengembang + matriks/suite test lulus), AC 5 (kontrak/test server + attestasi UI simulasi terkontrol), AC 6 (429 scan ke-6 terbukti), AC 7 (p95 hangat 4006 ms < 6 s; CPU/execution dashboard `scan` 24 jam per 16 Nov 2026: Avg Exec 3578 ms, Max 13762 ms, Avg CPU 70 ms, Max 179 ms; keputusan R-15/optimasi S dicatat — tidak diaktifkan), dan AC 8 lulus dengan bukti/keterangan yang tersedia.

**Syarat/keharusan tindak lanjut:** (1) uji ulang isolasi RLS pada build rilis (**T-W4-04**) termasuk pembuktian sisa T-W3-06 (`retryAfter`, pasca-jendela) sebagaimana direncanakan; (2) pertahankan sikap jujur "belum diverifikasi"/keterbatasan bukti untuk item tanpa bukti mentah (attestasi tanpa screenshot, kondisi layanan nyata tertentu, metrik dashboard tanpa screenshot).

**Keputusan masuk Minggu 4:** **Go bersyarat** — pekerjaan Minggu 4 dapat dimulai. T-W3-13 ditandai selesai (`[x]`) di TASKS karena AC 1–8 terpenuhi sesuai bukti/keterangan yang tersedia, dengan sisa risiko tindak lanjut di atas (terutama T-W4-04).

## Addendum — 20 November 2026

> Verdict 15 November 2026 di atas **tidak diubah** dan tetap berlaku sebagai catatan historis gate. Addendum ini hanya mencatat status per 20 November 2026 agar tidak ada klaim yang usang.

| Item yang dulu terbuka/ditunda | Status 20 November 2026 | Bukti |
|---|---|---|
| `T-W3-06` `retryAfter` & scan diterima setelah jendela | **Tertutup** | `T-W4-04`: 429 `retryAfter` **582** (header + body) `req_fc2b0fdf2d3d42a0b4c02602a05cffee`; scan 200 `req_79eab983ef5e402e8e6225ebcfa074e6` `totalMs` 5080 setelah tunggu 610 detik. Lihat `TASKS.md` `T-W3-06`. |
| `T-W3-14` (S) ditunda/tidak dikerjakan | **Diaktifkan kembali dan selesai**, commit `ed69073` | `handler.ts` membungkus `rate_limit`, `persist`, dan `retention` dengan `timed`; deploy `scan` v11 `updated_at` 2026-11-20 12:44:01 UTC; sumber deployed 30/30 SAME. Stage di dashboard **belum dibaca langsung** (dicatat "belum diverifikasi"). |
| `T-W3-09`/`T-W3-10` (S) | **Sudah dideploy** (`scan` v11) | Migrasi `20261119000000` remote; secrets `IP_HASH_SALT` + `RETENTION_DAYS=90`; uji live FR-25b 429 `req_f81e119e34ed48a2bdc1941d1a3f06d9` `retryAfter` 3546. Lihat `TASKS.md` `T-W3-09`/`T-W3-10`. |
| `T-W3-12` (S) tema gelap | **Tetap ditunda/dipotong** | Catatan Keputusan 15 November 2026; tidak memblokir MVP. |
| Uji ulang RLS pada build rilis | **Tertutup** di `T-W4-04` | `TASKS.md` `T-W4-04` (build rilis `scan` v9/versi berikutnya). |

Catatan: AC 7 (p95 hangat dan CPU dashboard) tetap merujuk pada pengukuran 15–16 November 2026; tidak ada pengukuran ulang pada addendum ini.
