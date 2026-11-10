# TASKS.md — Rencana Kerja PatchRadar MVP

Dokumen ini adalah rencana eksekusi turunan dari `docs/PRD.md` v1.1. PRD tetap menjadi sumber kebenaran; jika isi dokumen ini berbeda dari PRD, PRD yang menang.

## Cara memakai file ini

1. Baca `AGENTS.md` dan bagian PRD yang relevan dengan tugas.
2. Ambil tugas pertama yang berstatus `[ ]` dan seluruh prasyaratnya sudah `[x]`.
3. Ubah status menjadi `[~]`, kerjakan **hanya** tugas itu, lalu jalankan seluruh kriteria selesai (AC).
4. Jika semua AC lulus: ubah menjadi `[x]`, isi `Catatan hasil:`, dan commit dengan format `T-xx: ringkasan`.
5. Jika terblokir: ubah menjadi `[!]`, tulis penyebab dan langkah yang dibutuhkan.
6. Jangan mengerjakan tugas berikutnya sebelum tugas saat ini `[x]`. Jangan memotong fitur **M**; item **S** hanya dipotong sesuai aturan scope PRD §17.

## Legenda status

| Status | Arti |
|---|---|
| `[ ]` | Belum dikerjakan |
| `[~]` | Sedang dikerjakan |
| `[x]` | Selesai dan seluruh AC terpenuhi |
| `[!]` | Terblokir; alasan wajib ditulis di catatan |

## Legenda tipe

| Tipe | Arti |
|---|---|
| `[AGENT]` | Dikerjakan agent AI |
| `[MANUAL]` | Dikerjakan pengembang; agent berhenti dan meminta pengembang melakukannya |
| `[GATE]` | Gerbang Go/No-Go; hanya ditutup dengan bukti uji |

## Progres per fase

| Fase | Jumlah tugas | Estimasi | `[ ]` | `[~]` | `[x]` | `[!]` |
|---|---:|---:|---:|---:|---:|---:|
| Hari 0 — Persiapan | 7 | 9 jam | 7 | 0 | 0 | 0 |
| Minggu 1 — Pipeline backend | 17 | 28 jam | 17 | 0 | 0 | 0 |
| Minggu 2 — Aplikasi Expo | 10 | 20,5 jam | 10 | 0 | 0 | 0 |
| Minggu 3 — Offline, cloud, error | 14 | 27,5 jam | 14 | 0 | 0 | 0 |
| Minggu 4 — Uji, keamanan, rilis, validasi | 10 | 22,5 jam | 10 | 0 | 0 | 0 |
| **Buffer (cadangan)** | **—** | **16 jam** | **—** | **—** | **—** | **—** |
| Final dan Laporan | 4 | 8 jam | 4 | 0 | 0 | 0 |
| **Total** | **62** | **115,5 jam + 16 jam buffer** | **62** | **0** | **0** | **0** |

> Estimasi adalah target perencanaan, bukan komitmen. Jika sebuah tugas melebihi 3 jam, pecah menjadi tugas baru dan perbarui tabel ini — kecuali tugas `[MANUAL]` sesi validasi, yang dihitung dari jumlah peserta (lihat `T-W4-05`).
>
> **Buffer (cadangan):** 2 hari kerja (16 jam) di akhir Minggu 4, sebelum Final dan Laporan, tanpa tugas. Buffer dipakai **lebih dulu** daripada memotong tugas **M**. Tidak ada fase yang melebihi 28 jam setelah penyeimbangan; Minggu 1 tepat 28 jam sehingga tidak memiliki buffer internal.

---

## Hari 0 — Persiapan

### T-D0-01 — Inisialisasi repo Git dan commit kerangka
- **Tipe:** `[MANUAL]`
- **Tujuan:** Menjadikan folder proyek sebagai repo Git dengan kerangka, `.gitignore`, dan dokumen awal yang aman.
- **Prasyarat:** —
- **File/folder:** `.git/`, `.gitignore`, `app/`, `supabase/`, `fixtures/`, `docs/`, `AGENTS.md`, `TASKS.md`
- **Langkah:**
  1. Jalankan `git init` di akar proyek dan periksa `git status`.
  2. Pastikan `.env*`, `node_modules`, `.expo`, `dist`, serta file kunci/keystore tidak ikut ter-stage.
  3. Tambahkan seluruh file kerangka, lalu commit `T-D0-01: kerangka proyek`.
  4. Jika ada remote, hubungkan dan push; jika tidak, catat bahwa repo masih lokal.
- **Memenuhi:** `NFR-03`, `R-13`
- **Kriteria selesai (AC):**
  - [x] `git status` bersih setelah commit.
  - [x] `git log --oneline` menampilkan satu commit.
  - [x] `git check-ignore -v .env` mengembalikan aturan dari `.gitignore`.
  - [x] Tidak ada `node_modules`, `.env`, atau file keystore di `git ls-files`.
- **Estimasi:** 1 jam
- [x] Tugas selesai
- **Catatan hasil:**

### T-D0-02 — Siapkan akun, proyek Supabase, dan CLI
- **Tipe:** `[MANUAL]`
- **Tujuan:** Menyediakan proyek Supabase dan CLI yang terhubung untuk pengembangan Edge Function serta migrasi.
- **Prasyarat:** `T-D0-01`
- **File/folder:** tidak ada file rahasia di repo; catatan project ref disimpan di luar repo atau `docs/`
- **Langkah:**
  1. Buat akun Supabase dan proyek baru (region terdekat), catat project ref.
  2. Pasang Supabase CLI dan jalankan `supabase login`.
  3. Hubungkan folder dengan `supabase link --project-ref <ref>`.
  4. Catat versi CLI dan batas kuota yang terlihat di dashboard.
- **Memenuhi:** `NFR-15`, `R-08`
- **Kriteria selesai (AC):**
  - [x] `supabase projects list` menampilkan proyek.
  - [x] `supabase --version` tercatat.
  - [x] Tidak ada kredensial yang masuk ke repo.
- **Estimasi:** 1,5 jam
- [x] Tugas selesai
- **Catatan hasil:**

### T-D0-03 — Buat token GitHub read-only sebagai secret server
- **Tipe:** `[MANUAL]`
- **Tujuan:** Menyediakan token GitHub server-side untuk menaikkan batas laju tanpa membocorkannya ke APK.
- **Prasyarat:** `T-D0-02`
- **File/folder:** secret Supabase `GITHUB_TOKEN`; tidak ada file token di repo
- **Langkah:**
  1. Buat fine-grained token dengan akses baca metadata dan isi repo publik.
  2. Simpan sebagai secret Edge Function melalui dashboard atau `supabase secrets set`.
  3. Uji token dengan permintaan `curl` ke GitHub API dan catat status.
  4. Periksa repo dengan `git grep` untuk memastikan token tidak ada.
- **Memenuhi:** `FR-03`, `NFR-03`, `R-01` (asumsi `A-16`)
- **Kriteria selesai (AC):**
  - [x] Permintaan GitHub dengan token mengembalikan 200.
  - [x] Secret terlihat di dashboard Supabase, bukan di repo.
  - [x] `git grep -i "ghp_\|github_pat_"` tidak menemukan token.
- **Estimasi:** 1 jam
- [x] Tugas selesai
- **Catatan hasil:**

### T-D0-04 — Siapkan akun EAS, iPhone, dan Expo Go
- **Tipe:** `[MANUAL]`
- **Tujuan:** Memastikan build Android tetap dapat dilakukan lewat EAS dan pengujian harian dapat dilakukan di iPhone memakai Expo Go.
- **Prasyarat:** `T-D0-01`
- **File/folder:** konfigurasi EAS nanti di `app/`; tidak ada artefak build di repo
- **Langkah:**
  1. Buat akun Expo, pasang `eas-cli`, dan login.
  2. Pasang Expo Go dari App Store di iPhone dan login dengan akun Expo yang sama.
  3. Catat model iPhone dan versi iOS.
  4. Pastikan iPhone dan PC dapat saling terhubung (jaringan yang sama atau mode tunnel Expo) agar aplikasi dari `T-D0-05` dapat dibuka lewat Expo Go.
- **Memenuhi:** `NFR-10`, `NFR-13`, `R-14`
- **Kriteria selesai (AC):**
  - [x] `eas whoami` menampilkan akun.
  - [x] Expo Go terpasang di iPhone.
  - [x] Aplikasi Expo dari `T-D0-05` terbuka di Expo Go dan versi iOS tercatat (diverifikasi di akhir `T-D0-05`).
- **Catatan verifikasi:** AC (3) baru dapat dicentang setelah `T-D0-05` selesai; `T-D0-04` ditutup setelah verifikasi tersebut.
- **Estimasi:** 1 jam
- [x] Tugas selesai
- **Catatan hasil:**
  - `eas whoami` dan `npx expo whoami` menampilkan akun `codebyv10`.
  - Expo Go terpasang di iPhone X (iOS 16.7.16) dan login dengan akun Expo yang sama.
  - Aplikasi `T-D0-05` berhasil dibuka di Expo Go lewat QR `npx expo start --lan` (`exp://192.168.1.27:8081`).
  - Model dan versi perangkat dicatat di `docs/environment.md`.
  - “Enter URL manually” tidak tersedia di Expo Go iOS versi ini; pembukaan memakai pemindaian QR lewat aplikasi Kamera.

### T-D0-05 — Inisialisasi aplikasi Expo TypeScript dengan Expo Router
- **Tipe:** `[AGENT]`
- **Tujuan:** Membuat fondasi aplikasi Expo/React Native bertipe TypeScript dan memiliki routing file-based.
- **Prasyarat:** `T-D0-01`, `T-D0-04`
- **Catatan prasyarat:** `T-D0-04` boleh berstatus `[~]` sampai AC (3)-nya diverifikasi di akhir tugas ini.
- **File/folder:** `app/package.json`, `app/app.json`, `app/tsconfig.json`, `app/app/`
- **Langkah:**
  1. Jalankan `npx create-expo-app@latest app` dengan template default yang sudah memakai TypeScript dan Expo Router.
  2. Hapus contoh yang tidak dipakai, pertahankan struktur router dan tab dasar.
  3. Jalankan aplikasi di Expo Go pada iPhone, verifikasi route awal tampil, dan catat versi iOS.
  4. Catat versi Expo SDK, React Native, Node, dan iOS di `docs/`.
- **Memenuhi:** `NFR-13` (fondasi), `FR-17` (shell navigasi)
- **Kriteria selesai (AC):**
  - [x] `npm run typecheck` atau `npx tsc --noEmit` lulus.
  - [x] `npx expo-doctor` tidak melaporkan masalah kritis.
  - [x] Aplikasi Expo terbuka di Expo Go pada iPhone dan versi iOS tercatat (sekaligus memverifikasi AC (3) `T-D0-04`).
  - [x] Catatan versi iOS tersimpan di `docs/`.
- **Catatan verifikasi:** Verifikasi APK Android dilakukan terpisah di `T-W2-08` dan `T-W4-03` memakai emulator Android atau HP Android pinjaman.
- **Estimasi:** 2 jam
- [x] Tugas selesai
- **Catatan hasil:**
  - Scaffold dibuat dengan `npx create-expo-app@latest app` (template default SDK 58, TypeScript, Expo Router).
  - Contoh bawaan dihapus (`explore`, `hint-row`, `external-link`, `web-badge`, `collapsible`); tab awal menjadi **Pindai** (`src/app/index.tsx`) dan **Riwayat** (`src/app/riwayat.tsx`).
  - `app.json` memakai nama `PatchRadar`, slug `patchradar`, scheme `patchradar`.
  - `npx tsc --noEmit` lulus, `npx expo-doctor` lulus 20/20, `npx expo lint` lulus, export bundle iOS berhasil.
  - Aplikasi dibuka di Expo Go pada iPhone X (iOS 16.7.16); versi lingkungan dicatat di `docs/environment.md`.
  - Hook `use-color-scheme.web.ts` diperbaiki memakai `useSyncExternalStore` agar aturan lint React 19 lulus tanpa mengubah perilaku.
  - Verifikasi APK Android tetap dilakukan terpisah pada `T-W2-08`/`T-W4-03`.

### T-D0-06 — Konfigurasi lint, TypeScript strict, dan unit test
- **Tipe:** `[AGENT]`
- **Tujuan:** Menyediakan gerbang kualitas otomatis sebelum penulisan logika bisnis.
- **Prasyarat:** `T-D0-05`
- **File/folder:** `app/package.json`, `app/tsconfig.json`, konfigurasi ESLint, konfigurasi Jest/Vitest
- **Langkah:**
  1. Aktifkan `strict` dan `noUncheckedIndexedAccess` pada TypeScript.
  2. Pasang dan konfigurasi ESLint untuk TypeScript/React Native.
  3. Pasang runner unit test yang kompatibel dengan Expo (Jest + `jest-expo` atau Vitest).
  4. Tambahkan script `lint`, `typecheck`, dan `test`, plus satu smoke test.
- **Memenuhi:** `NFR-16`
- **Kriteria selesai (AC):**
  - [x] `npm run lint` lulus.
  - [x] `npm run typecheck` lulus.
  - [x] `npm test` menjalankan minimal satu test dan lulus.
  - [x] Test yang sengaja dibuat gagal benar-benar dilaporkan gagal.
- **Estimasi:** 1,5 jam
- [x] Tugas selesai
- **Catatan hasil:**
  - `tsconfig.json`: `strict` sudah aktif sejak scaffold; ditambahkan `noUncheckedIndexedAccess: true` dan `types: ["jest"]`.
  - ESLint memakai `eslint-config-expo`; script `npm run lint` menjalankan `expo lint`.
  - Unit test memakai Jest 30 + `jest-expo` (`~58.0.14`) sebagai devDependencies dengan preset `jest-expo`.
  - Script baru: `npm run typecheck` (`tsc --noEmit`) dan `npm test` (`jest`).
  - Smoke test `src/__tests__/app-config-test.ts` memverifikasi nama, slug, dan scheme PatchRadar pada `app.json`.
  - `npm run lint`, `npm run typecheck`, dan `npm test -- --ci` lulus (1 suite, 1 test).
  - Verifikasi AC (4): test sementara `expect(1).toBe(2)` dilaporkan **FAIL** dengan exit code 1; file uji sementara kemudian dihapus.
  - Catatan: `npm audit` melaporkan 31 kerentanan (1 low, 30 moderate) dari dependency pengembangan; tidak memblokir AC dan akan ditinjau terpisah.

### T-D0-07 — Catat versi lingkungan dan daftar secret
- **Tipe:** `[AGENT]`
- **Tujuan:** Menyediakan baseline lingkungan dan memastikan tidak ada secret yang bocor sebelum coding fitur.
- **Prasyarat:** `T-D0-02`, `T-D0-03`, `T-D0-04`, `T-D0-05`, `T-D0-06`
- **File/folder:** `docs/environment.md`, `docs/due-diligence-log.md`
- **Langkah:**
  1. Catat versi Node, npm, Expo SDK, React Native, Supabase CLI, EAS CLI, dan perangkat uji.
  2. Catat daftar secret yang dipakai: `GITHUB_TOKEN`, service role (server saja), kredensial EAS.
  3. Jalankan `git grep` untuk pola token/secret dan simpan hasilnya.
  4. Tambahkan satu baris verifikasi awal ke due-diligence log.
- **Memenuhi:** `NFR-03`, `NFR-16`
- **Kriteria selesai (AC):**
  - [x] `docs/environment.md` memuat seluruh versi dan perangkat.
  - [x] `git grep -i "service_role\|ghp_\|github_pat_\|BEGIN PRIVATE KEY"` tidak menemukan secret.
  - [x] Daftar secret dan lokasinya terdokumentasi tanpa nilainya.
- **Estimasi:** 1 jam
- [x] Tugas selesai
- **Catatan hasil:**
  - `docs/environment.md` memuat Node 24.21.0, npm 11.11.1, Expo SDK ~58.0.23, React Native 0.88.1, Supabase CLI 3.0.0, EAS CLI 27.5.0, dan perangkat iPhone X (iOS 16.7.16).
  - Daftar secret tanpa nilai ditambahkan: `GITHUB_TOKEN` (secret Edge Function), `SUPABASE_SERVICE_ROLE_KEY` (server-side), kredensial EAS (dikelola EAS; keystore tidak di repo), serta catatan bahwa anon key bersifat publik.
  - `git grep` dijalankan dengan dan tanpa `--untracked`; tiga kecocokan hanya berupa teks kriteria di `TASKS.md` dan komentar peran `service_role` di `supabase/config.toml`, bukan nilai secret.
  - Baris verifikasi awal ditambahkan ke `docs/due-diligence-log.md`; pemindaian akan diulang sebelum build rilis.

---

## Minggu 1 — Pipeline Backend

### T-W1-01 — Uji GitHub REST/raw dan simpan fixture manifest
- **Tipe:** `[AGENT]`
- **Tujuan:** Membuktikan cara mengambil metadata repo, `package.json`, dan `package-lock.json` beserta perilaku batas laju dan error.
- **Prasyarat:** `T-D0-03`, `T-D0-07`
- **File/folder:** `scripts/probe-github.mjs`, `fixtures/github/`, `docs/due-diligence-log.md`
- **Langkah:**
  1. Ambil metadata tiga repo nyata (contoh React/Next dan Expo) beserta default branch.
  2. Ambil `package.json` dan `package-lock.json` dari root; catat status, header rate limit, ukuran, dan encoding.
  3. Uji kasus 404, 403/privat, redirect, dan repo tanpa manifest.
  4. Simpan respons mentah sebagai fixture dan isi log due diligence.
- **Memenuhi:** `FR-03`, `NFR-04`, `R-01`, `R-02`
- **Kriteria selesai (AC):**
  - [x] Tiga fixture manifest tersimpan dan dapat dibaca ulang.
  - [x] Log memuat tanggal, sumber, yang dicek, hasil, dan keputusan.
  - [x] Perbedaan 403 dan 404 untuk repo privat/tidak ada tercatat.
  - [x] Batas laju tanpa token dan dengan token tercatat sebagai angka hasil ukur.
- **Estimasi:** 1 jam
- [x] Tugas selesai
- **Catatan hasil:**
  - Script: `scripts/probe-github.mjs` (metadata REST + manifest raw), `scripts/probe-github-ratelimit.mjs` (jatah habis), `scripts/probe-github-raw-edge.mjs` (redirect/tanpa manifest).
  - Fixture: `axios/axios`, `lodash/lodash`, `npm/cli` (metadata + `package.json` + `package-lock.json`), `expressjs/express` (tanpa lockfile), `error-not-found`, `summary.json`, `rate-limit-exhaustion.json`, `raw-edge-cases.json`.
  - Seluruh fixture berstatus 200 dapat dibaca ulang; sha256 file cocok dengan `summary.json` (diperiksa ulang).
  - Terautentikasi (dijalankan pengembang): `core.limit=5000`; `used` 1→6 selama 5 panggilan REST; 8 pengambilan raw di antaranya tidak menambah `used`.
  - Tanpa token: `core.limit=60`, reset `2026-11-08T20:29:40Z`; 52 panggilan menaikkan `used` ke 60 dan `remaining` ke 0; panggilan berikutnya **403** `API rate limit exceeded` dengan `x-ratelimit-remaining: 0` dan tanpa `Retry-After`.
  - Saat jatah REST habis, `raw.githubusercontent.com` untuk `axios/axios` tetap **200** (6.662 byte, sha256 sama).
  - 404 `Not Found` teramati untuk repo tidak ada saat jatah tersedia; repo tidak ada saat jatah habis ikut **403**.
  - Redirect web `facebookincubator/create-react-app` → **301** ke `react/create-react-app`; raw mengembalikan 200 tanpa redirect. Repo tanpa manifest (`torvalds/linux`) 404 untuk `package.json` dan lock.
  - Repo privat belum diuji langsung (tidak ada repo privat yang dapat diakses tanpa token), ditandai `[PERLU DIVERIFIKASI]`; 403 hanya teramati untuk rate limit.
  - Alamat IP pada pesan 403 diredaksi menjadi `<ip>` sebelum disimpan.

### T-W1-02 — Uji npm registry untuk resolusi range
- **Tipe:** `[AGENT]`
- **Tujuan:** Memastikan fallback `package.json` dapat memilih versi yang memenuhi range dengan benar.
- **Prasyarat:** `T-D0-07`
- **File/folder:** `scripts/probe-npm.mjs`, `fixtures/npm/`, `docs/due-diligence-log.md`
- **Langkah:**
  1. Uji endpoint metadata untuk paket biasa, paket scoped, dan paket dengan prerelease.
  2. Catat ukuran respons, waktu, dan cara memilih versi tertinggi yang memenuhi range.
  3. Uji 404, 429, serta spesifikasi `git`, `file`, dan `workspace`.
  4. Simpan fixture respons dan keputusan.
- **Memenuhi:** `FR-05`, `FR-19`, `R-12`
- **Kriteria selesai (AC):**
  - [x] Resolusi `^`, `~`, dan versi exact terdokumentasi dengan contoh nyata.
  - [x] Perilaku paket scoped dan prerelease tercatat.
  - [x] Spesifikasi non-registry diputuskan untuk dilewati.
  - [x] Log due diligence terisi.
- **Estimasi:** 1 jam
- [x] Tugas selesai
- **Catatan hasil:**
  - Script: `scripts/probe-npm.mjs` (packument ringkas `application/vnd.npm.install-v1+json`, resolver range komparator semver sederhana khusus probe).
  - Fixture: `fixtures/npm/express.json` (290 versi, 342.878 byte), `types-node.json` (2.382 versi, 2.334.287 byte), `react.json` (3.003 versi, 2.967.104 byte), `not-found.json` (21 byte), `summary.json`. Disimpan sebagai byte respons terdekompresi (bukan pretty-print) dan dapat dibaca ulang.
  - Ukuran/waktu: express 342.878 B/221 ms, `@types/node` 2.334.287 B/347 ms, react 2.967.104 B/129 ms; semua `content-encoding: br`.
  - Resolusi: `express ^4.18.0→4.22.3` (15 kandidat), `~4.18.0→4.18.3` (4), `4.18.2→4.18.2`; `@types/node ^22.0.0→22.20.5` (161); `react ^19.0.0→19.3.1`; exact prerelease `19.3.0-canary-ff8f88fc-20260915` cocok.
  - Scoped memakai `@types%2Fnode`; dist-tag `latest-4`=`4.22.3`; prerelease diabaikan pada range biasa (2.860 prerelease react) dan hanya dipakai bila range menyebutkannya.
  - 404 `{"error":"Not found"}` 21 byte; 429 tidak terpicu selama probe `[PERLU DIVERIFIKASI]`; spesifikasi `git+`, `file:`, dan `workspace:` diputuskan dilewati dan ditandai estimasi.

### T-W1-03 — Uji OSV.dev batch, severity, dan alias
- **Tipe:** `[AGENT]`
- **Tujuan:** Membuktikan bentuk query batch, isi respons, dan cara memetakan severity serta alias CVE.
- **Prasyarat:** `T-D0-07`
- **File/folder:** `scripts/probe-osv.mjs`, `fixtures/osv/`, `docs/due-diligence-log.md`
- **Langkah:**
  1. Kirim `querybatch` dengan 50 paket+versi dan catat bentuk respons.
  2. Ambil detail advisory untuk minimal 20 temuan; catat severity, aliases, affected, dan fixed.
  3. Uji batas chunk, 429/5xx, dan paket tanpa advisory.
  4. Simpan fixture dan keputusan pemetaan severity.
- **Memenuhi:** `FR-06`, `FR-11`, `R-03`, `R-04`
- **Kriteria selesai (AC):**
  - [x] Batch 50 query berhasil atau batas sebenarnya tercatat.
  - [x] Contoh severity dari `severity`, `database_specific`, dan CVSS dibandingkan.
  - [x] Alias GHSA–CVE terdokumentasi.
  - [x] Fixture netral (tanpa advisory) dan rentan tersimpan.
- **Estimasi:** 1 jam
- [x] Tugas selesai
- **Catatan hasil:**
  - Script: `scripts/probe-osv.mjs` (querybatch, detail `GET /v1/vulns/{id}`, parser CVSS v3.1 untuk membandingkan bucket, uji batas chunk).
  - Fixture: `fixtures/osv/batch-50.json`, `advisory-details.json`, `advisory-raw.json`, `chunk-boundary.json`, `neutral.json`, `summary.json`.
  - Batch 50: 200, 50 hasil, 17.237 byte, 698 ms; 46 paket rentan/4 tanpa temuan; 239 temuan dan 133 advisory unik. Respons batch **hanya** berisi `id` + `modified`, jadi detail harus diambil terpisah.
  - Batas query terukur: 100/200/1.000 query → 200; **1.001 query → 400** `{"code":3,"message":"too many queries"}`. Chunk 50 dipertahankan untuk membatasi ukuran respons.
  - Detail 40/40 berhasil. 39 advisory punya alias `CVE-*`; satu GHSA tanpa CVE (`GHSA-5c6j-r48x-rmvq`) tetap punya CVSS 8.1 HIGH dan `fixed=7.0.3`, sehingga KEV/EPSS tidak bisa dicocokkan (R-04).
  - Severity 35/40 dari CVSS_V3 (2,6–9,8): Critical 1, High 17, Medium 15, Low 2. Lima advisory hanya memuat CVSS_V4, sehingga memakai `database_specific.severity` (Medium 2, High 2, Low 1). Label GitHub `MODERATE` dinormalisasi ke `MEDIUM`.
  - Contoh alias/fixed: `GHSA-29mw-wpgm-hmr9`/`CVE-2020-28500`/`4.17.21`, `GHSA-35jh-r3h4-6jhm`/`CVE-2021-23337`/`4.17.21`, `GHSA-xxjr-mmjv-4gpg`/`CVE-2025-13465`/`4.17.23`+`4.18.0`.
  - Fixture netral: `left-pad@1.3.0` 200 tanpa `vulns`. 429/5xx tidak terpicu selama probe `[PERLU DIVERIFIKASI]`; rencana tetap backoff dan error sementara.

### T-W1-04 — Uji unduhan dan parsing CISA KEV
- **Tipe:** `[AGENT]`
- **Tujuan:** Memastikan feed KEV dapat diunduh, diparse, dan disimpan sebagai katalog lokal.
- **Prasyarat:** `T-D0-07`
- **File/folder:** `scripts/probe-kev.mjs`, `fixtures/kev/`, `docs/due-diligence-log.md`
- **Langkah:**
  1. Unduh feed KEV dan catat URL, ukuran, waktu, serta lisensi.
  2. Parse JSON dan verifikasi field `cveID`, `vendorProject`, `product`, `dateAdded`, `knownRansomwareCampaignUse`.
  3. Hitung jumlah entri dan cakupan CVE-only.
  4. Simpan subset fixture dan isi log.
- **Memenuhi:** `FR-08`, `FR-09`, `R-05`
- **Kriteria selesai (AC):**
  - [x] Feed berhasil diunduh dan diparse.
  - [x] Jumlah entri serta field wajib tercatat.
  - [x] Strategi `STALE` > 24 jam diputuskan berdasarkan hasil.
- **Estimasi:** 1 jam
- [x] Tugas selesai
- **Catatan hasil:**
  - Script: `scripts/probe-kev.mjs`; fixture: `fixtures/kev/subset.json` (metadata + 25 entri perwakilan) dan `fixtures/kev/license.txt`.
  - Feed `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`: 200 `application/json`, **1.832.349 byte**, 562 ms, sha256 `47e0406b2be5…`, `catalogVersion=2026.11.06`, `dateReleased=2026-11-06T19:44:45Z`.
  - `count` yang dideklarasikan 1.769 sama dengan jumlah entri nyata; lima field wajib ada di seluruh 1.769 entri; semua `cveID` valid (1.769/1.769 CVE-only).
  - `knownRansomwareCampaignUse`: 361 `Known`, 1.408 `Unknown`; 291 vendor unik; `dateAdded` berkisar 2021-11-03 s.d. 2026-11-06.
  - Lisensi: CC0 1.0 Universal di `https://www.cisa.gov/sites/default/files/licenses/kev/license.txt`; tautan pihak ketiga tetap mengikuti kebijakannya; logo/seal CISA/DHS tidak boleh dipakai.
  - `STALE`: snapshot katalog, jadi umur dihitung dari `fetched_at`/`updated_at` salinan lokal. Salinan > 24 jam memicu refresh; gagal refresh dengan salinan lama → `STALE`; belum ada salinan → `kev=false` + warning parsial.
  - Akses feed dari region Supabase belum diuji `[PERLU DIVERIFIKASI]`.

### T-W1-05 — Uji EPSS per CVE dan batch
- **Tipe:** `[AGENT]`
- **Tujuan:** Menentukan endpoint, format, dan batas query EPSS yang benar.
- **Prasyarat:** `T-D0-07`
- **File/folder:** `scripts/probe-epss.mjs`, `fixtures/epss/`, `docs/due-diligence-log.md`
- **Langkah:**
  1. Query satu CVE dan catat format `epss` serta `percentile`.
  2. Uji query banyak CVE dan catat batas jumlah per request.
  3. Uji CVE tanpa skor, 404, 429, dan respons kosong.
  4. Simpan fixture dan keputusan fallback parsial.
- **Memenuhi:** `FR-10`, `R-05`
- **Kriteria selesai (AC):**
  - [x] Format respons dan batas query tercatat dari pengamatan.
  - [x] Perilaku CVE tanpa skor menghasilkan `null`, bukan angka karangan.
  - [x] Keputusan cache/parsial tercatat.
- **Estimasi:** 1 jam
- [x] Tugas selesai
- **Catatan hasil:**
  - Script: `scripts/probe-epss.mjs`; fixture: `fixtures/epss/single.json`, `batch-3.json`, `batch-limits.json`, `missing.json`, `summary.json`.
  - Format: `epss` dan `percentile` berupa string desimal 0–1; `CVE-2021-44228` → `0.999990000` / `1.000000000` pada `2026-11-08`; body 203 byte; `Cache-Control: public, max-age=86400`.
  - Batch: 3 CVE → `total=3`; urutan `data` tidak mengikuti urutan permintaan, jadi pemetaan harus per `cve`.
  - Default `limit=100`: 100 CVE → 100 data; 101 CVE → `total=101` tetapi data 100; `&limit=1000` mengembalikan seluruh 101/120/133 data.
  - Batas praktis berupa panjang URL: 133 CVE (2.032 byte) berhasil; **134 CVE (2.047 byte) mengembalikan 200 dengan `total=0`/`data=[]`**, bukan error. 150/200/250 juga `total=0`. Karena itu chunk maksimum ditetapkan 100 CVE dan hasil `total=0` untuk permintaan tidak kosong diperlakukan sebagai kegagalan, bukan "semua CVE tidak punya skor".
  - CVE tanpa skor: `CVE-9999-99999` → 200 `total=0`; dipetakan `epss=null`, `percentile=null`, `available=false`. `?cve=` atau tanpa `cve` justru mengembalikan seluruh basis (401.956 entri) sehingga parameter `cve` wajib selalu dikirim.
  - Cache/parsial: cache per CVE 24 jam (termasuk hasil kosong); request gagal + cache ada → pakai cache + parsial; tanpa cache → `null` + `epssAvailable=false`. 429/5xx tidak terpicu `[PERLU DIVERIFIKASI]`.

### T-W1-06 — Buat fixture lockfile ±100, ±500, dan ±1.500 paket
- **Tipe:** `[AGENT]`
- **Tujuan:** Menyediakan bahan uji performa dan parser dengan ukuran paket unik yang terukur.
- **Prasyarat:** `T-W1-01`
- **File/folder:** `fixtures/lockfiles/small-100/`, `medium-500/`, `large-1500/`, `no-lockfile/`, `no-package-json/`, `malformed-lockfile/`, `scripts/count-packages.mjs`
- **Langkah:**
  1. Siapkan tiga proyek npm nyata atau gabungan paket nyata, lalu hasilkan `package-lock.json` v3.
  2. Hitung paket unik (nama, versi) dengan script dan sesuaikan hingga mendekati 100, 500, dan 1.500.
  3. Siapkan fixture tanpa lockfile, tanpa `package.json`, dan lockfile rusak/v1.
  4. Commit hanya manifest/lockfile, bukan `node_modules`.
- **Memenuhi:** `FR-04`, `NFR-09`, `R-06`, `R-07`
- **Kriteria selesai (AC):**
  - [x] `node scripts/count-packages.mjs fixtures/lockfiles/medium-500` melaporkan jumlah unik sesuai target ±10%.
  - [x] Tiga ukuran fixture tersedia dan dapat diparse sebagai JSON.
  - [x] Fixture edge case tersedia.
  - [x] `git ls-files fixtures` tidak memuat `node_modules`.
- **Estimasi:** 2 jam
- [x] Tugas selesai
- **Catatan hasil:**
  - Script: `scripts/count-packages.mjs` (mendukung lockfile v1 `dependencies` dan v2/v3 `packages`; root dan `link` tidak dihitung).
  - `small-100`: **107** paket unik dari 108 entri; `medium-500`: **491** dari 508; `large-1500`: **1.409** dari 1.516. Ketiganya berada dalam target ±10% (90–110, 450–550, 1.350–1.650).
  - Ketiga lockfile ber-`lockfileVersion: 3`, JSON valid, dibuat dengan npm 11.11.1 memakai `npm install --package-lock-only --ignore-scripts` sehingga tidak ada `node_modules`.
  - Edge case: `no-lockfile/` (hanya `package.json`), `no-package-json/` (hanya `package-lock.json`), `malformed-lockfile/` (JSON terpotong, sengaja tidak valid), `lockfile-v1/` (v1 valid, 70 paket unik).
  - `git ls-files fixtures` tidak memuat path `node_modules`; hanya manifest, lockfile, dan script yang di-commit.

### T-W1-07 — Implementasi parser lockfile v2/v3, fallback, dan dedupe
- **Tipe:** `[AGENT]`
- **Tujuan:** Mengubah manifest menjadi daftar paket unik beserta metadata langsung/transitif/dev.
- **Prasyarat:** `T-W1-06`
- **File/folder:** `supabase/functions/scan/lib/lockfile.ts`, `package-json.ts`, `dedupe.ts`, `*.test.ts`
- **Langkah:**
  1. Parse `packages` untuk lockfile v2/v3, termasuk entri root dan `node_modules/*`.
  2. Implementasikan fallback `package.json` dengan `estimated=true` dan hanya dependensi langsung.
  3. Deduplikasi berdasarkan (nama, versi) dan tandai `direct`, `devOnly`, serta `parentPackage`.
  4. Tangani lockfile rusak/v1 dengan warning dan fallback, bukan crash.
  5. Tulis unit test untuk semua jalur.
- **Memenuhi:** `FR-04`, `FR-05`, `FR-12`, `FR-15`, `NFR-16`, `R-07`
- **Kriteria selesai (AC):**
  - [x] Unit test lulus untuk v2, v3, v1, lockfile rusak, dan tanpa lockfile.
  - [x] Jumlah paket unik sama dengan hasil `count-packages.mjs`.
  - [x] Paket dev-only dan transitif memiliki flag yang benar.
  - [x] Input tanpa `package.json` menghasilkan error terklasifikasi, bukan exception mentah.
- **Estimasi:** 3 jam
- [x] Tugas selesai
- **Catatan hasil:**
  - File produksi (tanpa API Node): `supabase/functions/scan/lib/lockfile.ts`, `package-json.ts`, `dedupe.ts`.
  - Test: `supabase/functions/scan/lib/lockfile.test.ts`, `package-json.test.ts`, `dedupe.test.ts`; dijalankan dengan `node --test supabase/functions/scan/lib/*.test.ts` (Node 24 type stripping).
  - Hasil: **18/18 test lulus**. Mencakup v3 (`small-100`, `medium-500`, `large-1500`), v2 inline, v1 fixture, lockfile rusak, tanpa lockfile, tanpa `package.json`, package.json rusak, entri link/workspace/tanpa versi, dedupe, dan fallback range.
  - Jumlah unik parser sama dengan `count-packages.mjs`: **107 / 491 / 1.409**. Flag `direct`, `devOnly`, dan `parentPackage` diuji pada paket langsung produksi (`express`), langsung dev (`nodemon`, `webpack`, `vite`), transitif (`body-parser`), dan nested (`safe-buffer@5.1.2` → parent `basic-auth`).
  - `devOnly` hanya dari `dev === true`; dedupe menggabungkan `direct` dengan OR dan `devOnly` dengan AND. `parentPackage` diambil dari path `node_modules/.../node_modules/...`.
  - Fallback `package.json` hanya dependensi langsung, `estimated=true`, memakai `resolvedVersions` bila diberikan atau batas bawah range; `*`/`latest` dan spesifikasi `git`/`file`/`workspace`/URL dilewati dengan warning.
  - Error terklasifikasi: `NO_PACKAGE_JSON`, `INVALID_PACKAGE_JSON`, `INVALID_MANIFEST_INPUT` (semua `retryable=false`), bukan exception.
  - Typecheck edge function lulus memakai `tsc` dari `app/node_modules` dengan `--strict --noUncheckedIndexedAccess --lib ES2022,DOM --types node --allowImportingTsExtensions`.
  - Benchmark lokal parser (median 5 run): small 0,84 ms; medium 2,42 ms; large 5,28 ms. Ini bukan CPU time Supabase; pengukuran platform tetap di `T-W1-07b`.

### T-W1-07b — Spike CPU dan wall time parser di Supabase
- **Tipe:** `[AGENT]`
- **Tujuan:** Mengukur biaya parse lockfile besar di runtime Supabase yang sebenarnya, bukan hanya lokal, sebelum pipeline diperluas.
- **Prasyarat:** `T-W1-06`, `T-W1-07`
- **File/folder:** `supabase/functions/cpu-spike/index.ts`, `scripts/probe-cpu-supabase.mjs`, `docs/due-diligence-log.md`
- **Langkah:**
  1. Buat fungsi minimal yang memuat fixture ±500 dan ±1.500 paket lalu menjalankan parser dari `T-W1-07`.
  2. Deploy fungsi dan ukur CPU time serta wall time untuk beberapa kali eksekusi.
  3. Kutip batas CPU time platform dari dokumentasi Supabase saat ini; jangan memakai angka dari ingatan.
  4. Catat hasil, persentase terhadap batas, dan keputusan desain di `docs/due-diligence-log.md`.
  5. Tulis keputusan apakah satu fungsi cukup atau perlu optimasi/pecah pekerjaan (mis. ekstrak field yang diperlukan, hindari salinan objek besar).
- **Memenuhi:** `NFR-17`, `R-15`
- **Kriteria selesai (AC):**
  - [x] Hasil CPU time dan wall time kedua ukuran fixture tercatat di `docs/due-diligence-log.md` (wall time terukur; CPU platform tercatat "tidak teramati" dengan bukti runtime, bukan diperkirakan).
  - [x] Ada keputusan tertulis: pipeline satu fungsi cukup, atau daftar optimasi/pemecahan yang akan dipakai.
  - [x] Batas CPU platform dikutip dari dokumentasi Supabase saat ini beserta tanggal akses.
- **Estimasi:** 1,5 jam
- [x] Tugas selesai — diterima memakai batas atas wall time untuk kode sinkron (CPU time ≤ wall time); pengukuran CPU platform dipindahkan ke `T-W1-12d` dan `T-W1-14`.
- **Catatan hasil:**
  - File: `supabase/functions/cpu-spike/index.ts` (sementara, sudah dihapus dari remote), `scripts/probe-cpu-supabase.mjs`, `docs/due-diligence-log.md`.
  - Deploy memakai `npx supabase@latest functions deploy cpu-spike --use-api --yes` pada CLI 3.0.0; Docker tidak terpasang dan tidak diperlukan karena API-based deploy. JWT verification tetap aktif (tanpa `--no-verify-jwt`); invokasi memakai anon key yang diambil CLI di dalam proses skrip dan tidak dicetak/disimpan.
  - Fungsi hanya memuat parser `T-W1-07`, menerima `packageJsonText` + `lockfileText` lewat POST, dan tidak memanggil jaringan eksternal. Runtime: `supabase-edge-runtime-1.78.1 (compatible with Deno v2.1.4)`.
  - **500 paket** (`medium-500`, 491 unik, body 267.718 B): 7 run setelah 1 warmup. Wall klien median **132,984 ms**, terburuk **213,148 ms**; wall handler median **4,719 ms**, terburuk **74,113 ms**; wall parser median **2,990 ms**, terburuk **3,278 ms**.
  - **1.500 paket** (`large-1500`, 1.409 unik, body 846.584 B): 7 run setelah 1 warmup. Wall klien median **86,093 ms**, terburuk **284,429 ms**; wall handler median **20,083 ms**, terburuk **212,529 ms**; wall parser median **9,582 ms**, terburuk **12,412 ms**.
  - **CPU platform tidak teramati.** Respons tidak memuat header CPU. `node:process.cpuUsage` ada tetapi mengembalikan 0, termasuk saat parser diulang 20× (51,135 ms) dan 10× (98,802 ms), sehingga nilai 0 tidak dilaporkan sebagai CPU. Metrik CPU dashboard tidak dapat diakses dari sesi CLI/headless ini. Angka CPU tidak diperkirakan. Bukti pendukung lokal (bukan platform): Node 24.21.0 mengukur median 1.600 µs/parse (500 paket) dan 4.600 µs/parse (1.500 paket).
  - **Batas platform** dikutip dari https://supabase.com/docs/guides/functions/limits (diakses 9 November 2026): CPU time maksimum **2 s** per request; wall clock 150 s (Free)/400 s (Paid); memori 256 MB; bundle 20 MB via CLI atau 5 MB server-side. Rujukan tambahan: https://supabase.com/kb/troubleshooting/edge-function-cpu-limits.
  - **Persentase:** wall parser 500 paket ≈0,15% dan 1.500 paket ≈0,48% dari batas CPU 2.000 ms. Ini rasio wall, bukan CPU; persentase CPU tidak dapat dihitung karena CPU platform tidak terukur. Wall klien median ≈0,09% dan ≈0,06% dari wall clock Free 150 s.
  - **Keputusan desain:** satu Edge Function `scan` cukup untuk `T-W1-11`; parser tidak perlu dioptimasi/dipecah lebih lanjut. `T-W1-12d` wajib memverifikasi CPU dashboard; bila >70% batas, pecah pengayaan per chunk atau pindahkan pekerjaan berat.
  - **Pembersihan remote:** `functions delete cpu-spike` sukses; `functions list` sesudahnya mengembalikan `{"functions":[]}`. Tidak ada migrasi, secrets, atau perubahan fungsi lain.
  - **Penerimaan dengan batas atas:** untuk kode sinkron seperti parser dan handler ini, CPU time tidak dapat melebihi wall time, sehingga wall time dipakai sebagai batas atas CPU. Pada fixture 1.409 paket: parser ≤ **12,412 ms** dan seluruh handler ≤ **212,529 ms** (≈**10,6%** dari batas 2.000 ms). Ini bukan hasil pengukuran CPU; angka CPU tidak diklaim. Pengukuran CPU platform yang sebenarnya dipindahkan ke `T-W1-12d` (log wall sinkron per tahap + pemeriksaan metrik dashboard oleh pengembang) dan `T-W1-14` (keputusan gerbang CPU).

### T-W1-08 — Implementasi resolver semver dan klien npm registry
- **Tipe:** `[AGENT]`
- **Tujuan:** Menentukan versi aman/teoretis yang memenuhi range saat hanya ada `package.json`.
- **Prasyarat:** `T-W1-02`
- **File/folder:** `supabase/functions/scan/lib/semver.ts`, `npm-registry.ts`, `*.test.ts`
- **Langkah:**
  1. Implementasikan perbandingan versi dan pemilihan versi tertinggi yang memenuhi range.
  2. Tangani `^`, `~`, exact, range majemuk, prerelease, dan paket scoped.
  3. Lewati spesifikasi `git`, `file`, `workspace`, dan URL dengan warning.
  4. Tambahkan timeout, cache dalam request, dan pemetaan 404/429.
- **Memenuhi:** `FR-05`, `FR-19`, `NFR-16`, `R-12`
- **Kriteria selesai (AC):**
  - [x] Unit test mencakup `^`, `~`, exact, range majemuk, dan prerelease.
  - [x] Spesifikasi non-registry dilewati dengan warning, bukan crash.
  - [x] Timeout/404/429 menghasilkan hasil parsial atau error terklasifikasi.
- **Estimasi:** 2 jam
- [x] Tugas selesai
- **Catatan hasil:**
  - File produksi (tanpa API Node): `supabase/functions/scan/lib/semver.ts` dan `npm-registry.ts`.
  - Test: `supabase/functions/scan/lib/semver.test.ts` dan `npm-registry.test.ts`; dijalankan dengan `node --test supabase/functions/scan/lib/*.test.ts` (Node 24 type stripping).
  - Hasil: **21/21 test baru lulus**; total 39/39 test edge lulus. Typecheck edge lulus dengan `tsc` strict dari `app/node_modules`.
  - `semver.ts` mendukung perbandingan versi, `^`, `~`, exact, wildcard (`x`/`*`), range majemuk, hyphen, OR (`||`), dan aturan prerelease npm. `maxSatisfying` memilih versi tertinggi dan mengabaikan string tidak valid.
  - `npm-registry.ts`: `NpmRegistryClient` dengan default `https://registry.npmjs.org`, timeout 5.000 ms via `AbortController`, cache packument + hasil resolusi per instance (satu klien per request scan, termasuk cache kegagalan), nama scoped di-encode (`@types/node` → `@types%2Fnode`), dan dukungan dist-tag (`latest`, `next`, dst.).
  - Pemetaan error: 404 → `NOT_FOUND` (tidak retryable); 429 → `RATE_LIMITED` (retryable, `retryAfterMs` dari header); timeout → `TIMEOUT` (retryable); 5xx/jaringan → retryable; 4xx lain → `HTTP_ERROR` (tidak retryable); JSON/struktur rusak → `INVALID_RESPONSE`; non-registry → `NON_REGISTRY_SPEC`; tanpa versi cocok → `NO_MATCHING_VERSION`.
  - `resolveMany` memproses dependensi langsung dengan konkurensi terbatas (default 6), mengumpulkan `resolved`, `warnings`, `failed`, dan `partial` tanpa menghentikan paket lain. Spesifikasi `git`/`file`/`workspace`/URL hanya menjadi warning.
  - Unit test tidak melakukan panggilan jaringan nyata; `fetch` selalu disuntikkan lewat `fetchImpl`, termasuk kasus timeout dengan fetch palsu yang menghormati `AbortSignal`.
  - Cache dan timeout berlaku per instance/request; pengukuran latensi registry nyata bukan bagian tugas ini dan tetap dicatat saat uji integrasi.

### T-W1-09 — Normalisasi severity dan klasifikasi paket
- **Tipe:** `[AGENT]`
- **Tujuan:** Menghasilkan severity seragam dan klasifikasi langsung/transitif/dev yang konsisten.
- **Prasyarat:** `T-W1-03`, `T-W1-07`
- **File/folder:** `supabase/functions/scan/lib/severity.ts`, `classify.ts`, `*.test.ts`
- **Langkah:**
  1. Petakan severity OSV ke `CRITICAL/HIGH/MEDIUM/LOW/UNKNOWN` dengan urutan prioritas sumber.
  2. Normalisasi alias GHSA/CVE untuk pencocokan KEV/EPSS.
  3. Implementasikan klasifikasi langsung/transitif/dev dari data lockfile.
  4. Tulis unit test termasuk kasus severity kosong dan alias tidak lengkap.
- **Memenuhi:** `FR-11`, `FR-12`, `NFR-16`, `R-03`, `R-04`
- **Kriteria selesai (AC):**
  - [x] Tabel pemetaan severity diuji untuk setiap level.
  - [x] Advisory tanpa severity menjadi `UNKNOWN`, bukan ditebak.
  - [x] Alias GHSA–CVE cocok pada fixture.
  - [x] Flag direct/transitive/dev benar pada fixture 500 paket.
- **Estimasi:** 1,5 jam
- [x] Tugas selesai
- **Catatan hasil:**
  - File baru: `supabase/functions/scan/lib/severity.ts`, `classify.ts`, `severity.test.ts`, `classify.test.ts`. Tidak ada API Node dan tidak ada panggilan jaringan; modul aman untuk Deno.
  - Urutan severity tegas: `severity` terstruktur CVSS_V3 (skor dasar dihitung dari vektor) → `database_specific.severity` (termasuk saat hanya CVSS_V4; `MODERATE` → `MEDIUM`) → `UNKNOWN`. CVSS_V3 yang valid selalu menang atas `database_specific`. Advisory tanpa sumber severity tidak ditebak.
  - Alias dari `id` + `aliases` dinormalisasi huruf besar, hanya pola GHSA/CVE yang diterima, lalu dideduplikasi dan diurutkan; helper `advisoryMatchesId` dipakai untuk pencocokan KEV/EPSS tanpa peka huruf besar/kecil. Advisory GHSA tanpa CVE menghasilkan daftar CVE kosong (R-04).
  - Klasifikasi memakai flag hasil parser (`direct`/`devOnly`), bukan menebak dari nama; `classifyPackages` menambah `transitive` dan `packageTags` menghasilkan tag `langsung`/`transitif` + `dev`.
  - Buffer test: 13 test baru. `node --test supabase/functions/scan/lib/*.test.ts` → 52 lulus. Typecheck strict modul baru lulus. `npm run lint`, `npm run typecheck`, dan `npm test -- --ci` di `app/` lulus.

### T-W1-10 — Implementasi mesin label, skor, alasan, dan pengurutan
- **Tipe:** `[AGENT]`
- **Tujuan:** Menerapkan aturan prioritas PRD §11 secara konsisten dan dapat diuji.
- **Prasyarat:** `T-W1-09`
- **File/folder:** `supabase/functions/scan/lib/label.ts`, `score.ts`, `sort.ts`, `reason.ts`, `*.test.ts`
- **Langkah:**
  1. Implementasikan aturan `FIX_NOW → SCHEDULE → MONITOR` berurutan.
  2. Hitung skor 0–100 sebagai alat urut, bukan penentu label.
  3. Hasilkan alasan satu kalimat berbahasa Indonesia untuk setiap temuan.
  4. Implementasikan pengurutan label → KEV → skor → EPSS → nama paket.
  5. Uji seluruh contoh PRD §11.5 dan kasus batas ambang.
- **Memenuhi:** `FR-13`, `FR-14`, `NFR-16`, `R-11`
- **Kriteria selesai (AC):**
  - [x] Semua skenario tabel PRD §11.5 menghasilkan label dan skor yang sama.
  - [x] 100% temuan pada fixture mendapat alasan tidak kosong.
  - [x] Urutan stabil saat skor dan EPSS sama.
  - [x] Unit test lulus.
- **Estimasi:** 2,5 jam
- [x] Tugas selesai
- **Catatan hasil:**
  - File baru: `supabase/functions/scan/lib/priority-config.ts` (satu tempat untuk `EPSS_FIX_NOW_THRESHOLD=0,10`, `EPSS_SCHEDULE_THRESHOLD=0,05`, daftar severity SCHEDULE, bobot skor severity, faktor/batas EPSS, batas skor, peringkat label, dan `ENGINE_VERSION`), `label.ts`, `score.ts`, `reason.ts`, `sort.ts`, serta `label.test.ts`, `score.test.ts`, `reason.test.ts`, `sort.test.ts`.
  - Label diterapkan berurutan: KEV → Critical + EPSS ≥ 0,10 → HIGH/CRITICAL → EPSS ≥ 0,05 → MONITOR. Ambang inklusif; EPSS `null`/tidak tersedia/tidak valid diperlakukan 0 dan dijepit ke 0–1. Skor = poin severity + `min(35, epss × 100 × 0,35)`, dibatasi 100, dibulatkan satu desimal; skor tidak menentukan label.
  - Alasan satu kalimat Indonesia memakai templat PRD §11.6; tidak menyebut KEV saat `kev=false` dan tidak menyebut EPSS saat `epssAvailable=false`. Persen desimal memakai koma (mis. `6,2%`).
  - Pengurutan: label → KEV → skor turun → EPSS turun → nama paket A–Z → versi → OSV id. `sortFindings` menyalin daftar sehingga masukan tidak berubah.
  - Buffer test: 23 test baru. Skenario A–F PRD §11.5 lulus untuk label, skor, alasan, dan urutan; batas tepat 0,10/0,05 dan di bawahnya diuji; seluruh 40 advisory fixture menghasilkan alasan tidak kosong. `node --test supabase/functions/scan/lib/*.test.ts` → 75 lulus. Typecheck strict modul+test lulus. `npm run lint`, `npm run typecheck`, dan `npm test -- --ci` di `app/` lulus.

### T-W1-11 — Edge Function `scan` tahap 1: validasi, fetch, dan error terstandar
- **Tipe:** `[AGENT]`
- **Tujuan:** Menyediakan endpoint `scan` yang memvalidasi input, mengambil manifest, dan mengembalikan error sesuai kontrak.
- **Prasyarat:** `T-W1-01`, `T-W1-07`, `T-W1-07b`, `T-W1-08`
- **File/folder:** `supabase/functions/scan/index.ts`, `validate.ts`, `errors.ts`, `contract.ts`
- **Langkah:**
  1. Implementasikan validasi owner/repo dan bentuk URL tanpa SSRF.
  2. Ambil metadata default branch serta manifest dari GitHub dengan token server.
  3. Petakan `400/403/404/413/429/502/504` dan `requestId` sesuai PRD §9.4/§12.
  4. Kembalikan respons manifest-only yang sesuai bentuk kontrak §9.
  5. Uji dengan fetch tiruan untuk seluruh jalur validasi/pemetaan error (Docker tidak tersedia), lalu deploy `scan --use-api` dan jalankan uji integrasi remote.
- **Memenuhi:** `FR-01`, `FR-02`, `FR-03`, `FR-24`, `NFR-02`, `NFR-04`, `NFR-12`, `R-02`
- **Kriteria selesai (AC):**
  - [x] Repo valid mengembalikan 200 dengan `scanId` dan `requestId`.
  - [x] URL tidak valid, host lain, path tambahan, repo privat, dan repo tidak ada menghasilkan kode yang benar.
  - [x] Tidak ada fetch ke host selain GitHub.
  - [x] Log mencatat durasi fetch tanpa data sensitif.
  - [x] Seluruh jalur validasi dan pemetaan error diuji dengan fetch tiruan yang gagal bila host di luar allowlist.
  - [x] Uji integrasi remote mencatat status dan `requestId` tiap kasus.
- **Estimasi:** 2,5 jam
- [x] Tugas selesai
- **Catatan hasil:**
  - File baru: `supabase/functions/scan/contract.ts`, `validate.ts`, `errors.ts`, `github.ts`, `handler.ts`, `index.ts`, `validate.test.ts`, `github.test.ts`, `handler.test.ts`, dan `scripts/probe-scan.mjs`. `TASKS.md` dan `docs/due-diligence-log.md` diperbarui. `docs/PRD.md` tidak diubah.
  - Validasi hanya menerima `https://github.com/{pemilik}/{repo}` persis; menolak skema lain, userinfo, port, host lain/IP/localhost, `/tree`/`/blob`/query/fragmen/trailing slash, encoding persen, karakter kontrol, dot, panjang berlebih, dan huruf campuran menipu (mis. `GitHub.com`).
  - Fetch dibatasi allowlist `api.github.com` + `raw.githubusercontent.com`; redirect 3xx tidak diikuti; setiap fetch memakai `AbortController` (timeout 8 dtk); body dibatasi 5 MB dan 2.000 paket (413). Token hanya dikirim ke `api.github.com`, tidak ke `raw.githubusercontent.com`.
  - Log hanya `requestId`, `owner`, `repo`, `status`, `githubMs`, `totalMs`; token dan isi manifest tidak pernah dicatat atau dikembalikan.
  - Unit test: 30 test baru (total suite 105) lulus; typecheck `strict` + `noUncheckedIndexedAccess` lulus; `app` lint/typecheck/test lulus.
  - Docker tidak tersedia: langkah 5 diganti unit test fetch tiruan + deploy `scan --use-api --yes` (JWT aktif) + `node scripts/probe-scan.mjs`. Lihat Catatan Keputusan 9 November 2026.
  - Hasil uji integrasi remote (status/`requestId`):

    | Kasus | Status | Hasil | `requestId` |
    |---|---|---|---|
    | `axios/axios` (lockfile v3) | 200 | `LOCKFILE`, v3, 679 paket | `req_43508a45d36e4cdb8c85804031085f25` |
    | `lodash/lodash` (lockfile v1 → fallback) | 200 | `PACKAGE_JSON`, estimated, 27 paket | `req_e5a85122f9e14549a2e826aeada4f265` |
    | `expressjs/express` (tanpa lockfile) | 200 | `PACKAGE_JSON`, 44 paket | `req_082f8871f6624b22b3c37507761b2bc9` |
    | Repo tidak ada | 404 | `REPO_NOT_FOUND_OR_PRIVATE` | `req_acafc7336b9544de8202002f04e49504` |
    | `bukan-url` | 400 | `INVALID_URL` | `req_82d6c881b43040f4a00a8bbcab0889e4` |
    | `https://gitlab.com/lodash/lodash` | 400 | `INVALID_URL` | `req_9f9a5a76cdbf4727b6aa6b08d22f3f25` |
    | Path tambahan | 400 | `INVALID_URL` | `req_777fe7b59b2449c59161b522caae5c78` |
    | `https://GitHub.com/...` | 400 | `INVALID_URL` | `req_8e5ba791da39455a8100a6a359c383d7` |
    | Tanpa JWT | 401 | ditolak gateway (JWT aktif) | — |

  - 403 repo privat belum dapat dipicu remote (tidak ada repo privat yang boleh diuji); pemetaan 403 privat dan 403 rate-limit (`x-ratelimit-remaining: 0`) dicakup unit test. GitHub tidak membedakan 404 “tidak ada” dan 404 privat, sehingga memakai kode gabungan PRD.
  - **Pengingat normalisasi tautan:** normalisasi tautan di UI (trim, huruf kecil untuk skema dan host, buang `.git` dan `/` di ujung) dikerjakan pada tugas layar Pindai Minggu 2 (`T-W2-02`), **bukan** di fungsi `scan`. Validator server tetap ketat: `https://github.com/o/r.git` saat ini diterima apa adanya dengan `repo="r.git"` (belum dinormalisasi), sedangkan `https://github.com/o/r/` ditolak `EXTRA_PATH`. Perilaku ini dicatat di `validate.test.ts`.
  - Respons memakai bentuk manifest-only: `findings: []`, `summary.affectedPackages=0`, `summary.findingCount=0`, `sourceStatus` hanya `{github:"OK"}`, `persisted:false` sampai pengayaan/penyimpanan pada tugas berikutnya.

### T-W1-12a — OSV batch, cache, dan penyusunan findings dasar
- **Tipe:** `[AGENT]`
- **Tujuan:** Mengambil advisory OSV secara batch, menyimpannya di cache, dan membentuk findings dasar.
- **Prasyarat:** `T-W1-03`, `T-W1-09`, `T-W1-11`
- **File/folder:** `supabase/migrations/<timestamp>_osv_cache.sql`, `supabase/functions/scan/osv.ts`, `findings.ts`, `*.test.ts`
- **Langkah:**
  1. Buat migrasi tabel `osv_cache` sesuai PRD §8.1.
  2. Query OSV per chunk dan tangani 429/5xx dengan retry terbatas.
  3. Cache hasil per (paket, versi), termasuk hasil negatif.
  4. Susun findings dasar berisi `osvId`, alias CVE, paket, dan versi terpasang.
  5. Tulis unit test untuk cache hit, cache miss, dan advisory kosong.
- **Memenuhi:** `FR-06`, `FR-07`
- **Kriteria selesai (AC):**
  - [ ] Chunk OSV berjalan dan hasilnya tersimpan di `osv_cache`.
  - [ ] Scan kedua untuk paket yang sama memakai cache, bukan memanggil OSV lagi.
  - [ ] Findings dasar memuat ID advisory dan alias yang benar.
  - [ ] Unit test cache dan findings lulus.
- **Estimasi:** 1,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W1-12b — Katalog KEV: refresh lazy, `STALE`, dan pencocokan alias
- **Tipe:** `[AGENT]`
- **Tujuan:** Mencocokkan findings dengan CISA KEV memakai katalog yang diperbarui secara lazy.
- **Prasyarat:** `T-W1-04`, `T-W1-09`, `T-W1-12a`
- **File/folder:** `supabase/migrations/<timestamp>_kev_entries.sql`, `supabase/functions/scan/kev.ts`, `kev-match.ts`, `*.test.ts`
- **Langkah:**
  1. Buat migrasi tabel `kev_entries` sesuai PRD §8.1.
  2. Muat katalog dari salinan lokal dan refresh hanya bila salinan > 24 jam.
  3. Tandai `STALE` bila refresh gagal tetapi salinan lama tersedia.
  4. Cocokkan seluruh alias GHSA/CVE dan set `kev=true` pada findings terkait.
  5. Uji kondisi katalog kosong, katalog basi, dan alias tidak lengkap.
- **Memenuhi:** `FR-08`, `FR-09`, `R-05`
- **Kriteria selesai (AC):**
  - [ ] Refresh hanya terjadi saat salinan > 24 jam.
  - [ ] Salinan lama yang gagal diperbarui ditandai `STALE`.
  - [ ] Temuan dengan CVE di KEV mendapat `kev=true` lewat alias mana pun.
  - [ ] Katalog belum tersedia tidak membuat scan crash.
- **Estimasi:** 1,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W1-12c — EPSS, hasil parsial, `persisted`, dan respons final
- **Tipe:** `[AGENT]`
- **Tujuan:** Melengkapi pengayaan EPSS dan menyusun respons final sesuai kontrak PRD §9.
- **Prasyarat:** `T-W1-05`, `T-W1-10`, `T-W1-12b`
- **File/folder:** `supabase/functions/scan/epss.ts`, `response.ts`, `index.ts`, `*.test.ts`
- **Langkah:**
  1. Ambil EPSS per CVE dan set `null` bila tidak tersedia.
  2. Bangun `partial`, `warnings[]`, dan kode warning untuk sumber yang gagal.
  3. Set `persisted` sebagai boolean, default `false` sampai penyimpanan cloud tersedia.
  4. Susun label, skor, alasan, ringkasan, dan urutan findings final sesuai PRD §9/§11.
  5. Uji respons lengkap dan respons dengan EPSS gagal.
- **Memenuhi:** `FR-10`, `FR-13`, `FR-23`, `R-05`
- **Kriteria selesai (AC):**
  - [ ] Respons memuat seluruh field kontrak §9, termasuk `partial`, `warnings`, dan `persisted`.
  - [ ] EPSS gagal menghasilkan 200 dengan `partial=true` dan warning.
  - [ ] Label, skor, alasan, dan urutan sesuai unit test mesin label.
  - [ ] `persisted` selalu ada sebagai boolean.
  - [ ] Unit test mencakup EPSS `total=0` pada permintaan tidak kosong dan chunk lebih dari 100 CVE.
- **Estimasi:** 1,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W1-12d — Deploy remote, simulasi kegagalan, dan log CPU per sumber
- **Tipe:** `[AGENT]`
- **Tujuan:** Membuktikan pipeline berjalan di Supabase dan berperilaku benar saat sumber eksternal gagal.
- **Prasyarat:** `T-W1-07b`, `T-W1-12c`
- **File/folder:** `supabase/functions/scan/index.ts`, `scripts/probe-scan-failures.mjs`, `docs/due-diligence-log.md`
- **Langkah:**
  1. Terapkan seluruh migrasi Minggu 1 dan deploy fungsi `scan`.
  2. Simulasikan EPSS gagal dan pastikan respons 200 parsial dengan warning.
  3. Simulasikan OSV gagal total dan pastikan respons 502 tanpa hasil sukses.
  4. Simulasikan KEV tidak tersedia/basi dan catat perilaku `STALE` atau parsial.
  5. Catat `requestId`, durasi per sumber, dan CPU/wall time di log.
- **Memenuhi:** `NFR-01`, `NFR-02`, `NFR-06`, `NFR-08`, `NFR-17`, `R-05`, `R-15`
- **Kriteria selesai (AC):**
  - [ ] Endpoint remote Supabase mengembalikan 200 untuk repo uji.
  - [ ] EPSS gagal menghasilkan 200, `partial=true`, dan warning yang benar.
  - [ ] OSV gagal total menghasilkan 502 tanpa baris scan sukses.
  - [ ] KEV tidak tersedia menghasilkan parsial atau `STALE`, bukan crash.
  - [ ] Log memuat durasi per sumber dan CPU time.
  - [ ] Log wall time per tahap sinkron: parse KEV, pencocokan alias, penyusunan findings, skor/label, dan serialisasi respons; jumlah wall time tahap sinkron dihitung dan dicatat sebagai batas atas CPU pipeline.
  - [ ] `[MANUAL]` Pengembang memeriksa metrik fungsi `scan` di dashboard Supabase dan melaporkan apakah CPU time ditampilkan; hasilnya dicatat di `docs/due-diligence-log.md`.
- **Estimasi:** 1,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W1-14 — `[GATE]` Go/No-Go Minggu 1
- **Tipe:** `[GATE]`
- **Tujuan:** Memutuskan kelayakan pipeline berdasarkan bukti API, performa, CPU, dan penanganan parsial.
- **Prasyarat:** `T-W1-01` s.d. `T-W1-11`, `T-W1-07b`, `T-W1-12a` s.d. `T-W1-12d`
- **File/folder:** `docs/due-diligence-log.md`, `docs/week1-gate.md`
- **Langkah:**
  1. Jalankan kelima script API dan pastikan log due diligence lengkap.
  2. Ukur wall time tiga fixture ±100/±500/±1.500 paket.
  3. Gunakan hasil `T-W1-07b` dan ukur ulang CPU time pada fixture ≥400 dan ≥1.500 paket; bandingkan dengan batas platform.
  4. Uji timeout, hasil parsial, dan kegagalan satu sumber.
  5. Tetapkan target p95 dan batas atas final; catat keputusan gerbang API/data, performa, CPU, dan batas keras. Gerbang anonymous sign-in dijadwalkan eksplisit ke `T-W3-03` sesuai jadwal verifikasi PRD §13.
- **Memenuhi:** `NFR-01`, `NFR-09`, `NFR-17`, `R-06`, `R-15`
- **Kriteria selesai (AC):**
  - [ ] Semua gerbang §13.1 yang dapat diuji Minggu 1 punya verdict Go/No-Go beserta bukti.
  - [ ] Gerbang anonymous sign-in tercatat akan diputuskan pada `T-W3-03`.
  - [ ] Target p95 dan batas atas final tertulis di `docs/week1-gate.md`.
  - [ ] CPU time < batas platform, atau mitigasi R-15 dipilih dan dicatat.
  - [ ] Keputusan CPU memakai batas atas sinkron (jumlah wall time tahap sinkron) dan hasil metrik dashboard `T-W1-12d`; bila batas atas > 70% dari 2 s untuk fixture 500 paket, pekerjaan dipecah per chunk atau dipindahkan (R-15).
  - [ ] Tidak ada blocker tanpa rencana tindak lanjut.
- **Estimasi:** 2 jam
- [ ] Tugas selesai
- **Catatan hasil:**

---

## Minggu 2 — Aplikasi Expo

### T-W2-01 — Tema, layout, dan navigasi tiga tab
- **Tipe:** `[AGENT]`
- **Tujuan:** Membangun kerangka UI yang konsisten untuk Pindai, Riwayat, dan Tentang.
- **Prasyarat:** `T-D0-06`, `T-W1-14`
- **File/folder:** `app/app/_layout.tsx`, `app/app/(tabs)/_layout.tsx`, `app/src/theme/`, `app/src/components/`
- **Langkah:**
  1. Definisikan warna, spasi, tipografi, dan komponen dasar.
  2. Buat tab Pindai, Riwayat, dan Tentang dengan ikon serta label Indonesia.
  3. Terapkan safe area dan perilaku keyboard.
  4. Siapkan grup rute `scan/` sebagai placeholder agar Hasil/Detail dapat ditambahkan tanpa mengubah layout.
- **Memenuhi:** `FR-17` (shell), `FR-26` (shell), `NFR-11` (M), `NFR-13`
- **Kriteria selesai (AC):**
  - [ ] Tiga tab tampil dan dapat berpindah tanpa crash.
  - [ ] Seluruh label berbahasa Indonesia.
  - [ ] Tampilan aman pada layar kecil dan mode teks besar.
  - [ ] Typecheck dan lint lulus.
  - [ ] Aplikasi diuji di Expo Go pada iPhone dan versi iOS dicatat; verifikasi APK Android dilakukan di `T-W2-08`.
- **Estimasi:** 2,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W2-02 — Layar Pindai dan validasi URL
- **Tipe:** `[AGENT]`
- **Tujuan:** Memungkinkan pengguna menempel tautan repo dengan validasi lokal yang jelas.
- **Prasyarat:** `T-W2-01`
- **File/folder:** `app/app/(tabs)/index.tsx`, `app/src/lib/url.ts`, `app/src/lib/url.test.ts`
- **Langkah:**
  1. Implementasikan validasi format `https://github.com/owner/repo`.
  2. Tampilkan error inline untuk input kosong, host lain, path tambahan, dan query.
  3. Tambahkan state loading, tombol nonaktif, timeout klien 30 detik, dan penjelasan setelah 5 detik.
  4. Tulis unit test untuk seluruh kasus validasi.
- **Memenuhi:** `FR-01`, `FR-02`, `FR-17`, `NFR-04`, `R-02`
- **Kriteria selesai (AC):**
  - [ ] Semua kasus FR-01/§12 baris 1–4 menghasilkan pesan yang sesuai.
  - [ ] URL valid mengaktifkan tombol Pindai.
  - [ ] Selama loading tombol tidak dapat ditekan ganda.
  - [ ] Unit test validasi lulus.
- **Estimasi:** 3 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W2-03 — Klien API `scan` dan tipe kontrak
- **Tipe:** `[AGENT]`
- **Tujuan:** Menghubungkan aplikasi ke Edge Function dengan parsing kontrak yang ketat.
- **Prasyarat:** `T-W1-12d`, `T-W2-01`
- **File/folder:** `app/src/api/scan.ts`, `app/src/types/scan.ts`, `app/src/api/scan.test.ts`
- **Langkah:**
  1. Definisikan tipe respons sukses, parsial, error, dan `warnings`.
  2. Implementasikan pemanggilan dengan anon key dan hook header JWT; JWT anonim diaktifkan pada `T-W3-03`.
  3. Petakan error server menjadi pesan pengguna beserta `requestId`.
  4. Tangani `persisted=false` dan `partial=true` tanpa menganggap scan gagal.
  5. Uji dengan respons fixture nyata.
- **Memenuhi:** `FR-02`, `FR-23`, `FR-24`, `NFR-02`, `NFR-03`, `NFR-06`, `R-11`
- **Kriteria selesai (AC):**
  - [ ] Respons 200, parsial, dan error terpetakan dengan benar.
  - [ ] `persisted` dan `warnings` tersedia di tipe dan tidak dibuang.
  - [ ] Tidak ada token/secret di kode klien.
  - [ ] Test parsing lulus untuk fixture sukses dan error.
- **Estimasi:** 2 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W2-04 — Layar Hasil
- **Tipe:** `[AGENT]`
- **Tujuan:** Menampilkan ringkasan dan daftar temuan yang dapat dipindai cepat.
- **Prasyarat:** `T-W2-02`, `T-W2-03`
- **File/folder:** `app/app/scan/[scanId]/index.tsx`, `app/src/components/FindingCard.tsx`, `app/src/components/Banner.tsx`
- **Langkah:**
  1. Tampilkan repo, waktu scan, header jumlah paket/terimbas, dan banner parsial/perkiraan.
  2. Render kartu dengan nama, versi, label, severity, KEV/EPSS, tag, dan alasan.
  3. Tampilkan indikator progres/banner untuk repo 501–2.000 paket.
  4. Implementasikan empty state hati-hati dan navigasi ke Detail.
- **Memenuhi:** `FR-15`, `FR-16`, `FR-17`, `NFR-01`, `R-11`
- **Kriteria selesai (AC):**
  - [ ] Header menampilkan teks persis `"{totalPackages} paket diperiksa, {affectedPackages} punya temuan"`.
  - [ ] Setiap kartu memuat seluruh field FR-17.
  - [ ] Banner parsial/perkiraan dan indikator repo besar tampil sesuai kondisi.
  - [ ] Tap kartu membuka Detail.
  - [ ] Empty state tidak mengklaim proyek aman.
- **Estimasi:** 3 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W2-05 — Layar Detail dan perintah salin
- **Tipe:** `[AGENT]`
- **Tujuan:** Menjelaskan satu temuan dan memberi langkah perbaikan yang tepat konteks.
- **Prasyarat:** `T-W2-04`
- **File/folder:** `app/app/scan/[scanId]/finding/[findingId].tsx`, `app/src/lib/command.ts`, `app/src/lib/command.test.ts`
- **Langkah:**
  1. Tampilkan severity, KEV/EPSS, deskripsi, referensi, dan versi aman.
  2. Tampilkan `npm install paket@versi` hanya untuk dependensi langsung.
  3. Untuk transitif, tampilkan saran memperbarui paket induk atau `npm audit fix`.
  4. Implementasikan tombol salin dan umpan balik berhasil.
  5. Tampilkan badge Perkiraan bila relevan.
- **Memenuhi:** `FR-16`, `FR-18`, `FR-19`, `R-12`
- **Kriteria selesai (AC):**
  - [ ] Detail memuat referensi dan versi aman.
  - [ ] Perintah hanya muncul untuk dependensi langsung.
  - [ ] Tombol salin menyalin teks yang benar dan memberi konfirmasi.
  - [ ] Badge Perkiraan tampil untuk hasil fallback.
- **Estimasi:** 2,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W2-06 — Layar Riwayat (UI) dan Tentang
- **Tipe:** `[AGENT]`
- **Tujuan:** Menyediakan kerangka riwayat dan halaman Tentang yang jujur tentang keterbatasan.
- **Prasyarat:** `T-W2-01`
- **File/folder:** `app/app/(tabs)/riwayat.tsx`, `app/app/(tabs)/tentang.tsx`
- **Langkah:**
  1. Buat daftar riwayat dengan empty state dan placeholder data.
  2. Isi Tentang: tujuan, tiga label, sumber data, privasi, dan daftar keterbatasan.
  3. Tambahkan disclaimer bahwa hasil bersifat potensial, bukan jaminan aman.
  4. Pastikan teks tidak menjanjikan pemulihan riwayat setelah uninstall.
- **Memenuhi:** `FR-20` (UI), `FR-26`, `R-10`, `R-11`
- **Kriteria selesai (AC):**
  - [ ] Empty state Riwayat tampil tanpa crash.
  - [ ] Tentang memuat disclaimer dan keterbatasan utama.
  - [ ] Tidak ada klaim "proyek aman" atau janji pemulihan data.
  - [ ] Seluruh teks berbahasa Indonesia.
- **Estimasi:** 2 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W2-07 — Aksesibilitas dasar dan konsistensi bahasa
- **Tipe:** `[AGENT]`
- **Tujuan:** Memenuhi bagian M dari NFR-11 sebelum build percobaan.
- **Prasyarat:** `T-W2-04`, `T-W2-05`, `T-W2-06`
- **File/folder:** `app/src/components/`, `app/src/theme/`, string UI
- **Langkah:**
  1. Tambahkan `accessibilityLabel` pada tombol dan ikon penting.
  2. Verifikasi ukuran teks mengikuti pengaturan sistem.
  3. Periksa kontras teks dasar pada tema terang.
  4. Sapu seluruh string untuk memastikan bahasa Indonesia.
- **Memenuhi:** `NFR-11` (M), `NFR-13`
- **Kriteria selesai (AC):**
  - [ ] Semua tombol memiliki label aksesibel.
  - [ ] Teks tetap terbaca pada ukuran font sistem terbesar.
  - [ ] Tidak ada string Inggris yang terlihat pengguna.
  - [ ] Aplikasi diuji di Expo Go pada iPhone dan versi iOS dicatat; verifikasi APK Android dilakukan di `T-W2-08`.
- **Estimasi:** 1,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W2-08 — `[MANUAL]` Build EAS percobaan dan pemasangan di perangkat
- **Tipe:** `[MANUAL]`
- **Tujuan:** Membuktikan pipeline build Android berjalan sebelum minggu-minggu akhir.
- **Prasyarat:** `T-D0-04`, `T-W2-04`, `T-W2-07`
- **File/folder:** `app/eas.json`, artefak build di luar repo
- **Langkah:**
  1. Konfigurasi profil `preview` untuk APK.
  2. Jalankan build EAS dan unduh artefak.
  3. Pasang APK di emulator Android atau HP Android pinjaman, lalu jalankan alur Pindai→Hasil→Detail.
  4. Periksa bundle untuk secret dan catat hasil build.
- **Memenuhi:** `NFR-03`, `NFR-10`, `NFR-13`, `R-14`
- **Kriteria selesai (AC):**
  - [ ] Build EAS selesai tanpa error.
  - [ ] APK terpasang di emulator Android atau HP Android pinjaman dan alur utama berjalan.
  - [ ] Tidak ada secret di bundle.
  - [ ] Log build, model perangkat/emulator, dan versi Android tercatat.
- **Estimasi:** 2 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W2-09 — `[GATE]` Gate Minggu 2
- **Tipe:** `[GATE]`
- **Tujuan:** Memastikan UI dan integrasi siap masuk ke pekerjaan offline/cloud.
- **Prasyarat:** `T-W2-01` s.d. `T-W2-08`
- **File/folder:** `docs/week2-gate.md`
- **Langkah:**
  1. Uji alur Pindai→Hasil→Detail di Expo Go pada iPhone; verifikasi APK Android di emulator atau HP Android pinjaman.
  2. Uji seluruh kasus validasi URL.
  3. Verifikasi field kartu, banner, indikator progres, dan empty state.
  4. Verifikasi tidak ada secret di APK.
  5. Catat verdict dan blocker.
- **Memenuhi:** `FR-17`, `NFR-03`, `NFR-10`, `NFR-13`, `R-13`, `R-14`
- **Kriteria selesai (AC):**
  - [ ] Alur utama lulus di Expo Go iPhone dan APK Android (emulator atau HP pinjaman).
  - [ ] Seluruh field FR-17 ada pada kartu.
  - [ ] Build EAS percobaan berhasil.
  - [ ] Verdict Go/No-Go tercatat.
- **Estimasi:** 1,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W2-10 — `[MANUAL]` Rekrut dan jadwalkan penguji
- **Tipe:** `[MANUAL]`
- **Tujuan:** Memastikan sesi validasi Minggu 4 punya peserta dan tanggal sebelum build rilis selesai.
- **Prasyarat:** `T-W2-04`
- **File/folder:** `docs/validation-results.md` (bagian jadwal)
- **Langkah:**
  1. Susun daftar minimal 5 calon penguji; cukup nama panggilan, tanpa data pribadi.
  2. Tawarkan slot tanggal tentatif di Minggu 4 dan konfirmasi ke setiap calon.
  3. Catat tanggal, kanal konfirmasi, dan status konfirmasi.
  4. Perbarui jadwal bila ada yang membatalkan.
- **Memenuhi:** `R-13`
- **Kriteria selesai (AC):**
  - [ ] Daftar berisi minimal 5 calon penguji dengan nama panggilan saja.
  - [ ] Minimal 5 orang sudah mengonfirmasi tanggal sesi.
  - [ ] Tidak ada data pribadi selain nama panggilan yang disimpan.
- **Estimasi:** 0,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

---

## Minggu 3 — Offline, Cloud, dan Error

### T-W1-13 — (S) Cache EPSS `epss_cache` *(dipindah dari Minggu 1)*
- **Tipe:** `[AGENT]`
- **Tujuan:** Mengurangi panggilan EPSS berulang tanpa mengorbankan kemampuan fallback.
- **Prasyarat:** `T-W1-12c`
- **File/folder:** `supabase/migrations/<timestamp>_epss_cache.sql`, `supabase/functions/scan/epss.ts`
- **Langkah:**
  1. Buat tabel `epss_cache` dengan `cve_id`, `epss`, `percentile`, dan `fetched_at`.
  2. Terapkan TTL dan baca/tulis cache di alur EPSS.
  3. Pastikan cache miss atau tabel tidak tersedia tetap menghasilkan parsial, bukan crash.
- **Memenuhi:** `FR-10`, `NFR-15`, `R-05`
- **Kriteria selesai (AC):**
  - [ ] Scan kedua dengan CVE sama tidak memanggil EPSS untuk CVE yang masih valid di cache.
  - [ ] Menghapus tabel cache tidak membuat scan gagal.
  - [ ] Migrasi dapat dijalankan ulang tanpa error.
- **Estimasi:** 1,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W3-01 — Skema SQLite dan repository lokal
- **Tipe:** `[AGENT]`
- **Tujuan:** Menyediakan penyimpanan lokal yang menjadi sumber utama tampilan Riwayat.
- **Prasyarat:** `T-W1-14`, `T-W2-09`
- **File/folder:** `app/src/db/schema.ts`, `migrations.ts`, `repository.ts`, `repository.test.ts`
- **Langkah:**
  1. Buat tabel `local_scans`, `local_findings`, dan `local_meta` dengan kolom PRD §8.2 (tanpa `sync_state`).
  2. Implementasikan migrasi idempoten dan versi skema.
  3. Implementasikan simpan, baca daftar, baca detail, dan hapus.
  4. Uji dengan database in-memory.
- **Memenuhi:** `FR-20`, `FR-21`, `NFR-07`, `NFR-16`
- **Kriteria selesai (AC):**
  - [ ] Skema tidak memuat `sync_state` dan memuat `persisted`.
  - [ ] Migrasi dijalankan dua kali tanpa error.
  - [ ] Simpan lalu baca mengembalikan payload yang sama.
  - [ ] Unit test repository lulus.
- **Estimasi:** 3 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W3-02 — Riwayat dan Detail dari SQLite serta mode offline
- **Tipe:** `[AGENT]`
- **Tujuan:** Memastikan hasil tersimpan dapat dibuka tanpa jaringan.
- **Prasyarat:** `T-W3-01`, `T-W2-06`
- **File/folder:** `app/app/(tabs)/riwayat.tsx`, `app/app/scan/[scanId]/index.tsx`, `app/app/scan/[scanId]/finding/[findingId].tsx`
- **Langkah:**
  1. Hubungkan layar Riwayat ke repository SQLite.
  2. Render Hasil dan Detail dari `payload_json` tanpa memanggil jaringan.
  3. Tangani kegagalan simpan SQLite dengan pesan §12 baris 21.
  4. Uji alur Riwayat→Hasil→Detail dalam mode pesawat.
- **Memenuhi:** `FR-20`, `FR-21`, `NFR-07`, `R-10`
- **Kriteria selesai (AC):**
  - [ ] Riwayat menampilkan scan yang tersimpan.
  - [ ] Hasil dan Detail terbuka dalam mode pesawat.
  - [ ] Kegagalan simpan lokal menampilkan pesan dan tidak menghilangkan hasil di layar.
  - [ ] Tidak ada crash saat koneksi hilang.
- **Estimasi:** 2,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W3-03 — Anonymous auth klien dan persistensi sesi
- **Tipe:** `[AGENT]`
- **Tujuan:** Memberi identitas anonim stabil untuk riwayat cloud dan rate limit.
- **Prasyarat:** `T-D0-02`, `T-W2-03`
- **File/folder:** `app/src/auth/`, `app/src/storage/secure.ts`
- **Langkah:**
  1. Aktifkan anonymous sign-in dan buat sesi saat pertama dibutuhkan.
  2. Simpan sesi di penyimpanan aman perangkat.
  3. Refresh JWT sekali saat kedaluwarsa; jika gagal, tampilkan pesan §12 baris 19.
  4. Hubungkan JWT ke klien API `scan` dan pastikan sesi dipakai ulang, bukan membuat akun baru setiap scan.
- **Memenuhi:** `FR-22` (klien), `NFR-05`, `NFR-03`, `R-09`
- **Kriteria selesai (AC):**
  - [ ] Sesi bertahan setelah aplikasi ditutup dan dibuka kembali.
  - [ ] Scan berulang tidak menambah baris `auth.users`.
  - [ ] Kegagalan sesi menonaktifkan Pindai tetapi Riwayat tetap dapat dibuka.
  - [ ] Tidak ada token di log.
- **Estimasi:** 2 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W3-04 — Migrasi Supabase dan kebijakan RLS
- **Tipe:** `[AGENT]`
- **Tujuan:** Menyediakan tabel cloud dengan isolasi data yang benar.
- **Prasyarat:** `T-D0-02`, `T-W1-12a`, `T-W1-12b`, `T-W1-13`
- **File/folder:** `supabase/migrations/*.sql`
- **Langkah:**
  1. Buat tabel `scans`, `findings`, dan `rate_limit_events` sesuai PRD §8.1.
  2. Aktifkan RLS pada semua tabel, termasuk `kev_entries`, `osv_cache`, dan `epss_cache` dari migrasi Minggu 1.
  3. Buat policy `SELECT` untuk `scans` berdasarkan `auth.uid()` dan `findings` berdasarkan kepemilikan scan.
  4. Pastikan tidak ada izin tulis klien dan tabel internal tidak dapat diakses klien.
  5. Uji migrasi dari database kosong.
- **Memenuhi:** `FR-22`, `NFR-05`, `NFR-15`, `R-08`
- **Kriteria selesai (AC):**
  - [ ] Semua tabel dibuat dari migrasi kosong tanpa error.
  - [ ] RLS aktif pada seluruh tabel.
  - [ ] Tidak ada policy `USING (true)` pada tabel pengguna.
  - [ ] Klien anonim tidak dapat menulis ke tabel.
- **Estimasi:** 2,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W3-05 — Penyimpanan cloud best-effort dan field `persisted`
- **Tipe:** `[AGENT]`
- **Tujuan:** Menyimpan riwayat cloud tanpa pernah menggagalkan scan yang sudah berhasil.
- **Prasyarat:** `T-W1-12d`, `T-W3-04`
- **File/folder:** `supabase/functions/scan/persist.ts`, `index.ts`, `persist.test.ts`
- **Langkah:**
  1. Simpan `scans` dan `findings` memakai service role setelah hasil dihitung.
  2. Set `persisted=true` bila berhasil.
  3. Tangkap kegagalan, set `persisted=false`, tambahkan warning `CLOUD_PERSIST_FAILED`, dan tetap kembalikan 200.
  4. Pastikan tidak ada retry atau sinkronisasi ulang dari klien.
- **Memenuhi:** `FR-22`, `FR-23`, `NFR-08`, `R-08`
- **Kriteria selesai (AC):**
  - [ ] Penyimpanan berhasil menulis satu baris `scans` dan findings terkait.
  - [ ] Simulasi kegagalan menghasilkan 200, `persisted=false`, dan satu warning.
  - [ ] Label dan hasil tidak berubah karena kegagalan simpan.
  - [ ] Tidak ada retry klien.
- **Estimasi:** 2 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W3-06 — Rate limit FR-25a per pengguna anonim
- **Tipe:** `[AGENT]`
- **Tujuan:** Membatasi penyalahgunaan scan per sesi anonim di backend.
- **Prasyarat:** `T-W3-04`
- **File/folder:** `supabase/functions/scan/rate-limit.ts`, migrasi indeks, `rate-limit.test.ts`
- **Langkah:**
  1. Catat setiap scan ke `rate_limit_events` dengan `user_id`.
  2. Tolak scan ke-6 dalam 10 menit dengan 429 dan `retryAfter`.
  3. Pastikan jendela waktu bergulir dan scan diterima kembali setelahnya.
  4. Uji bahwa pembatasan berjalan di server, bukan hanya UI.
- **Memenuhi:** `FR-25a`, `NFR-08`, `R-09`
- **Kriteria selesai (AC):**
  - [ ] Scan ke-6 dalam 10 menit menghasilkan 429 dengan `retryAfter`.
  - [ ] Setelah jendela berlalu, scan diterima.
  - [ ] UI menampilkan hitung mundur; backend tetap menolak walau UI dilewati.
  - [ ] Tidak ada akun baru yang dibuat untuk mengakali batas.
- **Estimasi:** 2 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W3-07a — Matriks error kelompok A: masukan dan manifest (kondisi 1–10)
- **Tipe:** `[AGENT]`
- **Tujuan:** Menangani kondisi input, URL, repo, dan manifest dengan pesan serta perilaku yang benar.
- **Prasyarat:** `T-W1-11`, `T-W2-04`, `T-W3-02`
- **File/folder:** `app/src/errors/messages.ts`, `supabase/functions/scan/errors.ts`, `docs/error-matrix.md`
- **Langkah:**
  1. Verifikasi tabel penugasan 23 kondisi di `docs/error-matrix.md` dan tambahkan kolom bukti uji.
  2. Implementasikan kondisi 1–10: input kosong, format, host, path, repo tidak ada, privat/403, 404 ambigu, tanpa `package.json`, manifest terlalu besar, dan lockfile rusak.
  3. Implementasikan pesan inline vs layar error sesuai prinsip PRD §12.
  4. Uji seluruh kondisi kelompok A dan catat buktinya.
- **Memenuhi:** `FR-24`, `NFR-02`, `NFR-08`, `NFR-09`, `R-02`
- **Kriteria selesai (AC):**
  - [ ] Tabel penugasan 23 kondisi lengkap dan tidak ada baris yang tidak bertugas.
  - [ ] Kondisi 1–10 memiliki pesan Indonesia dan perilaku yang sesuai.
  - [ ] Tidak ada stack trace atau pesan Inggris pada kondisi yang diuji.
  - [ ] Tidak ada crash pada seluruh kondisi kelompok A.
- **Estimasi:** 2 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W3-07b — Matriks error kelompok B: sumber eksternal dan batas laju (kondisi 11–16, 20)
- **Tipe:** `[AGENT]`
- **Tujuan:** Menangani kegagalan GitHub/OSV/KEV/EPSS, timeout total, dan batas laju aplikasi.
- **Prasyarat:** `T-W1-12d`, `T-W3-06`
- **File/folder:** `app/src/errors/messages.ts`, `supabase/functions/scan/errors.ts`, `docs/error-matrix.md`
- **Langkah:**
  1. Implementasikan kondisi 11–16: rate limit GitHub, OSV 429/5xx, EPSS gagal, KEV `STALE`, KEV belum tersedia, dan timeout total.
  2. Implementasikan kondisi 20: batas laju aplikasi dengan hitung mundur.
  3. Bedakan error penghenti (502/504) dari hasil parsial (200 + warning).
  4. Uji seluruh kondisi kelompok B dan perbarui bukti di `docs/error-matrix.md`.
- **Memenuhi:** `FR-24`, `NFR-02`, `NFR-08`, `R-05`
- **Kriteria selesai (AC):**
  - [ ] Kondisi 11–16 dan 20 memiliki pesan Indonesia serta kode/status yang benar.
  - [ ] Kegagalan pengayaan tidak menyamar sebagai hasil lengkap.
  - [ ] Tidak ada stack trace atau pesan Inggris pada kondisi yang diuji.
  - [ ] Tidak ada crash pada seluruh kondisi kelompok B.
- **Estimasi:** 2 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W3-07c — Matriks error kelompok C: jaringan, auth, dan cloud (kondisi 17–19, 21–23)
- **Tipe:** `[AGENT]`
- **Tujuan:** Menangani offline, kegagalan sesi, SQLite, respons tidak valid, dan kegagalan simpan cloud.
- **Prasyarat:** `T-W2-03`, `T-W3-02`, `T-W3-03`, `T-W3-05`
- **File/folder:** `app/src/errors/messages.ts`, `supabase/functions/scan/errors.ts`, `docs/error-matrix.md`
- **Langkah:**
  1. Implementasikan kondisi 17–19: tanpa koneksi, sesi anonim gagal, dan JWT kedaluwarsa.
  2. Implementasikan kondisi 21–23: gagal simpan SQLite, respons server tidak valid, dan gagal simpan cloud.
  3. Pastikan `persisted=false` + `CLOUD_PERSIST_FAILED` tetap menampilkan hasil.
  4. Uji seluruh kondisi kelompok C, termasuk mode pesawat, dan perbarui bukti.
- **Memenuhi:** `FR-24`, `NFR-02`, `NFR-07`, `NFR-08`, `R-11`
- **Kriteria selesai (AC):**
  - [ ] Kondisi 17–19 dan 21–23 memiliki pesan Indonesia serta perilaku yang benar.
  - [ ] Riwayat tetap dapat dibuka saat offline atau sesi gagal.
  - [ ] Tidak ada stack trace atau pesan Inggris pada kondisi yang diuji.
  - [ ] Tidak ada crash pada seluruh kondisi kelompok C.
- **Estimasi:** 2 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W3-08 — `[MANUAL]` Uji isolasi RLS dua pengguna anonim
- **Tipe:** `[MANUAL]`
- **Tujuan:** Membuktikan pengguna anonim B tidak dapat membaca data pengguna A.
- **Prasyarat:** `T-W3-04`, `T-W3-05`
- **File/folder:** `scripts/rls-check.mjs`, `docs/rls-test.md`
- **Langkah:**
  1. Buat dua sesi anonim A dan B.
  2. A memindai repo dan menyimpan hasil cloud.
  3. B mencoba membaca scan/finding A melalui REST/SDK.
  4. Ulangi pada build rilis di Minggu 4.
- **Memenuhi:** `FR-22`, `NFR-05`, `R-13`
- **Kriteria selesai (AC):**
  - [ ] B mendapat 0 baris atau error saat membaca data A.
  - [ ] A dapat membaca datanya sendiri.
  - [ ] Bukti uji menyertakan `requestId`/respons, bukan hanya tangkapan layar dashboard.
  - [ ] Tidak ada policy `USING (true)`.
- **Estimasi:** 1,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W3-11 — (S) Agregasi metrik operasional dan retensi log
- **Tipe:** `[AGENT]`
- **Tujuan:** Melengkapi bagian S dari observabilitas tanpa data pribadi.
- **Prasyarat:** `T-W1-12d`, `T-W3-04`
- **File/folder:** `docs/metrics.md`, `supabase/functions/scan/metrics.ts`
- **Langkah:**
  1. Definisikan metrik cache hit dan tingkat parsial.
  2. Sediakan query agregat tanpa JWT, isi manifest, atau data pribadi.
  3. Dokumentasikan retensi log terstruktur.
- **Memenuhi:** `NFR-12` (S), `NFR-06`
- **Kriteria selesai (AC):**
  - [ ] Metrik agregat dapat dihitung dari data yang tersimpan.
  - [ ] Tidak ada data pribadi di metrik/log.
  - [ ] `requestId` dan durasi per sumber tetap tersedia (bagian M).
- **Estimasi:** 1 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W3-12 — (S) Tema gelap dan kontras lanjutan
- **Tipe:** `[AGENT]`
- **Tujuan:** Melengkapi bagian S dari aksesibilitas tanpa mengorbankan bagian M.
- **Prasyarat:** `T-W2-07`
- **File/folder:** `app/src/theme/`, komponen UI
- **Langkah:**
  1. Tambahkan palet gelap yang mengikuti pengaturan sistem.
  2. Periksa kontras teks dan badge label.
  3. Pastikan teks Indonesia, label aksesibel, dan ukuran font sistem tetap berfungsi.
- **Memenuhi:** `NFR-11` (S)
- **Kriteria selesai (AC):**
  - [ ] Tema gelap mengikuti pengaturan sistem.
  - [ ] Kontras teks/badge lulus pemeriksaan visual.
  - [ ] Tidak ada regresi pada bagian M NFR-11.
- **Estimasi:** 1,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W3-13 — `[GATE]` Gate Minggu 3
- **Tipe:** `[GATE]`
- **Tujuan:** Memastikan offline, cloud, RLS, rate limit, dan penanganan error siap masuk minggu rilis.
- **Prasyarat:** `T-W3-01` s.d. `T-W3-06`, `T-W3-07a` s.d. `T-W3-07c`, `T-W3-08`; `T-W1-13`, `T-W3-11`, `T-W3-12` bila fitur S dipertahankan
- **File/folder:** `docs/week3-gate.md`
- **Langkah:**
  1. Uji alur offline penuh.
  2. Uji isolasi RLS dua pengguna.
  3. Uji 23 kondisi error.
  4. Uji hasil parsial, `persisted=false`, dan scan ke-6 (429).
  5. Verifikasi ketersediaan anonymous sign-in dan catat keputusan gerbang §13.1.
  6. Catat verdict dan sisa risiko.
- **Memenuhi:** `FR-22`, `FR-23`, `FR-24`, `FR-25a`, `NFR-05`, `NFR-07`, `R-08`, `R-09`, `R-13`
- **Kriteria selesai (AC):**
  - [ ] Riwayat→Hasil→Detail berhasil dalam mode pesawat.
  - [ ] Dua pengguna anonim terisolasi.
  - [ ] Gerbang anonymous sign-in punya verdict Go/No-Go.
  - [ ] 23 kondisi error teruji tanpa crash.
  - [ ] `persisted=false` dan warning tampil benar.
  - [ ] Scan ke-6 menghasilkan 429.
  - [ ] Verdict Go/No-Go tercatat.
- **Estimasi:** 2 jam
- [ ] Tugas selesai
- **Catatan hasil:**

---

## Minggu 4 — Pengujian, Keamanan, Rilis, Validasi

### T-W4-01 — Tinjauan OWASP Mobile dan perbaikan temuan
- **Tipe:** `[AGENT]`
- **Tujuan:** Menutup risiko keamanan utama sebelum build rilis.
- **Prasyarat:** `T-W3-13`
- **File/folder:** `docs/security-review.md`, file terkait temuan
- **Langkah:**
  1. Periksa penyimpanan data, komunikasi jaringan, autentikasi, kebocoran data, dan konfigurasi build.
  2. Verifikasi tidak ada service role/token di bundle.
  3. Periksa validasi input dan penanganan error agar tidak membocorkan detail internal.
  4. Perbaiki temuan kritis/tinggi atau catat penerimaan risiko.
- **Memenuhi:** `NFR-03`, `NFR-04`, `NFR-05`, `NFR-06`, `R-13`
- **Kriteria selesai (AC):**
  - [ ] Checklist keamanan terisi dengan bukti.
  - [ ] Tidak ada temuan kritis/tinggi terbuka.
  - [ ] Setiap temuan yang diterima memiliki alasan.
- **Estimasi:** 3 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W4-02 — `[MANUAL]` Build APK release candidate EAS
- **Tipe:** `[MANUAL]`
- **Tujuan:** Menghasilkan APK yang dapat dipasang untuk smoke test dan validasi.
- **Prasyarat:** `T-W4-01`, `T-D0-04`
- **File/folder:** `app/eas.json`, artefak APK di luar repo
- **Langkah:**
  1. Konfigurasi profil `release`/`preview` untuk APK dan signing yang aman.
  2. Jalankan build EAS sampai selesai.
  3. Simpan artefak dan catat versi build.
  4. Pastikan keystore tidak masuk repo.
- **Memenuhi:** `NFR-10`, `R-14`
- **Kriteria selesai (AC):**
  - [ ] APK release candidate berhasil dibuat.
  - [ ] APK dapat dipasang di emulator Android atau HP Android pinjaman.
  - [ ] Keystore dan kredensial tidak ada di repo.
- **Estimasi:** 2 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W4-03 — `[MANUAL]` Smoke test APK di perangkat
- **Tipe:** `[MANUAL]`
- **Tujuan:** Memverifikasi alur utama dan kondisi penting pada build rilis di emulator Android atau HP Android pinjaman, bukan hanya build pengembangan.
- **Prasyarat:** `T-W4-02`
- **File/folder:** `docs/smoke-test.md`
- **Langkah:**
  1. Uji Pindai→Hasil→Detail dengan repo nyata.
  2. Uji Riwayat→Hasil→Detail dalam mode pesawat.
  3. Uji minimal 5 kondisi error utama dan hasil parsial.
  4. Siapkan repo demo GitHub berisi fixture ±500 paket unik.
  5. Ukur waktu tap Pindai sampai Hasil terisi minimal 5 kali dan hitung p95.
  6. Catat perangkat/emulator, versi Android, versi APK, dan hasil setiap langkah.
- **Memenuhi:** `NFR-01`, `NFR-07`, `NFR-10`, `NFR-13`, `FR-17`, `FR-20`, `R-06`, `R-14`
- **Kriteria selesai (AC):**
  - [ ] Alur utama lulus di APK rilis pada emulator Android atau HP Android pinjaman.
  - [ ] Alur offline lulus.
  - [ ] Tidak ada crash pada langkah yang diuji.
  - [ ] p95 waktu ke hasil pada fixture 500 paket ≤ 15 detik, atau penyimpangan dicatat beserta tindakan.
  - [ ] Bukti uji tercatat.
- **Estimasi:** 2 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W4-04 — Audit secret APK dan uji ulang RLS pada build rilis
- **Tipe:** `[AGENT]`
- **Tujuan:** Memenuhi syarat rilis bahwa tidak ada secret bocor dan isolasi RLS terbukti pada build rilis.
- **Prasyarat:** `T-W4-02`, `T-W3-08`
- **File/folder:** `docs/security-review.md`, `docs/rls-test.md`
- **Langkah:**
  1. Ekstrak/bongkar APK dan cari pola token, service role, dan private key.
  2. Jalankan ulang skrip uji RLS dengan dua sesi anonim pada build rilis.
  3. Periksa environment EAS untuk memastikan secret tidak masuk profil build.
  4. Catat hasil dan bukti.
- **Memenuhi:** `NFR-03`, `NFR-05`, `NFR-06`, `R-13`
- **Kriteria selesai (AC):**
  - [ ] Pencarian string pada APK tidak menemukan secret.
  - [ ] Uji RLS dua pengguna lulus pada build rilis.
  - [ ] Environment EAS bebas dari service role/token GitHub.
- **Estimasi:** 1,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W4-05 — `[MANUAL]` Sesi validasi 5–10 orang
- **Tipe:** `[MANUAL]`
- **Tujuan:** Mengukur pemahaman label, keberhasilan alur, dan kejelasan hasil.
- **Prasyarat:** `T-W2-10`, `T-W4-03`
- **File/folder:** `docs/validation-results.md`
- **Langkah:**
  1. Konfirmasi ulang 5–10 peserta dan repo npm publik yang akan dipakai.
  2. Jalankan skenario 30 menit dari PRD §16.2 untuk setiap peserta.
  3. Catat durasi, keberhasilan, error, kutipan, dan metrik.
  4. Jangan merekam isi repo atau data pribadi.
- **Memenuhi:** `NFR-06`, `R-10`, `R-11`; metrik PRD §16
- **Perhitungan estimasi:** 8 peserta × 0,5 jam sesi = 4 jam; pencatatan dan analisis 2 jam; koordinasi/jadwal 1 jam; total 7 jam.
- **Kriteria selesai (AC):**
  - [ ] Minimal 5 peserta menyelesaikan sesi.
  - [ ] Metrik PRD §16.1 tercatat.
  - [ ] Tidak ada data pribadi/isi repo tersimpan.
  - [ ] Ringkasan hasil ditulis.
- **Estimasi:** 7 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W4-06 — Perbaikan blocker hasil validasi dan regression test
- **Tipe:** `[AGENT]`
- **Tujuan:** Menutup bug yang menghalangi penggunaan sebelum rilis final.
- **Prasyarat:** `T-W4-05`
- **File/folder:** file terkait bug, `docs/validation-results.md`
- **Langkah:**
  1. Triase temuan validasi menjadi blocker/non-blocker.
  2. Perbaiki blocker dan tambahkan regression test bila memungkinkan.
  3. Jalankan ulang `lint`, `typecheck`, `test`, dan smoke test terkait.
  4. Catat keputusan untuk temuan yang ditunda.
- **Memenuhi:** `NFR-16`, `R-11`, `R-13`
- **Kriteria selesai (AC):**
  - [ ] Blocker nol.
  - [ ] Regression test untuk bug yang diperbaiki lulus.
  - [ ] Temuan non-blocker masuk daftar keterbatasan/backlog.
- **Estimasi:** 2 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W4-07 — Finalisasi Tentang, keterbatasan, dan disclaimer
- **Tipe:** `[AGENT]`
- **Tujuan:** Memastikan aplikasi tidak menjanjikan lebih dari yang dapat dibuktikan.
- **Prasyarat:** `T-W4-03`, `T-W4-06`
- **File/folder:** `app/app/(tabs)/tentang.tsx`, `docs/limitations.md`
- **Langkah:**
  1. Perbarui Tentang dengan temuan validasi dan keterbatasan nyata.
  2. Tegaskan hasil bersifat potensial dan bukan pengganti audit profesional.
  3. Jelaskan riwayat anonim, `persisted=false`, dan hilangnya data setelah uninstall.
- **Memenuhi:** `FR-26`, `R-10`, `R-11`
- **Kriteria selesai (AC):**
  - [ ] Tentang memuat disclaimer dan seluruh keterbatasan utama.
  - [ ] Tidak ada klaim "aman" atau jaminan perbaikan.
  - [ ] Seluruh teks berbahasa Indonesia.
- **Estimasi:** 1 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W3-09 — (S) Rate limit FR-25b per hash IP *(dipindah dari Minggu 3)*
- **Tipe:** `[AGENT]`
- **Tujuan:** Menambah lapisan pembatas lintas akun anonim tanpa menyimpan IP mentah.
- **Prasyarat:** `T-W3-06`, `T-W3-13`
- **File/folder:** `supabase/functions/scan/rate-limit.ts`, migrasi indeks `ip_hash`
- **Langkah:**
  1. Hitung hash IP dan simpan pada `rate_limit_events.ip_hash` (nullable).
  2. Terapkan batas 20 scan/jam per hash IP.
  3. Pastikan fitur dapat dinonaktifkan tanpa mengubah FR-25a.
- **Memenuhi:** `FR-25b`, `R-09`
- **Kriteria selesai (AC):**
  - [ ] Beberapa akun dari IP uji yang sama melewati batas menghasilkan 429.
  - [ ] `ip_hash` boleh `NULL` dan tidak menyimpan IP mentah.
  - [ ] Menonaktifkan FR-25b tidak memengaruhi AC FR-25a.
- **Estimasi:** 1,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W3-10 — (S) Retensi cloud 90 hari dan pembersihan lazy *(dipindah dari Minggu 3)*
- **Tipe:** `[AGENT]`
- **Tujuan:** Menjaga kuota dan privasi tanpa infrastruktur cron.
- **Prasyarat:** `T-W3-04`, `T-W3-13`
- **File/folder:** `supabase/migrations/*_retention.sql`, `supabase/functions/scan/persist.ts`
- **Langkah:**
  1. Hapus `scans`/`findings` lebih lama dari 90 hari saat scan berikutnya.
  2. Batasi pekerjaan pembersihan agar tidak memperlambat respons secara berlebihan.
  3. Catat ukuran database sebelum/sesudah dan bandingkan dengan kuota gratis.
  4. Dokumentasikan perilaku bila fitur S dipotong.
- **Memenuhi:** `NFR-14`, `NFR-15`, `R-08`
- **Kriteria selesai (AC):**
  - [ ] Data uji bertanggal > 90 hari terhapus setelah scan berikutnya.
  - [ ] Tidak ada cron/scheduler baru.
  - [ ] Waktu pembersihan dan ukuran database tercatat di log.
- **Estimasi:** 1 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-W4-08 — `[GATE]` Gate rilis
- **Tipe:** `[GATE]`
- **Tujuan:** Memutuskan apakah build layak dirilis sebagai release candidate.
- **Prasyarat:** `T-W4-01` s.d. `T-W4-07`; `T-W3-09`, `T-W3-10` bila fitur S dipertahankan
- **File/folder:** `docs/release-gate.md`
- **Langkah:**
  1. Periksa seluruh DoD Minggu 4 PRD.
  2. Verifikasi APK, smoke test, keamanan, RLS, validasi, dan blocker nol.
  3. Catat verdict Go/No-Go dan sisa risiko.
- **Memenuhi:** `NFR-03`, `NFR-05`, `NFR-10`, `NFR-13`, `R-13`, `R-14`
- **Kriteria selesai (AC):**
  - [ ] APK terpasang dan lulus smoke test pada emulator Android atau HP Android pinjaman.
  - [ ] Checklist keamanan tanpa temuan kritis.
  - [ ] RLS diuji ulang pada build rilis.
  - [ ] Validasi memenuhi kriteria PRD §16.
  - [ ] Blocker nol dan verdict tercatat.
- **Estimasi:** 1,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

---

## Final dan Laporan

### T-F-01 — Susun laporan akhir
- **Tipe:** `[AGENT]`
- **Tujuan:** Mendokumentasikan hasil MVP, bukti uji, metrik, dan keterbatasan.
- **Prasyarat:** `T-W4-08`
- **File/folder:** `docs/final-report.md`
- **Langkah:**
  1. Ringkas tujuan, arsitektur, dan keputusan penting.
  2. Sajikan hasil due diligence, performa, CPU, dan keamanan.
  3. Sajikan metrik validasi dan kutipan pengguna.
  4. Tulis keterbatasan dan rekomendasi Tahap 2.
- **Memenuhi:** `NFR-12`, `R-06`, `R-11`, `R-15`
- **Kriteria selesai (AC):**
  - [ ] Laporan memuat bukti untuk setiap DoD mingguan.
  - [ ] Metrik validasi dan performa disajikan dengan sumber data.
  - [ ] Keterbatasan dan risiko sisa dicantumkan.
- **Estimasi:** 3 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-F-02 — Siapkan skrip demo dan artefak
- **Tipe:** `[AGENT]`
- **Tujuan:** Memastikan demo dapat diulang tanpa bergantung pada memori.
- **Prasyarat:** `T-W4-08`
- **File/folder:** `docs/demo-script.md`, `README.md`, artefak APK di luar repo
- **Langkah:**
  1. Tulis alur demo langkah demi langkah dengan repo contoh.
  2. Siapkan fallback hasil cache/offline bila jaringan gagal.
  3. Daftar artefak: APK, fixture, bukti uji, laporan.
  4. Uji jalankan skrip demo sekali dari awal.
- **Memenuhi:** `FR-20`, `FR-21`, `NFR-07`
- **Kriteria selesai (AC):**
  - [ ] Skrip demo dapat diikuti tanpa pengetahuan tambahan.
  - [ ] Ada rencana cadangan untuk kegagalan jaringan.
  - [ ] Semua artefak tercantum dan dapat diakses.
- **Estimasi:** 2 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-F-03 — Audit akhir cakupan PRD dan konsistensi dokumen
- **Tipe:** `[AGENT]`
- **Tujuan:** Memastikan tidak ada requirement yang terlewat atau diklaim tanpa bukti.
- **Prasyarat:** `T-W4-08`
- **File/folder:** `TASKS.md`, `docs/final-report.md`
- **Langkah:**
  1. Periksa setiap baris Matriks Cakupan memiliki tugas `[x]` dan bukti AC.
  2. Periksa `docs/PRD.md` tidak berubah tanpa catatan keputusan.
  3. Periksa item S: diimplementasikan atau dipotong dengan alasan sesuai §17.
  4. Perbarui tabel progres dan catatan hasil yang kurang.
- **Memenuhi:** Seluruh `FR`, `NFR`, `R` (audit)
- **Kriteria selesai (AC):**
  - [ ] Tidak ada requirement tanpa tugas atau tanpa bukti.
  - [ ] Semua tugas selesai berstatus `[x]` dan memiliki catatan hasil.
  - [ ] Setiap pemotongan item S memiliki keputusan tertulis.
- **Estimasi:** 1,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

### T-F-04 — `[MANUAL]` Demo/presentasi dan penyerahan artefak
- **Tipe:** `[MANUAL]`
- **Tujuan:** Menyampaikan hasil MVP dan menyerahkan artefak akhir.
- **Prasyarat:** `T-F-01`, `T-F-02`, `T-F-03`
- **File/folder:** artefak akhir di luar repo
- **Langkah:**
  1. Jalankan demo sesuai skrip.
  2. Sampaikan metrik, keterbatasan, dan risiko sisa.
  3. Serahkan APK, laporan, dan tautan repositori.
- **Memenuhi:** `NFR-10`, `R-13`
- **Kriteria selesai (AC):**
  - [ ] Demo berjalan tanpa blocker.
  - [ ] Seluruh artefak diserahkan.
  - [ ] Pertanyaan penguji dicatat untuk Tahap 2.
- **Estimasi:** 1,5 jam
- [ ] Tugas selesai
- **Catatan hasil:**

---

## Matriks Cakupan

Setiap requirement PRD harus memiliki minimal satu tugas. Tanda `(S)` pada requirement berarti prioritas S.

### Functional Requirements (FR)

| Requirement | Tugas |
|---|---|
| FR-01 | `T-W2-02`, `T-W1-11` |
| FR-02 | `T-W2-02`, `T-W2-03`, `T-W1-11` |
| FR-03 | `T-W1-01`, `T-W1-11` |
| FR-04 | `T-W1-06`, `T-W1-07` |
| FR-05 | `T-W1-02`, `T-W1-07`, `T-W1-08` |
| FR-06 | `T-W1-03`, `T-W1-12a` |
| FR-07 | `T-W1-03`, `T-W1-12a` |
| FR-08 | `T-W1-04`, `T-W1-12b` |
| FR-09 | `T-W1-04`, `T-W1-12b` |
| FR-10 | `T-W1-05`, `T-W1-12c`, `T-W1-13` (S) |
| FR-11 | `T-W1-03`, `T-W1-09` |
| FR-12 | `T-W1-07`, `T-W1-09` |
| FR-13 | `T-W1-10`, `T-W1-12c` |
| FR-14 | `T-W1-10` |
| FR-15 | `T-W1-07`, `T-W2-04` |
| FR-16 | `T-W2-04`, `T-W2-05` |
| FR-17 | `T-D0-05`, `T-W2-01`, `T-W2-02`, `T-W2-04`, `T-W2-09` |
| FR-18 | `T-W2-05` |
| FR-19 | `T-W1-02`, `T-W1-08`, `T-W2-05` |
| FR-20 | `T-W2-06`, `T-W3-01`, `T-W3-02` |
| FR-21 | `T-W3-01`, `T-W3-02` |
| FR-22 | `T-W3-03`, `T-W3-04`, `T-W3-05`, `T-W3-08` |
| FR-23 | `T-W1-12c`, `T-W2-03`, `T-W3-05` |
| FR-24 | `T-W1-11`, `T-W2-03`, `T-W3-07a`, `T-W3-07b`, `T-W3-07c` |
| FR-25a | `T-W3-06` |
| FR-25b (S) | `T-W3-09` |
| FR-26 | `T-W2-06`, `T-W4-07` |

### Non-Functional Requirements (NFR)

| Requirement | Tugas |
|---|---|
| NFR-01 | `T-W1-12d`, `T-W1-14`, `T-W2-04`, `T-W4-03` |
| NFR-02 | `T-W1-11`, `T-W1-12d`, `T-W1-14`, `T-W2-03`, `T-W3-07a`, `T-W3-07b`, `T-W3-07c` |
| NFR-03 | `T-D0-03`, `T-D0-07`, `T-W2-03`, `T-W2-08`, `T-W4-04` |
| NFR-04 | `T-W1-01`, `T-W1-11`, `T-W2-02`, `T-W4-01` |
| NFR-05 | `T-W3-03`, `T-W3-04`, `T-W3-08`, `T-W4-04` |
| NFR-06 | `T-W1-12d`, `T-W2-03`, `T-W3-11`, `T-W4-01` |
| NFR-07 | `T-W3-01`, `T-W3-02`, `T-W3-07c`, `T-W3-13`, `T-W4-03` |
| NFR-08 | `T-W1-12d`, `T-W3-05`, `T-W3-06`, `T-W3-07a`, `T-W3-07b`, `T-W3-07c` |
| NFR-09 | `T-W1-06`, `T-W1-14`, `T-W3-07a` |
| NFR-10 | `T-D0-04`, `T-W2-08`, `T-W4-02`, `T-W4-03` |
| NFR-11 (M) | `T-W2-01`, `T-W2-07` |
| NFR-11 (S) | `T-W3-12` |
| NFR-12 (M) | `T-W1-11`, `T-W1-12d` |
| NFR-12 (S) | `T-W3-11` |
| NFR-13 | `T-D0-04`, `T-D0-05`, `T-W2-01`, `T-W2-07`, `T-W2-08`, `T-W2-09`, `T-W4-03`, `T-W4-08` |
| NFR-14 (S) | `T-W3-10` |
| NFR-15 | `T-D0-02`, `T-W1-13`, `T-W3-04`, `T-W3-10` |
| NFR-16 | `T-D0-06`, `T-D0-07`, `T-W1-07`, `T-W1-08`, `T-W1-09`, `T-W1-10`, `T-W3-01` |
| NFR-17 | `T-W1-07b`, `T-W1-12d`, `T-W1-14` |

### Risiko (R)

| Risiko | Tugas |
|---|---|
| R-01 | `T-D0-03`, `T-W1-01`, `T-W1-14` |
| R-02 | `T-W1-01`, `T-W1-11`, `T-W2-02`, `T-W3-07a` |
| R-03 | `T-W1-03`, `T-W1-09` |
| R-04 | `T-W1-03`, `T-W1-09` |
| R-05 | `T-W1-04`, `T-W1-05`, `T-W1-12b`, `T-W1-12c`, `T-W1-12d`, `T-W1-13`, `T-W3-07b` |
| R-06 | `T-W1-06`, `T-W1-14`, `T-W4-03` |
| R-07 | `T-W1-06`, `T-W1-07` |
| R-08 | `T-D0-02`, `T-W3-04`, `T-W3-05`, `T-W3-10` |
| R-09 | `T-W3-03`, `T-W3-06`, `T-W3-09` |
| R-10 | `T-W2-06`, `T-W3-02`, `T-W4-05` |
| R-11 | `T-W1-10`, `T-W2-03`, `T-W2-04`, `T-W2-06`, `T-W3-07c`, `T-W4-07` |
| R-12 | `T-W1-08`, `T-W2-05` |
| R-13 | `T-D0-01`, `T-W1-14`, `T-W2-10`, `T-W3-08`, `T-W4-01`, `T-W4-08` |
| R-14 | `T-D0-04`, `T-W2-08`, `T-W2-09`, `T-W4-02`, `T-W4-03`, `T-W4-08` |
| R-15 | `T-W1-07b`, `T-W1-12d`, `T-W1-14` |

> **Catatan NFR-13/R-14:** Uji harian dilakukan di iPhone memakai Expo Go. APK Android tetap dibangun lewat EAS dan diuji di emulator Android atau HP Android pinjaman. Penyimpangan terkontrol ini dicatat di **Catatan Keputusan**.

---

## Catatan Keputusan

Catatan penyimpangan atau perubahan keputusan terhadap PRD. Wajib diisi sebelum menyimpang, lalu minta konfirmasi pengembang.

| Tanggal | Tugas | Keputusan | Alasan | Konfirmasi pengembang |
|---|---|---|---|---|
| 9 November 2026 | `T-D0-04`, `T-D0-05` | Perangkat uji harian adalah iPhone dengan Expo Go. AC pembukaan aplikasi diverifikasi di akhir `T-D0-05`; `T-D0-04` tetap `[~]` sampai verifikasi itu. APK Android tetap dibangun lewat EAS dan diuji di emulator Android atau HP Android pinjaman. | Pengembang hanya memiliki iPhone; perangkat Android fisik belum tersedia. | Ya — instruksi langsung pengembang, 9 November 2026 |
| 9 November 2026 | `T-W1-05`, `T-W1-12c` | EPSS: kirim maksimal 100 CVE per request dan **selalu** sertakan parameter `cve`; tanpa parameter itu seluruh basis dikembalikan. Respons `total=0`/`data=[]` untuk permintaan tidak kosong diperlakukan sebagai **kegagalan** (warning, `partial=true`), bukan "tidak ada skor". Gunakan `limit` eksplisit atau paginasi karena default 100. CVE tanpa skor tetap `null`. Perilaku 429/5xx masih `[PERLU DIVERIFIKASI]`. | Pengamatan `T-W1-05`: 134 CVE (URL 2.047 byte) mengembalikan HTTP 200 dengan `total=0`; tanpa `cve` API mengembalikan 401.956 entri; 101 CVE hanya mengembalikan 100 data dengan `limit` default. | Ya — instruksi pengembang, 9 November 2026 |
| 9 November 2026 | `T-W1-04` | KEV: `knownRansomwareCampaignUse` bernilai `Known`/`Unknown`, bukan boolean; hanya `Known` dipetakan ke `true`. Logo/seal CISA/DHS tidak boleh dipakai. Akses feed dari region Supabase masih `[PERLU DIVERIFIKASI]` dan diuji di `T-W1-12d`. | Pengamatan `T-W1-04`: 361 `Known` + 1.408 `Unknown`; lisensi CC0 1.0 melarang pemakaian logo/seal sebagai endorsement; akses regional belum diukur. | Ya — instruksi pengembang, 9 November 2026 |
| 9 November 2026 | `T-W1-03`, `T-W1-12c` | OSV: batas nyata **1.000 query/request**; chunk 50 dipakai untuk membatasi ukuran respons. Detail advisory diambil terpisah karena respons batch hanya berisi `id` + `modified`. Severity fallback ke `database_specific` bila advisory hanya memuat CVSS_V4. | Pengamatan `T-W1-03`: 1.000 query → 200, 1.001 → 400 `too many queries`; respons batch tanpa severity/aliases; 5/40 advisory hanya CVSS_V4. | Ya — instruksi pengembang, 9 November 2026 |
| 10 November 2026 | `T-W1-11`, `T-W2-02` | Normalisasi tautan di UI (trim, huruf kecil untuk skema dan host, buang `.git` dan `/` di ujung) menjadi tanggung jawab layar Pindai Minggu 2 (`T-W2-02`), bukan fungsi `scan`. Validator server tetap ketat dan tidak menormalkan: `https://github.com/o/r.git` diterima dengan `repo="r.git"`, `https://github.com/o/r/` ditolak `EXTRA_PATH`. | Memisahkan sanitasi tampilan dari validasi keamanan server; mengubah perilaku validator sekarang akan menyimpang dari kontrak `T-W1-11` yang sudah teruji. | Ya — instruksi pengembang, 10 November 2026 |
| 9 November 2026 | `T-W1-11` | Docker tidak tersedia, sehingga langkah 5 `[AGENT]` “uji lokal dengan `supabase functions serve`” diganti dengan (a) unit test memakai fetch tiruan untuk seluruh jalur validasi dan pemetaan error, dan (b) deploy fungsi `scan` ke proyek remote dengan `--use-api` lalu uji integrasi memakai skrip. AC tugas disesuaikan: jalur validasi/error diuji dengan fetch tiruan, dan hasil uji integrasi remote (status + `requestId`) dicatat. | Docker tidak terpasang di mesin pengembang; deploy remote berbasis API sudah terbukti pada `T-W1-07b`. | Ya — instruksi pengembang, 9 November 2026 |

---

## Backlog Tahap 2

Jangan dikerjakan sebelum seluruh tugas MVP selesai dan Gate Rilis `T-W4-08` berstatus `[x]`. Rujukan lengkap: `docs/PRD.md` §18.

1. Ekspor/bagikan ringkasan hasil (teks/gambar).
2. Perbandingan dua pemindaian.
3. Dukungan `pnpm-lock.yaml` dan `yarn.lock`.
4. Login GitHub + repo privat.
5. Notifikasi/pemantauan berkala.
6. Enrichment NVD untuk severity yang hilang.
7. Unggah SBOM / integrasi CI.
8. Dukungan ekosistem Python (PyPI).
9. Pembuatan pull request perbaikan otomatis.
10. Dasbor tim/organisasi.
