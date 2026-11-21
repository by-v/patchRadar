# Tinjauan Keamanan OWASP Mobile — T-W4-01

**Tanggal:** 16 November 2026  
**Ruang lingkup:** aplikasi Expo/React Native (`app/`), Edge Function `scan` (`supabase/functions/scan/`), migrasi RLS (`supabase/migrations/`), konfigurasi build (`app/app.json`, `app/eas.json`), dan repositori Git.  
**Sumber kebenaran:** `docs/PRD.md` v1.1, terutama `NFR-03`, `NFR-04`, `NFR-05`, `NFR-06`, dan `R-13`.  
**Dasar acuan:** OWASP Mobile Application Security (MASVS/MASTG) kategori M1–M10; checklist disesuaikan dengan lingkup MVP PatchRadar.

> Catatan bukti: semua perintah di bawah dijalankan pada working tree HEAD `9738945` (16 November 2026). Item yang belum dapat diverifikasi pada build rilis ditandai **belum diverifikasi** dan tidak diklaim lulus.

## 1. Ringkasan checklist

| Kategori | Status | Bukti utama |
|---|---|---|
| M1 — Penggunaan kredensial yang benar | **Lulus** | Hanya anon key Supabase di bundle; token GitHub dan service role hanya di environment server. `git grep` dan audit APK preview bersih. |
| M2 — Keamanan rantai pasok | **Lulus dengan risiko diterima** | `npm audit`: 0 kritis, 0 tinggi; 5 moderate pada tool build Expo (bukan kode runtime). |
| M3 — Autentikasi dan otorisasi | **Lulus** | Sesi anonim via Supabase Auth; `verify_jwt=true` pada remote v8; RLS `scans`/`findings` hanya pemilik; role anon ditolak. |
| M4 — Validasi input/output | **Lulus** | Validasi klien + server; allowlist host GitHub; redirect dibatasi; error tidak membocorkan detail internal. |
| M5 — Komunikasi tidak aman | **Lulus** | Semua endpoint produksi HTTPS; `http://` ditolak pada tautan repo; tidak ada host selain GitHub/Supabase/OSV/KEV/EPSS. |
| M6 — Kontrol privasi | **Lulus dengan risiko diterima** | Hanya tautan repo, manifest, dan metadata paket; tidak ada analytics; log tanpa token/manifest penuh. |
| M7 — Perlindungan biner | **Risiko diterima** | Tidak ada obfuscation/anti-root; wajar untuk klien publik tanpa secret. |
| M8 — Salah konfigurasi keamanan | **Lulus** | `.env`/keystore diabaikan Git; tidak ada secret di EAS config repo; CORS tanpa cookie/credentials. |
| M9 — Penyimpanan data tidak aman | **Lulus dengan risiko diterima** | Token sesi di SecureStore (APK); SQLite hanya menyimpan data publik hasil scan. |
| M10 — Kriptografi tidak memadai | **Lulus** | Tidak ada kriptografi kustom; TLS platform dan SecureStore (Keystore/Keychain). |

## 2. Bukti pemeriksaan

### 2.1 Tidak ada secret di repo dan bundle

Perintah dan keluaran mentah:

```powershell
git grep -n -i -E "service_role|SUPABASE_SERVICE_ROLE_KEY|ghp_|github_pat_|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|eyJhbGciOi" -- . ':!TASKS.md' ':!docs/*' ':!fixtures/*' ':!app/node_modules'
```

Keluaran lengkap hanya berupa **nama variabel/peran, teks dokumentasi, dan nilai uji palsu**, bukan nilai secret:

```text
scripts/rls-check.mjs:11: * Tidak memakai service_role, tidak melakukan deploy/db push, dan tidak
supabase/config.toml:20:# `postgres` are reachable through the Data API roles (`anon`, `authenticated`, `service_role`)
supabase/functions/scan/composition.test.ts:168:      if (name === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-role-key';
supabase/functions/scan/composition.test.ts:187:    if (name === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-role-key';
supabase/functions/scan/composition.test.ts:201:  assert.deepEqual(missingKey.missing, ['SUPABASE_SERVICE_ROLE_KEY']);
supabase/functions/scan/composition.test.ts:209:  assert.deepEqual(missingBoth.missing, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
supabase/functions/scan/composition.test.ts:219:  logScanMisconfiguration(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
supabase/functions/scan/composition.test.ts:226:  assert.deepEqual(parsed.missing, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
supabase/functions/scan/composition.test.ts:237:const SERVICE_ROLE = 'service-role-key-test';
supabase/functions/scan/composition.test.ts:250:      if (name === 'SUPABASE_SERVICE_ROLE_KEY') return SERVICE_ROLE;
supabase/functions/scan/composition.test.ts:280:  assert.equal(ratePost!.headers.get('apikey'), SERVICE_ROLE);
supabase/functions/scan/composition.test.ts:281:  assert.equal(ratePost!.headers.get('authorization'), `Bearer ${SERVICE_ROLE}`);
supabase/functions/scan/composition.test.ts:288:  assert.equal(scanPost!.headers.get('apikey'), SERVICE_ROLE);
supabase/functions/scan/composition.test.ts:289:  assert.equal(scanPost!.headers.get('authorization'), `Bearer ${SERVICE_ROLE}`);
supabase/functions/scan/composition.test.ts:298:    assert.equal(findingsPost!.headers.get('apikey'), SERVICE_ROLE);
supabase/functions/scan/composition.test.ts:299:    assert.equal(findingsPost!.headers.get('authorization'), `Bearer ${SERVICE_ROLE}`);
supabase/functions/scan/composition.test.ts:347:      if (name === 'SUPABASE_SERVICE_ROLE_KEY') return SERVICE_ROLE;
supabase/functions/scan/composition.ts:47:const REQUIRED_STORE_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
supabase/functions/scan/composition.ts:54: * - `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` hilang: misconfig (tidak boleh
supabase/functions/scan/composition.ts:63:  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
supabase/migrations/20261110000000_osv_cache.sql:28:grant all on table public.osv_cache to service_role;
supabase/migrations/20261110000100_kev_entries.sql:28:grant all on table public.kev_entries to service_role;
supabase/migrations/20261114000000_epss_cache.sql:36:grant all on table public.epss_cache to service_role;
supabase/migrations/20261115000000_scans_findings_rate_limit.sql:147:grant all on table public.scans to service_role;
supabase/migrations/20261115000000_scans_findings_rate_limit.sql:148:grant all on table public.findings to service_role;
supabase/migrations/20261115000000_scans_findings_rate_limit.sql:149:grant all on table public.rate_limit_events to service_role;
```

Pemeriksaan file terlacak:

```powershell
git ls-files | Select-String -Pattern '\.env|\.keystore|\.jks|\.p12|\.p8|\.key|credentials\.json|\.apk|\.aab'
```

Keluaran:

```text
app/.env.example
```

`app/.env` tidak terlacak dan diabaikan:

```powershell
git check-ignore -v app/.env
```

```text
.gitignore:5:.env*	app/.env
```

Audit bundle hasil export lokal (`app/dist`, 32 berkas, 5.719.388 byte):

```text
service_role => 0
SUPABASE_SERVICE_ROLE_KEY => 0
GITHUB_TOKEN => 0
github_pat_ => 0
ghp_ => 0
BEGIN PRIVATE KEY => 0
```

Anon key ditemukan di bundle (1 kemunculan) dan **memang publik**; tidak ada service role maupun token GitHub. Audit APK preview 13 November 2026 di `docs/environment.md` juga mencatat hasil bersih untuk `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_TOKEN`, `ghp_`, `github_pat_`, `sk_live_`, dan blok private key. **APK release candidate belum dibuat pada tugas ini**; audit ulang wajib dilakukan pada `T-W4-02`/`T-W4-03`.

### 2.2 Autentikasi, otorisasi, dan RLS

- Klien membuat sesi anonim lewat `POST /auth/v1/signup`; token disimpan di `expo-secure-store` pada Android/iOS (`app/src/storage/secure.ts`, `app/src/auth/session.ts`). Tidak ada token yang dicetak ke log.
- Edge Function `scan` di-deploy tanpa `--no-verify-jwt`. Bukti remote v8 (15 November 2026): `verify_jwt=true`, versi 8, `updated_at 1794753073345`, sumber deployed SHA-256 `5d865a8c28190ea9be236b6906aa0d7e587c8c6416ef9d61596c5809c5db6e46`; lihat `docs/rls-test.md` dan `docs/due-diligence-log.md`.
- RLS:
  - `scans_select_own`: `authenticated`, `USING (user_id = auth.uid())`.
  - `findings_select_own_scan`: `authenticated`, `USING EXISTS (... scan_id ... user_id = auth.uid())`.
  - Tidak ada policy `USING (true)`; role `anon` tidak mendapat akses; tulis hanya service role.
- Bukti uji isolasi A3 (remote v8, 15 November 2026), `requestId` scan A `req_29bdf45c091b48d6a2a7ae4fa0f9cfa0`, `scanId 14671da2-19a2-4bfa-aad7-c08a7a76d763`:
  - A membaca `scans` 1 dan `findings` 2.
  - B membaca `scans`/`findings`/scan A → 0 baris.
  - B insert/patch/delete → HTTP 403 `42501`.
  - anon → HTTP 401 `42501`.
  - `leakDetected=false`.
- Uji ulang RLS pada build rilis tetap wajib pada `T-W4-04`; hasil remote v8 bukan bukti untuk APK rilis.

### 2.3 Validasi input dan pencegahan SSRF

- Klien (`app/src/lib/url.ts`) hanya menerima `https://github.com/pemilik/repo`, menolak `http://`, host lain/IP, query, fragmen, path tambahan, dan karakter aneh.
- Server (`supabase/functions/scan/validate.ts`) memvalidasi ulang secara ketat: hanya `https://github.com` persis, tanpa port/userinfo/encoding persen/path tambahan; owner/repo dibatasi karakter `[A-Za-z0-9_.-]`.
- Fetch server dibatasi allowlist `api.github.com` dan `raw.githubusercontent.com` (`github.ts`). Redirect hanya satu hop ke `api.github.com`; host lain, port, userinfo, skema turun, dan rantai redirect ditolak. Token GitHub hanya dikirim ke `api.github.com`, tidak ke `raw.githubusercontent.com`.
- Semua fetch memakai `AbortController`; body manifest dibatasi 5 MB; request body dibatasi 16 KB dan jumlah paket 1.500.
- Unit test keamanan lulus, termasuk penolakan host lain, redirect berbahaya, timeout, dan pemetaan 403/404/429.

Keluaran mentah ringkas suite Edge (16 November 2026):

```powershell
node --test "supabase/functions/scan/**/*.test.ts"
```

```text
✔ allowlist host hanya API/raw GitHub dengan HTTPS (13.503ms)
✔ fetchAllowedText menolak host lain tanpa memanggil fetch (1.8171ms)
✔ redirect aman hanya menerima api.github.com tanpa userinfo, port, atau skema turun (1.7454ms)
✔ 301 aman diikuti tepat satu hop dan token tetap hanya ke api.github.com (2.8577ms)
✔ redirect 301 berbahaya ditolak tanpa hop kedua (2.4148ms)
✔ rantai redirect dan redirect selain 301 tetap ditolak (1.4247ms)
✔ timeout memakai AbortController dan menjadi SCAN_TIMEOUT (15.2224ms)
✔ status GitHub dipetakan: 404, 403 privat, 403 rate limit, 429, 5xx (5.0744ms)
✔ URL repo GitHub valid menghasilkan owner/repo dan URL kanonik (3.98ms)
✔ masukan kosong dan bukan string ditolak (0.5765ms)
✔ skema selain HTTPS ditolak (0.3722ms)
✔ host selain github.com ditolak, termasuk trik userinfo/port/huruf unicode (0.5827ms)
✔ path tambahan, query, fragmen, dan trailing slash ditolak (0.5376ms)
✔ karakter aneh, encoding persen, spasi, dan newline ditolak (2.5072ms)

ℹ tests 196
ℹ pass 196
ℹ fail 0
ℹ duration_ms 2525.0762
```

Beberapa `requestId` yang tercetak oleh test handler/komposisi (bukti log tidak memuat token/manifest):

```text
{"requestId":"req_efb66bd389614cd285bfda11b1dae033","owner":"lodash","repo":"lodash","status":200,...}
{"requestId":"req_276faec4db0e4f999cb2cac780c3b314","owner":"lodash","repo":"lodash","status":401,...}
{"requestId":"req_4e6842e5ccda452998efd2162c12d0c0","owner":"lodash","repo":"lodash","status":429,...}
{"requestId":"req_7c97debf270249a99456b715a96ffcd6","owner":"lodash","repo":"lodash","status":413,...}
{"requestId":"req_1d37b11db74046e4b4b71f21ccb686f6","owner":null,"repo":null,"status":405,...}
{"requestId":"req_36673861fc2040359f147ac052d36792","owner":null,"repo":null,"status":400,...}
```

### 2.4 Penanganan error dan kebocoran data

- `errors.ts` memakai pesan statis; error tak dikenal dipetakan ke `INTERNAL` dengan pesan generik. `requestId` selalu disertakan di body dan header `X-Request-Id`.
- `handler.ts` hanya mencatat `requestId`, owner/repo (URL publik tervalidasi), status, durasi per tahap, dan `sourceStatus`. Tidak ada token, JWT, body manifest, atau isi advisory di log.
- Warning yang dikirim ke klien adalah kode + pesan publik, bukan stack trace.

### 2.5 Penyimpanan dan privasi

- Token sesi: `expo-secure-store` (Android Keystore/iOS Keychain). Fallback web memakai `localStorage`/memori; web bukan target APK dan tidak menyimpan service role.
- Riwayat lokal: SQLite menyimpan tautan repo, metadata paket, advisory, dan hasil scan. Tidak menyimpan token, JWT, atau rahasia. Semua data ini bersifat publik dari repo/advisory.
- Cloud: `scans`/`findings` menyimpan data scan milik pengguna anonim; RLS membatasi baca ke pemilik. Tidak ada SDK analytics pihak ketiga di `app/package.json`.
- Tidak ada unduhan kode sumber repo; hanya `package.json` dan `package-lock.json`.

### 2.6 Konfigurasi build dan dependensi

- `app/app.json` tidak memuat secret; hanya anon key publik dari environment Expo.
- `app/eas.json` hanya berisi profil build; tidak ada kredensial. Keystore/kredensial EAS tidak ada di repo.
- `.gitignore` menutup `.env*`, `*.jks`, `*.keystore`, `*.p12`, `*.p8`, `*.key`, `*.mobileprovision`, `credentials.json`, dan artefak build.
- `npm audit` (16 November 2026):

```text
info: 0, low: 1, moderate: 29, high: 0, critical: 0, total: 30
```

Dengan `--omit=dev`:

```text
info: 0, low: 0, moderate: 5, high: 0, critical: 0, total: 5
```

Lima temuan produksi berasal dari rantai tool/build Expo (`glob`, `minimatch`, `@expo/cli`, `@expo/fingerprint`, `expo`), bukan kode aplikasi yang berjalan di perangkat. Perbaikannya memerlukan downgrade mayor `expo` (52.0.49) dan tidak dilakukan pada MVP.

## 3. Daftar temuan

| ID | Tingkat | Temuan | Status | Alasan / tindakan |
|---|---|---|---|---|
| F-01 | Rendah | `readSupabaseConfig` menerima URL `http://` selain `https://`. | **Diterima** | `.env.example` dan environment produksi memakai HTTPS; tidak ada token rahasia di klien. Pengerasan menjadi HTTPS-only dapat dilakukan saat ada kebutuhan lingkungan lokal. |
| F-02 | Rendah | Tautan referensi advisory dibuka tanpa memvalidasi skema URL. | **Diterima** | Sumber referensi adalah OSV/advisory, bukan input pengguna langsung; tautan dibuka di browser eksternal. Validasi skema `http/https` disarankan sebagai pengerasan lanjutan. |
| F-03 | Sedang | Rate limit FR-25a dihitung per pengguna anonim; pengguna dapat membuat sesi anonim baru untuk mengakali kuota. | **Diterima** | Sesuai desain PRD FR-25a (per pengguna); FR-25b (per IP) adalah item **S** yang tidak diwajibkan MVP. Supabase Auth membatasi pembuatan akun anonim per IP. Risiko dicatat untuk pasca-MVP. |
| F-04 | Rendah | SQLite lokal tidak terenkripsi. | **Diterima** | Hanya menyimpan data publik (repo, paket, advisory); tidak ada token/rahasia. Aplikasi berjalan dalam sandbox OS. |
| F-05 | Rendah | Tidak ada certificate pinning, deteksi root/jailbreak, atau obfuscation biner. | **Diterima** | Klien publik tidak menyimpan secret; TLS platform dan SecureStore sudah memadai untuk MVP. Tidak ada requirement PRD untuk proteksi biner lanjutan. |
| F-06 | Sedang | `npm audit` melaporkan 5 moderate pada tool build Expo dan 30 total (1 low, 29 moderate) termasuk devDependencies. | **Diterima** | Tidak ada high/critical; temuan berada di tool build, bukan runtime aplikasi. Perbaikan memerlukan downgrade mayor `expo` yang berisiko besar; ditinjau saat upgrade SDK. |
| F-07 | Rendah | Request body tanpa `content-length` dibaca penuh sebelum dicek terhadap batas 16 KB. | **Diterima** | Batas platform Supabase dan pengecekan setelah baca membatasi dampak; bukan jalur kritis untuk MVP. Stream-limited reader dapat ditambahkan bila ada kebutuhan. |
| F-08 | Rendah | Fallback sesi web memakai `localStorage` (tidak terenkripsi). | **Diterima** | Target rilis adalah APK Android yang memakai SecureStore; web hanya untuk pengembangan. |

**Tidak ada temuan kritis atau tinggi yang terbuka.**

## 4. Item yang belum diverifikasi

- **APK release candidate:** belum dibangun pada tugas ini (`T-W4-02`). Audit string APK dan manifest rilis harus diulang setelah build.
- **Kebijakan cleartext Android pada build rilis:** tidak ada `usesCleartextTraffic` eksplisit di `app.json`; perilaku manifest hasil prebuild/EAS perlu dikonfirmasi pada APK `T-W4-02`.
- **Inspeksi environment EAS dari jarak jauh:** nilai environment EAS tidak diperiksa langsung pada tugas ini; dokumentasi `docs/environment.md` mencatat hanya dua variabel publik (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`). Konfirmasi ulang disarankan saat build rilis.
- **Uji RLS pada build rilis:** hasil remote v8 bukan bukti untuk APK rilis; ulangi pada `T-W4-04`.
- **Uji perangkat nyata untuk seluruh kondisi error:** sebagian masih mengandalkan unit test/fetch tiruan; lihat `docs/error-matrix.md` dan `docs/week3-gate.md`.

## 5. Kesimpulan T-W4-01

1. Checklist keamanan telah diisi dengan bukti perintah, keluaran mentah, `requestId`, dan rujukan dokumen.
2. Tidak ada temuan **kritis** atau **tinggi** yang terbuka.
3. Seluruh temuan yang diterima memiliki alasan dan rencana tindak lanjut; tidak ada temuan yang disembunyikan.
4. Pemeriksaan build rilis (APK) tetap menjadi syarat pada `T-W4-02`/`T-W4-03`/`T-W4-04` dan dicatat sebagai **belum diverifikasi** di tugas ini.

## 6. Audit build rilis — `T-W4-04` (17 November 2026)

### 6.1 APK release candidate

| Item | Nilai |
|---|---|
| Berkas | `<artifacts>\patchradar-release-vc2.apk` |
| Ukuran | 109.322.643 byte |
| SHA-256 | `DE535690DACA9D15F77539F3039F17872AE3DAF6E874580C2F81C55CDAB3088D` |
| Build EAS | `439654c8-b781-42d4-a612-a047912b502b` (profil `release`, environment `production`) |
| Entri arsip | 1.326 |
| Bundle | `assets/index.android.bundle` (3.444.760 byte, Hermes bytecode) |

Pemeriksaan seluruh entri arsip (bukan hanya bundle) dengan basis byte Latin-1 dan pencocokan literal:

```text
suspicious_entry_names=(kosong)   # tidak ada .env/.jks/.p12/.key/keystore/secret
pattern[service_role]=0
pattern[SUPABASE_SERVICE_ROLE_KEY]=0
pattern[SUPABASE_SERVICE_ROLE]=0
pattern[GITHUB_TOKEN]=0
pattern[ghp_]=0
pattern[github_pat_]=0
pattern[sbp_]=0
pattern[sb_secret_]=0
pattern[SUPABASE_SECRET]=0
pattern[service_role_key]=0
pattern[sk_live_]=0
pattern[BEGIN PRIVATE KEY]=0
pattern[BEGIN RSA PRIVATE KEY]=0
pattern[BEGIN OPENSSH PRIVATE KEY]=0
```

Pemeriksaan anon key publik (tanpa mencetak nilainya):

```text
anon_len=46 anon_prefix_sb_publishable=True anon_prefix_sb_secret=False
bundle=assets/index.android.bundle contains_anon_mid20=True
bundle=assets/index.android.bundle contains_anon_tail20=True
bundle=assets/index.android.bundle contains_supabase_host=True
```

Kesimpulan: tidak ada service role, token GitHub, private key, maupun berkas `.env` di APK rilis. Satu-satunya kredensial adalah anon **publishable** key (format `sb_publishable_…`) yang memang publik dan dilindungi RLS.

### 6.2 Environment EAS

`npx eas-cli@latest env:list <environment> --format long` (nilai tidak dicetak):

```text
=== production ===
var[1] name=EXPO_PUBLIC_SUPABASE_ANON_KEY visibility=PUBLIC type=string
var[2] name=EXPO_PUBLIC_SUPABASE_URL   visibility=PUBLIC type=string
=== preview ===
none
=== development ===
none
=== account scope production ===
account_none=True
```

`npx eas-cli@latest secret:list` (perintah lama, deprecated): daftar kosong — tidak ada secret legacy. Environment EAS bebas dari service role/token GitHub; hanya dua variabel publik.

### 6.3 Uji RLS pada backend build rilis

Rincian dan keluaran mentah di `docs/rls-test.md` bagian "Uji ulang pada build rilis — T-W4-04". Ringkasan: sesi A `e73735b6`, sesi B `827eff13`, scan A `req_18c5fa5d01f6460e9838c0b5bb824265` (`persisted=true`); B membaca 0 baris dan ditolak 403/42501 untuk tulis; akses anonim 401/42501; `leakDetected=false`.

### 6.4 Rate limit FR-25a (429 dengan `retryAfter`)

Rincian dan keluaran mentah di `docs/due-diligence-log.md` (baris 17 November 2026). Ringkasan: sesi anonim `71ab53da`, 5 scan diterima (`req_dc09458f4ca848028f97b623feb18256`, `req_5f4ff4b536be4730aabafa0cd37a9109`, `req_c9e71c2e215946b7b7de17c3913b3184`, `req_3837f19ea8544e36925ded9a750d018b`, `req_7f1f7b74fb944cfeaf931b0cbffdb72a`), scan ke-6 `429 RATE_LIMITED` `req_fc2b0fdf2d3d42a0b4c02602a05cffee` dengan `retry-after: 582` (header) dan `error.retryAfter: 582` (body). Setelah 610 detik, scan berikutnya diterima: `200` `req_79eab983ef5e402e8e6225ebcfa074e6` (`totalMs 5080`, 453 paket).

### 6.5 Item §4 yang kini terverifikasi

- APK release candidate: sudah dibangun (`T-W4-02`) dan diaudit di §6.1.
- Environment EAS: diperiksa langsung lewat `eas env:list` di §6.2.
- Uji RLS pada build rilis: diulang di §6.3.
- **Masih belum diverifikasi:** atribut `usesCleartextTraffic`/`networkSecurityConfig` pada `AndroidManifest.xml` biner (pencarian string mentah tidak konklusif); tidak ada bukti bahwa nilai itu disetel eksplisit.

## 7. Audit ulang berbasis sumber — HEAD `7fd6288` (20 November 2026)

Bagian ini mengulang pemeriksaan sumber setelah perubahan tema manual `T-W4-10`. Tidak ada perubahan dependensi, Edge Function, atau konfigurasi build sejak `T-W4-01`; audit **level APK tidak diulang** karena build final belum dijalankan. Temuan F-01 s.d. F-08 pada §3 tetap berlaku.

### 7.1 Keluaran mentah

Perintah di bawah dijalankan di root repo, kecuali `npm audit` yang dijalankan di `app/`. Nilai secret tidak dicetak.

```text
HEAD=7fd6288482a70a3b412f47da1bd007aee0832ca4
STATUS=
SECRET_HITS_RL=
supabase/config.toml
supabase/functions/scan/composition.test.ts
supabase/functions/scan/composition.ts
supabase/migrations/20261110000000_osv_cache.sql
supabase/migrations/20261110000100_kev_entries.sql
supabase/migrations/20261114000000_epss_cache.sql
supabase/migrations/20261115000000_scans_findings_rate_limit.sql
supabase/migrations/20261119000000_rate_limit_ip_hash_retention.sql
SECRET_HITS_EXIT=0
TRACKED_SENSITIVE=

app/.env.example
IGNORE_RULE=
.gitignore:5:.env*	app/.env
DEP_DIFF_SINCE_REVIEW=
DEP_DIFF_END
```

Rincian kecocokan pola pada sembilan berkas tersebut (semua adalah nama variabel, placeholder test, komentar, atau `grant ... to service_role`, bukan nilai rahasia):

```text
supabase/config.toml:20:# `postgres` are reachable through the Data API roles (`anon`, `authenticated`, `service_role`)
supabase/functions/scan/composition.test.ts:167:      if (name === 'GITHUB_TOKEN') return 'gh-token';
supabase/functions/scan/composition.test.ts:169:      if (name === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-role-key';
supabase/functions/scan/composition.test.ts:190:    GITHUB_TOKEN: 'gh-token',
supabase/functions/scan/composition.test.ts:192:    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
supabase/functions/scan/composition.test.ts:222:    if (name === 'GITHUB_TOKEN') return 'gh-token';
supabase/functions/scan/composition.test.ts:223:    if (name === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-role-key';
supabase/functions/scan/composition.test.ts:231:    if (name === 'GITHUB_TOKEN') return 'gh-token';
supabase/functions/scan/composition.test.ts:237:  assert.deepEqual(missingKey.missing, ['SUPABASE_SERVICE_ROLE_KEY']);
supabase/functions/scan/composition.test.ts:240:    if (name === 'GITHUB_TOKEN') return 'gh-token';
supabase/functions/scan/composition.test.ts:245:  assert.deepEqual(missingBoth.missing, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
supabase/functions/scan/composition.test.ts:255:    logScanMisconfiguration(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
supabase/functions/scan/composition.test.ts:262:  assert.deepEqual(parsed.missing, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
supabase/functions/scan/composition.test.ts:284:      if (name === 'GITHUB_TOKEN') return 'github-token';
supabase/functions/scan/composition.test.ts:286:      if (name === 'SUPABASE_SERVICE_ROLE_KEY') return SERVICE_ROLE;
supabase/functions/scan/composition.test.ts:381:      if (name === 'GITHUB_TOKEN') return 'github-token';
supabase/functions/scan/composition.test.ts:383:      if (name === 'SUPABASE_SERVICE_ROLE_KEY') return SERVICE_ROLE;
supabase/functions/scan/composition.ts:49:const REQUIRED_STORE_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
supabase/functions/scan/composition.ts:67: * - `GITHUB_TOKEN` hilang: tidak dianggap misconfig di sini; handler tetap
supabase/functions/scan/composition.ts:69: * - `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` hilang: misconfig (tidak boleh
supabase/functions/scan/composition.ts:76:  const token = getEnv('GITHUB_TOKEN') ?? null;
supabase/functions/scan/composition.ts:78:  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
supabase/migrations/20261110000000_osv_cache.sql:28:grant all on table public.osv_cache to service_role;
supabase/migrations/20261110000100_kev_entries.sql:28:grant all on table public.kev_entries to service_role;
supabase/migrations/20261114000000_epss_cache.sql:36:grant all on table public.epss_cache to service_role;
supabase/migrations/20261115000000_scans_findings_rate_limit.sql:147:grant all on table public.scans to service_role;
supabase/migrations/20261115000000_scans_findings_rate_limit.sql:148:grant all on table public.findings to service_role;
supabase/migrations/20261115000000_scans_findings_rate_limit.sql:149:grant all on table public.rate_limit_events to service_role;
supabase/migrations/20261119000000_rate_limit_ip_hash_retention.sql:77:grant execute on function public.purge_old_scans(timestamptz, integer) to service_role;
supabase/migrations/20261119000000_rate_limit_ip_hash_retention.sql:78:grant execute on function public.scan_storage_stats() to service_role;
GREP_DETAIL_EXIT=0
```

Audit dependensi produksi (`npm audit --omit=dev --json`, diringkas dengan `ConvertFrom-Json`):

```text
AUDIT_METADATA=

info     : 0
low      : 0
moderate : 5
high     : 0
critical : 0
total    : 5


AUDIT_PACKAGES_TOTAL=1
AUDIT_EXIT=1
```

`AUDIT_EXIT=1` adalah perilaku `npm audit` ketika temuan masih ada; tidak ada temuan high/critical, sesuai F-06.

Pemeriksaan konfigurasi terkait tema (kutipan keluaran mentah):

```text
THEME_STORAGE_KEYS=
app/src/storage/secure.ts:18:const WEB_PREFIX = 'patchradar.secure.';
```

`app.json` tetap memakai `userInterfaceStyle: "automatic"` dan plugin `expo-secure-store`; `eas.json` tetap memakai profil `release` dengan `environment: "production"` dan `autoIncrement: true`. Tidak ada perubahan pada kedua berkas itu sejak audit `T-W4-01`.

### 7.2 Kesimpulan audit ulang

1. Tidak ada nilai secret, token GitHub, service role, atau private key yang ditemukan di sumber terlacak. Kecocokan pola seluruhnya berupa identifier, placeholder, atau grant database.
2. Hanya `app/.env.example` yang terlacak; `app/.env` dikecualikan oleh `.gitignore:5:.env*`.
3. Tidak ada perubahan `app/package.json` maupun `app/package-lock.json` sejak HEAD `9738945` saat `T-W4-01` diaudit.
4. Preferensi tema memakai abstraksi `SecureStorage` yang sudah ada; tidak menambah dependensi, secret, atau kunci rahasia baru.
5. Tidak ada temuan kritis atau tinggi baru. F-01 s.d. F-08 tetap diterima dengan alasan yang sama.

### 7.3 Batas bukti

`requestId`: **tidak ada**. Seluruh pemeriksaan pada bagian ini adalah perintah Git dan `npm audit` lokal, tanpa panggilan API PatchRadar/Supabase.

**Masih belum diverifikasi pada saat §7 ditulis:** audit string dan manifest APK dari commit `7fd6288` (build final belum dibuat), atribut `usesCleartextTraffic`/`networkSecurityConfig` pada manifest biner, inspeksi environment EAS ulang, dan uji perangkat untuk `StatusBar` serta persistensi tema setelah force-stop. Bagian §6 tetap menjadi bukti untuk APK `vc2`, bukan untuk build final. **Tindak lanjut: build final telah dibuat dan diaudit pada §8.**

## 8. Audit APK final `vc3` — 20 November 2026

### 8.1 Identitas build

| Item | Nilai |
|---|---|
| Build ID | `91ee200a-aa2f-449b-a6e8-fa8a99e747d6` |
| Halaman build | `https://expo.dev/accounts/codebyv10/projects/patchradar/builds/91ee200a-aa2f-449b-a6e8-fa8a99e747d6` |
| Commit sumber | `11d1def6e4cd630af6dc796857ad2101bd7baaf5` |
| `appVersion` / `versionCode` | `1.0.0` / `3` (naik dari `2`) |
| Profil / environment | `release` / `production` |
| Berkas | `<artifacts>\patchradar-release-vc3.apk` |
| Ukuran | 109.333.379 byte |
| SHA-256 | `B685959AD3A0AA9D962E8FF31031C3A46C47148B4F1489BEC12B00EE1DCC7800` |
| Entri arsip | 1.326 |
| Bundle | `assets/index.android.bundle` (3.455.488 byte) |

### 8.2 Keluaran mentah build dan unduh

```text
NODE=v24.21.0
EAS_VERSION=eas-cli/27.11.0 win32-x64 node-v24.21.0
WHOAMI=
codebyv10
<email-redacted>
WHOAMI_EXIT=0

Environment variables with visibility "Plain text" and "Sensitive" loaded from the "production" environment on EAS: EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_SUPABASE_URL.

- Incrementing versionCode from 2 to 3.
✔ Incremented versionCode from 2 to 3.
✔ Using remote Android credentials (Expo server)
✔ Using Keystore from configuration: Build Credentials EPkjlDM7tu (default)
✔ Uploaded to EAS 15s
✔ Computed project fingerprint
See logs: https://expo.dev/accounts/codebyv10/projects/patchradar/builds/91ee200a-aa2f-449b-a6e8-fa8a99e747d6
✔ Build finished

🤖 Android app:
https://expo.dev/artifacts/eas/RTB180pXwrTxKUDkcDHX5Ye8OmvrtBn8eq8UWRGt5UY.apk
BUILD_EXIT=0

✔ 🎯 Found build 91ee200a-aa2f-449b-a6e8-fa8a99e747d6 on EAS servers.
- Downloading app (0 / 104 MB)
✔ Successfully downloaded app 1m 34s
DOWNLOAD_EXIT=0

APK_PATH=<artifacts>\patchradar-release-vc3.apk
APK_SIZE=109333379
SHA256=B685959AD3A0AA9D962E8FF31031C3A46C47148B4F1489BEC12B00EE1DCC7800

VIEW_KEYS=id,status,platform,artifacts,fingerprint,initiatingActor,logFiles,app,distribution,buildProfile,appIdentifier,sdkVersion,appVersion,appBuildVersion,gitCommitHash,gitCommitMessage,priority,createdAt,updatedAt,message,completedAt,expirationDate,isForIosSimulator,metrics

id              : 91ee200a-aa2f-449b-a6e8-fa8a99e747d6
status          : FINISHED
appVersion      : 1.0.0
appBuildVersion : 3
gitCommitHash   : 11d1def6e4cd630af6dc796857ad2101bd7baaf5
createdAt       : 2026-11-20T15:32:07.994Z

ARTIFACT_URL=https://expo.dev/artifacts/eas/RTB180pXwrTxKUDkcDHX5Ye8OmvrtBn8eq8UWRGt5UY.apk
```

### 8.3 Audit string dan entri APK

Pencocokan literal dilakukan terhadap seluruh byte APK (Latin-1) dan nama entri arsip.

```text
service_role=0
SUPABASE_SERVICE_ROLE_KEY=0
GITHUB_TOKEN=0
ghp_=0
github_pat_=0
sb_secret_=0
sb_publishable_=1
BEGIN PRIVATE KEY=0
Tema Gelap=0
Tema Terang=0
ENTRIES=1326
SUSPICIOUS_ENTRY_NAMES=
BUNDLE_BYTES=3455488
```

Pencocokan lanjutan untuk memastikan pilihan tema masuk ke bundel (Hermes menyimpan string secara terpisah sehingga frasa lengkap tidak selalu berurutan):

```text
LATIN1[Tema]=1 UNICODE[Tema]=0
LATIN1[Gelap]=1 UNICODE[Gelap]=0
LATIN1[Terang]=1 UNICODE[Terang]=0
LATIN1[Tampilan]=1 UNICODE[Tampilan]=0
LATIN1[setColorScheme]=3 UNICODE[setColorScheme]=0
LATIN1[patchradar.secure]=0 UNICODE[patchradar.secure]=0
LATIN1[Appearance]=482 UNICODE[Appearance]=0
LATIN1[Pilihan ini tidak mengikuti]=1 UNICODE[Pilihan ini tidak mengikuti]=0
OLD_BUNDLE_BYTES=3444760 NEW_BUNDLE_BYTES=3455488 DELTA=10728
```

Kesimpulan: tidak ada service role, token GitHub, private key, atau berkas `.env`/keystore di APK final. Satu-satunya kredensial adalah anon publishable key (format `sb_publishable_…`) yang bersifat publik. Kata **Gelap**, **Terang**, **Tampilan**, teks bantuan tema, dan `setColorScheme` hadir di bundel; ukuran bundle naik 10.728 byte dari APK `vc2`, sehingga perubahan tema memang ikut ter-build.

### 8.4 Batas bukti

`requestId`: **tidak ada**. Build EAS, unduh, dan audit APK tidak membuat panggilan API PatchRadar/Supabase.

**Masih belum diverifikasi:** atribut `usesCleartextTraffic`/`networkSecurityConfig` pada `AndroidManifest.xml` biner (pencarian string tidak konklusif, sama seperti §6.5), pemasangan APK di perangkat, dan smoke test perangkat termasuk `StatusBar` serta persistensi tema setelah force-stop. `git status` setelah build tetap bersih; tidak ada direktori `android/` atau `ios/` yang dibuat di repo.
