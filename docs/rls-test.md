# Uji Isolasi RLS — Hasil Terverifikasi (Fase A, 15 November 2026)

Laporan 15 November 2026 pukul 14:10 UTC sebelumnya dinyatakan **keliru** (tanpa bukti remote valid; `persisted=false`, `scans/findings/rate_limit_events` 0 pada pengamatan saat itu, requestId `req_ee37185154ac4383bd1767091ab3b902`). Dokumen ini menggantikan isi sebelumnya dengan bukti mentah Fase A setelah deploy `scan` v8.

## Prasyarat deploy (A0–A1)

- Working tree bersih, HEAD: `bf95432367c7bfdf44254c07520f497a0c70f4b8` (`bf95432 T-W3-0x: sambungkan komposisi produksi dan test penyambungan`), branch `main` ahead `origin/main` by 14 (tidak di-push). Tidak ada perubahan `TASKS.md` tak terkait.

Raw `npx supabase functions deploy scan --use-api --yes` (ringkasan): sukses deploy ke project `patchRadar (umldsfkvifqoqfbouhca)` production, upload asset scan termasuk `composition.ts`, dashboard functions URL dilaporkan. `exit=0`.

Raw `npx supabase functions list` (sebelum deploy ulang Fase A): versi 7, `updated_at` 1794752913378, `verify_jwt` true, `ezbr_sha256` `5d865a8c28190ea9be236b6906aa0d7e587c8c6416ef9d61596c5809c5db6e46`.
Raw `npx supabase functions list` (sesudah deploy Fase A): versi 8 (naik dari 6), `updated_at` 1794753073345 (baru), `verify_jwt` true, `ezbr_sha256` sama (`5d865a8c...`), status ACTIVE.

Raw perbandingan SHA-256 sumber deployed (download `--use-api`) vs lokal: **ALL_SAME** untuk seluruh berkas bundel (termasuk `.gitkeep`, `composition.ts`, `composition.test.ts`, `errors.ts`, `handler.ts`, `index.ts`, `store.ts`, `supabase-store.ts`, `rate-limit.ts`, `persist.ts`, `epss.ts`, `github.ts`, `lib/*`, test, dsb.). Direktori lokal dipulihkan; `git status --short -- supabase/functions/scan` bersih.

**A1(c) Tahap (nama string `timed(...)`/stages) di kode `handler.ts`:** `registry.resolve`, `manifest.parse.resolved`, `github.metadata`, `github.packageJson`, `github.lockfile`, `manifest.parse`, `response.build`, `response.serialize`. Log handler memuat `stages` (array `{name, async, ms}`) dari timings. **Belum diverifikasi sebagai tahap bernama eksplisit:** `rate-limit.ts`/`enforceRateLimit` dan `persist.ts`/`persistScanResult` tidak dibungkus `timed(...)` dan tidak menambahkan nama stage khusus; pencatatan rate limit/persist perlu dicocokkan lewat field log/efek (`persisted`, warning `CLOUD_PERSIST_FAILED`, perilaku 429 `RATE_LIMITED`) dan/atau log platform untuk requestId terkait (belum diverifikasi tanpa log dashboard).

## Smoke test (A2)

Repo: `https://github.com/axios/axios` (pengguna anonim baru). Keluaran mentah:

```json
{
  "step": "scan_a_smoke",
  "repo": "https://github.com/axios/axios",
  "userId8": "21f91cd4",
  "status": 200,
  "requestId": "req_e0e3d447cccd4f57841b635ec2dbf375",
  "scanId": "aaf77259-7d96-4c22-8069-ae6729915e76",
  "persisted": true,
  "warningCodes": [],
  "findingCount": 2,
  "timings": {
    "githubMs": 1232,
    "osvMs": 7953,
    "enrichmentMs": 1666,
    "totalMs": 12358
  },
  "errorCode": null,
  "errorMessage": null,
  "partial": false
}
```

`persisted=true`, tidak ada `CLOUD_PERSIST_FAILED`/`SERVER_MISCONFIGURED`/`UNAUTHENTICATED`, `findingCount>=1`.

## Uji RLS (A3, `scripts/rls-check.mjs`, tanpa kunci/token; userId 8 char)

Scan A: `https://github.com/axios/axios`, `requestId=req_29bdf45c091b48d6a2a7ae4fa0f9cfa0`, `scanId=14671da2-19a2-4bfa-aad7-c08a7a76d763`, `persisted=true`, findings 2, warningCodes `[]`. A baca `scans>=1` dan `findings>=1`. Tidak ada kebocoran terdeteksi.

Keluaran mentah:

```json
{"label":"signup_A","http":200,"rows":null,"requestId":null,"userId8":"52c4d6dc"}
{"label":"signup_B","http":200,"rows":null,"requestId":null,"userId8":"77383519"}
{"label":"users_berbeda","http":200,"rows":null,"requestId":null,"userA8":"52c4d6dc","userB8":"77383519","berbeda":true}
{"label":"scan_A","http":200,"rows":2,"requestId":"req_29bdf45c091b48d6a2a7ae4fa0f9cfa0","scanId":"14671da2-19a2-4bfa-aad7-c08a7a76d763","persisted":true,"warningCodes":[]}
{"label":"A_baca_scans","http":200,"rows":1,"requestId":null}
{"label":"A_baca_findings_scan_A","http":200,"rows":2,"requestId":null}
{"label":"A_baca_scan_A_by_id","http":200,"rows":1,"requestId":null}
{"label":"validitas_scan_A","http":null,"rows":null,"requestId":"req_29bdf45c091b48d6a2a7ae4fa0f9cfa0","valid":true}
{"label":"B_baca_scans","http":200,"rows":0,"requestId":null}
{"label":"B_baca_findings_scan_A","http":200,"rows":0,"requestId":null}
{"label":"B_baca_scan_A_by_id","http":200,"rows":0,"requestId":null}
{"label":"B_insert_scans_user_id_A","http":403,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"B_patch_scan_A","http":403,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"B_delete_scan_A","http":403,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"A_baca_scan_A_setelah_B","http":200,"rows":1,"requestId":null}
{"label":"A_baca_findings_scan_A_setelah_B","http":200,"rows":2,"requestId":null}
{"label":"anon_baca_scans","http":401,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"anon_baca_findings","http":401,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"B_baca_osv_cache","http":403,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"anon_baca_osv_cache","http":401,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"B_baca_kev_entries","http":403,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"anon_baca_kev_entries","http":401,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"B_baca_epss_cache","http":403,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"anon_baca_epss_cache","http":401,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"B_baca_rate_limit_events","http":403,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"anon_baca_rate_limit_events","http":401,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"selesai","http":200,"rows":null,"requestId":"req_29bdf45c091b48d6a2a7ae4fa0f9cfa0","scanId":"14671da2-19a2-4bfa-aad7-c08a7a76d763","userA8":"52c4d6dc","userB8":"77383519","leakDetected":false,"dataUjiDibiarkan":true}
```

## Uji pembatas laju (A4, FR-25a)

Pengguna anonim baru C, repo tidak ada `https://github.com/patchradar-uji-tidak-ada-xyz/repo-tidak-ada-12345`, 6 panggilan berurutan. Keluaran mentah:

```json
{"label":"signup_C","http":200,"userId8":"041ed725"}
{"label":"scan_C_1","http":404,"requestId":"req_cdfbecf206984623b02a180c9ae91b39","errorCode":"REPO_NOT_FOUND_OR_PRIVATE","persisted":null}
{"label":"scan_C_2","http":404,"requestId":"req_9e11d95afab54d88ad63efa9339dbe8f","errorCode":"REPO_NOT_FOUND_OR_PRIVATE","persisted":null}
{"label":"scan_C_3","http":404,"requestId":"req_e5f50ffe43eb4a9c96ab1466f9749606","errorCode":"REPO_NOT_FOUND_OR_PRIVATE","persisted":null}
{"label":"scan_C_4","http":404,"requestId":"req_cb545f750dbd4f30a67e026a4ae11dd5","errorCode":"REPO_NOT_FOUND_OR_PRIVATE","persisted":null}
{"label":"scan_C_5","http":404,"requestId":"req_9ac8222017464ee3ba54e91359af4a78","errorCode":"REPO_NOT_FOUND_OR_PRIVATE","persisted":null}
{"label":"scan_C_6","http":429,"requestId":"req_c937fcfcecfc45daaa768587dfca3822","errorCode":"RATE_LIMITED","persisted":null}
```

Panggilan ke-6: `429 RATE_LIMITED` (sesuai harapan FR-25a). Panggilan 1–5 berstatus 404 `REPO_NOT_FOUND_OR_PRIVATE` dan tetap dihitung terhadap kuota (teramati dari terpicunya 429 pada ke-6).

## Kebijakan RLS (dari remote, disediakan pengembang; belum diverifikasi ulang oleh query SQL di Fase A ini)

- `scans_select_own`: SELECT, `authenticated`, USING `user_id = auth.uid()`
- `findings_select_own_scan`: SELECT, `authenticated`, USING `EXISTS (SELECT 1 FROM scans s WHERE s.id = findings.scan_id AND s.user_id = auth.uid())`
- `with_check`: null; tidak ada `USING (true)`.
- Semua tabel terkait: `rowsecurity=true`.

Uji isolasi RLS di atas dijalankan terhadap remote pasca-deploy v8 dengan skenario A/B/anon; **uji RLS harus diulang pada build rilis di T-W4-04**.

## Status

Fase A (A1–A4) menghasilkan bukti bahwa persistensi cloud dan pembatas laju berfungsi pada remote v8 (scan A2/A3 `persisted=true`, findings tersimpan dan terbaca oleh pemilik, A4 ke-6 429). Verifikasi SQL baca-saja dan log dashboard untuk requestId scan A **menunggu jawaban pengembang** (Fase B).

## Uji ulang pada build rilis — T-W4-04 (17 November 2026)

Prasyarat `T-W4-02` terpenuhi: APK release candidate `439654c8-b781-42d4-a612-a047912b502b` (`release`, environment `production`, APK `D:\builds\patchradar-release-vc2.apk`, SHA-256 `DE535690DACA9D15F77539F3039F17872AE3DAF6E874580C2F81C55CDAB3088D`). APK ini memakai proyek Supabase produksi yang sama (`umldsfkvifqoqfbouhca`, Edge Function `scan` v9), sehingga uji isolasi dijalankan ulang terhadap backend yang dipakai build rilis tersebut. Penegasan: RLS ditegakkan di server (Postgres/PostgREST), bukan di dalam APK; build rilis tidak dapat mengubah kebijakan. Bukti di bawah membuktikan backend yang dipakai APK rilis masih menolak akses lintas pengguna.

Perintah (tanpa kunci/token di keluaran):

```powershell
node --env-file=app/.env scripts/rls-check.mjs
```

Keluaran mentah, 17 November 2026 (sesi A `e73735b6`, sesi B `827eff13`):

```json
{"label":"signup_A","http":200,"rows":null,"requestId":null,"userId8":"e73735b6"}
{"label":"signup_B","http":200,"rows":null,"requestId":null,"userId8":"827eff13"}
{"label":"users_berbeda","http":200,"rows":null,"requestId":null,"userA8":"e73735b6","userB8":"827eff13","berbeda":true}
{"label":"scan_A","http":200,"rows":1,"requestId":"req_18c5fa5d01f6460e9838c0b5bb824265","scanId":"3e9b3346-ac0b-40b8-aeae-8fb495247a88","persisted":true,"warningCodes":[]}
{"label":"A_baca_scans","http":200,"rows":1,"requestId":null}
{"label":"A_baca_findings_scan_A","http":200,"rows":1,"requestId":null}
{"label":"A_baca_scan_A_by_id","http":200,"rows":1,"requestId":null}
{"label":"validitas_scan_A","http":null,"rows":null,"requestId":"req_18c5fa5d01f6460e9838c0b5bb824265","valid":true}
{"label":"B_baca_scans","http":200,"rows":0,"requestId":null}
{"label":"B_baca_findings_scan_A","http":200,"rows":0,"requestId":null}
{"label":"B_baca_scan_A_by_id","http":200,"rows":0,"requestId":null}
{"label":"B_insert_scans_user_id_A","http":403,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"B_patch_scan_A","http":403,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"B_delete_scan_A","http":403,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"A_baca_scan_A_setelah_B","http":200,"rows":1,"requestId":null}
{"label":"A_baca_findings_scan_A_setelah_B","http":200,"rows":1,"requestId":null}
{"label":"anon_baca_scans","http":401,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"anon_baca_findings","http":401,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"B_baca_osv_cache","http":403,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"anon_baca_osv_cache","http":401,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"B_baca_kev_entries","http":403,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"anon_baca_kev_entries","http":401,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"B_baca_epss_cache","http":403,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"anon_baca_epss_cache","http":401,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"B_baca_rate_limit_events","http":403,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"anon_baca_rate_limit_events","http":401,"rows":null,"requestId":null,"pgErrorCode":"42501"}
{"label":"selesai","http":200,"rows":null,"requestId":"req_18c5fa5d01f6460e9838c0b5bb824265","scanId":"3e9b3346-ac0b-40b8-aeae-8fb495247a88","userA8":"e73735b6","userB8":"827eff13","leakDetected":false,"dataUjiDibiarkan":true}
```

Hasil: scan A `persisted=true` (1 finding), A dapat membaca miliknya, B mendapat **0 baris** untuk semua SELECT dan **403/42501** untuk INSERT/PATCH/DELETE serta seluruh tabel internal; akses tanpa login **401/42501**; `leakDetected=false`. Kebijakan RLS remote tetap sama seperti yang tercatat di atas (tidak ada perubahan migrasi sejak v8).

Catatan: `dataUjiDibiarkan=true` berarti baris uji A tetap ada di `scans`/`findings` (sesuai desain skrip; retensi 90 hari menangani pembersihan).

