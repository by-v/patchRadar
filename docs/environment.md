# Environment Pengembangan — PatchRadar

Catatan versi lingkungan pengembangan dan perangkat uji. Diperbarui saat verifikasi `T-D0-05` (9 November 2026), build EAS percobaan `T-W2-08` (13 November 2026), dan Gate Minggu 2 `T-W2-09` (14 November 2026).

## Perangkat Uji

| Item | Nilai |
|---|---|
| Perangkat | iPhone X |
| Versi iOS | 16.7.16 |
| Aplikasi klien | Expo Go (dari App Store) |
| Versi Expo Go | Tidak dicatat saat verifikasi |
| Akun Expo | `codebyv10` |
| Perangkat Android uji | realme XT, Android 8 (dilaporkan pengembang) |
| Aplikasi Android uji | APK `preview` dari EAS (`T-W2-08`) |

## Lingkungan Pengembangan (PC)

| Item | Versi |
|---|---|
| Node.js | 24.21.0 |
| npm | 11.11.1 |
| Expo SDK | ~58.0.23 |
| React Native | 0.88.1 |
| React | 19.3.0 |
| Expo Router | ~58.0.30 |
| Supabase CLI | 3.0.0 (dijalankan lewat `npx`) |
| EAS CLI | 27.5.0 |
| TypeScript | strict + `noUncheckedIndexedAccess` (`npm run typecheck` lulus) |
| Unit test | Jest 30 + `jest-expo` ~58.0.14 (`npm test` lulus) |
| Clipboard & browser | `expo-clipboard` ~58.0.4 dan `expo-web-browser` ~58.0.7 (keduanya tersedia di Expo Go) |

## Cara Menjalankan

```powershell
cd "D:\code by-v\patchRadar\app"
npx expo start --lan
```

- Server Metro berjalan di `exp://192.168.1.27:8081` melalui LAN.
- Buka aplikasi dengan memindai QR memakai **aplikasi Kamera iPhone**, lalu ketuk “Buka di Expo Go”.
- Expo Go iOS mensyaratkan Expo CLI dan Expo Go login ke akun Expo yang sama (`codebyv10`).
- Opsi “Enter URL manually” tidak tersedia pada Expo Go iOS versi ini; gunakan pemindaian QR atau buka `exp://192.168.1.27:8081` lewat Safari.

## Konfigurasi Aplikasi (`app/.env`)

Klien `scan` membaca dua variabel publik Expo:

| Variabel | Isi | Sifat |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL proyek, mis. `https://<ref>.supabase.co` | Publik |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon/publishable key proyek | Publik, dilindungi RLS |

Langkah:

1. Salin `app/.env.example` menjadi `app/.env`.
2. Ambil nilai dari dashboard Supabase → **Project Settings → API**. URL boleh disalin lengkap dengan akhiran `/rest/v1/`; klien menormalkannya menjadi basis proyek.
3. Jalankan `npx expo start --clear` setiap kali `.env` berubah. `EXPO_PUBLIC_*` ditanam saat bundling, bukan dibaca saat runtime.
4. Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_TOKEN`, atau kunci rahasia lain di `app/.env`; semua variabel berawalan `EXPO_PUBLIC_` ikut masuk ke bundel.

`app/.env` diabaikan git. Untuk build EAS, daftarkan dua variabel yang sama di environment EAS (`eas env:create` atau dashboard) sebelum `T-W2-08`; tanpa itu build berjalan tanpa konfigurasi.

## Daftar Secret

Tidak ada nilai secret yang dicatat di dokumen ini. Hanya lokasi penyimpanannya.

| Secret | Lokasi penyimpanan | Catatan |
|---|---|---|
| `GITHUB_TOKEN` | Secret Supabase Edge Function (dashboard atau `supabase secrets set`) | Token fine-grained read-only untuk metadata dan isi repo publik; hanya dipakai server-side, tidak boleh masuk `app/` atau repo. |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret/environment Supabase untuk Edge Function | Hanya server-side; tidak boleh ada di `app/`. |
| Kredensial EAS | Dikelola EAS (keystore dan kredensial build) | File keystore/kunci seperti `*.jks`, `*.p12`, `*.key`, `*.mobileprovision` dikecualikan oleh `app/.gitignore`; tidak ada di repo. |
| Supabase anon key | Boleh disertakan di aplikasi | Bersifat publik dan dilindungi RLS, bukan rahasia. |

## Pemindaian Secret

Perintah (9 November 2026):

```powershell
git grep -n -i -E "service_role|ghp_|github_pat_|BEGIN PRIVATE KEY"
git grep --untracked -n -i -E "service_role|ghp_|github_pat_|BEGIN PRIVATE KEY"
```

Hasil: tiga kecocokan, semuanya **bukan nilai secret**:

- `TASKS.md:105` dan `TASKS.md:205` — teks kriteria selesai yang menyebut pola pencarian.
- `supabase/config.toml:20` — komentar bawaan tentang peran `service_role` pada Data API.

Tidak ditemukan token, service role key, atau private key yang tertanam di file yang dilacak maupun tidak terlacak.

## Hasil Verifikasi

- Aplikasi **PatchRadar** terbuka di Expo Go pada iPhone X (iOS 16.7.16).
- Tab **Pindai** dan **Riwayat** tampil.
- `npx tsc --noEmit` lulus.
- `npx expo-doctor` lulus 20/20.
- `npx expo lint` lulus.
- `npx jest` lulus 9 suite/86 test (termasuk parser tautan, konfigurasi environment, klien `scan`, format waktu dan tanggal lokal, ringkasan label dan label tertinggi, sesi hasil dan daftar hasil, serta aturan perbaikan).
- `T-W2-07`: seluruh `Pressable` memiliki label aksesibel, label severity memakai bahasa Indonesia (Kritis/Tinggi/Sedang/Rendah/Tidak diketahui), dan pesan `NETWORK` tidak lagi menjanjikan riwayat tersimpan. Kontras teks utama `#1E1E1E` pada canvas 5,72–11,3:1; `textSecondary` pada canvas tengah 4,67:1.
- **Uji manual `T-W2-07` di iPhone (13 November 2026):** dilakukan pada iPhone X (iOS 16.7.16) dengan ukuran teks sistem maksimum; layar Pindai → Hasil → Detail → Riwayat → Tentang diperiksa dan tidak ada teks terpotong maupun string Inggris. Verifikasi Android menyusul pada APK `T-W2-08`.
- Respons nyata `scan` untuk `chalk/chalk` dan error 404 tersimpan sebagai fixture di `app/src/api/__fixtures__/`.
- `node --test "supabase/functions/scan/**/*.test.ts"` lulus 158 test.
- Uji remote 13 November 2026: `OPTIONS /functions/v1/scan` → `204` dengan `access-control-allow-origin: *`; `POST` dengan `Origin` → `200` dan header CORS yang sama, sehingga scan web tidak lagi gagal karena CORS.
- **Gate Minggu 2 (14 November 2026):** alur Pindai → Hasil → Detail → Riwayat → Tentang lulus di iPhone X (iOS 16.7.16, Expo SDK 58.0.23) dan APK Android `d4c8dfa1` di realme XT (Android 8). `tsc --noEmit`, `expo lint`, dan Jest 9 suite/86 test lulus. Audit ulang APK bersih. Verdict **GO**; laporan di `docs/week2-gate.md`.
- Respons nyata 14 November 2026 untuk bukti banner/empty state: `expressjs/express` 44 paket/1 temuan/`estimated=true`; `chalk/chalk` 9 paket/0 temuan; `nestjs/nest` 1.425 paket/77 temuan/`partial=true` (`LOCKFILE_PARTIAL`).

## Build EAS Percobaan (T-W2-08)

Build percobaan Android dijalankan 13 November 2026 memakai profil `preview` pada `app/eas.json`.

| Item | Nilai |
|---|---|
| Build ID | `d4c8dfa1-9003-4d13-826e-5c778ca255df` |
| Halaman build | https://expo.dev/accounts/codebyv10/projects/patchradar/builds/d4c8dfa1-9003-4d13-826e-5c778ca255df |
| Status | `FINISHED` |
| Profil / distribusi | `preview` / `internal` |
| Mulai → selesai | 13 November 2026, 17.55.19 → 18.18.50 (WIB) |
| Durasi build | 23 menit 21 detik |
| Commit saat build | `9114acc` (konfigurasi `eas.json` dan `android.package` masih di working tree, belum di-commit) |
| `appIdentifier` | `com.codebyv.patchradar` |
| Versi / versionCode | `1.0.0` / `1` |
| Fingerprint | `dfa68b417ba936d07c54a4d947706f7c5814d63d` |
| APK | `D:\builds\patchradar-preview.apk` — 101.327.543 byte (96,63 MB) |
| SHA-256 APK | `63E1AD6AD36B810CD89D330E868E235353B579B9750D790CADC8191393113F3A` |
| Environment build | EAS `preview`: `EXPO_PUBLIC_SUPABASE_URL` dan `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publik) |
| Perangkat uji | realme XT, Android 8 (dilaporkan pengembang) |

Hasil pemasangan dan uji:

- APK terpasang dan berjalan di realme XT (Android 8).
- Alur Pindai → Hasil → Detail berjalan; tombol salin perintah, tautan referensi, Riwayat, dan Tentang berfungsi (konfirmasi pengembang).

Audit secret pada APK (13 November 2026):

```powershell
Get-FileHash D:\builds\patchradar-preview.apk -Algorithm SHA256
```

Isi APK diperiksa dengan membuka `assets/index.android.bundle` (3.303.852 byte) langsung dari arsip. Hasil: tidak ada `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_TOKEN`, `ghp_`, `github_pat_`, `sk_live_`, maupun blok private key; tidak ada berkas `.env` di dalam APK. Anon publishable key dan host Supabase ada di bundle sesuai desain (publik, dilindungi RLS).

Catatan:

- Build ini dibuat saat konfigurasi EAS masih berada di working tree. `T-W2-09` memakai ulang build ini tanpa rebuild dari commit bersih; rebuild tetap dijadwalkan pada `T-W4-02` sebelum rilis untuk memastikan reproduksibilitas.
- `npx expo-doctor` melaporkan 19/20 pada 13 November 2026 karena 10 paket tertinggal versi patch (mis. `expo` 58.0.23 vs ~58.0.25). Ini kondisi yang sudah ada sebelum `T-W2-08` dan tidak menghalangi build; penyelarasan versi patch dapat menjadi commit terpisah.

## Build APK Release Candidate (T-W4-02)

Build release candidate Android dijalankan 17 November 2026 memakai profil `release` baru pada `app/eas.json` (APK, environment `production`, `autoIncrement`). Profil ini ditambahkan pada tugas ini agar artefak yang diuji memakai environment dan keystore production, bukan `preview`.

| Item | Nilai |
|---|---|
| Build ID | `439654c8-b781-42d4-a612-a047912b502b` |
| Halaman build | https://expo.dev/accounts/codebyv10/projects/patchradar/builds/439654c8-b781-42d4-a612-a047912b502b |
| Status | `finished` |
| Profil / distribusi | `release` / `store` (artefak APK karena `android.buildType: apk`) |
| Mulai → selesai | 17 November 2026, 01.02.12 → 05.10.42 (waktu lokal mesin build) |
| Commit saat build | `63e6aee` (working tree bersih) |
| `appIdentifier` | `com.codebyv.patchradar` |
| Versi / versionCode | `1.0.0` / `2` |
| Fingerprint | `f60e40c0eba1f555c4404f2514fa6497f84b3612` |
| APK | `D:\builds\patchradar-release-vc2.apk` — 109.322.643 byte (104,26 MB) |
| SHA-256 APK | `DE535690DACA9D15F77539F3039F17872AE3DAF6E874580C2F81C55CDAB3088D` |
| Keystore | EAS remote `Build Credentials EPkjlDM7tu` (tidak diunduh, tidak ada di repo) |
| Environment build | EAS `production`: `EXPO_PUBLIC_SUPABASE_URL` dan `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publik, visibility plain text) |
| Perangkat uji | realme XT (Android 8, sesuai catatan `T-W2-08`) |

Keluaran mentah `build:view`:

```text
ID                       439654c8-b781-42d4-a612-a047912b502b
Platform                 Android
Status                   finished
Profile                  release
Distribution             store
SDK Version              58.0.0
Version                  1.0.0
Version code             2
Commit                   63e6aee676507f7ea793ec3ccf8966ad3264f4b4
Fingerprint              f60e40c0eba1f555c4404f2514fa6497f84b3612
Started at               11/17/2026, 1:02:12 AM
Finished at              11/17/2026, 5:10:42 AM
Started by               codebyv10
```

Bukti hash artefak:

```powershell
Get-FileHash D:\builds\patchradar-release-vc2.apk -Algorithm SHA256
```

```text
DE535690DACA9D15F77539F3039F17872AE3DAF6E874580C2F81C55CDAB3088D
```

Hasil pemasangan dan verifikasi (dilaporkan pengembang, 17 November 2026):

- APK terpasang di realme XT dan aplikasi berjalan.
- Ikon launcher menampilkan badge PatchRadar hasil `e87cd03` (kucing + cincin radar + segitiga peringatan), bukan ikon default Expo.
- Pergantian bentuk ikon (icon shape) tidak menampilkan cacat mask pada ikon adaptive.
- Splash screen menampilkan badge dengan ukuran wajar pada latar `#DDD3CC`.
- Satu pemindaian repo nyata berhasil, sehingga `EXPO_PUBLIC_*` terbukti tertanam di bundel.

Bukti kredensial tidak masuk repo (dijalankan pada `63e6aee`):

```text
--- git status --short
(kosong)

--- git ls-files | Select-String '\.jks$|\.keystore$|\.p12$|\.pem$|\.key$|credentials\.json|service-account'
(kosong)
```

Catatan:

- URL unduhan artefak EAS bersifat bertanda tangan dan mengandung token, sehingga sengaja tidak dicatat; yang dicatat hanya build ID, halaman build, ukuran, dan SHA-256.
- Antrean build memakan ±4 jam sebelum eksekusi (tier gratis); durasi eksekusi di sisi worker tidak tercatat terpisah.
- Audit secret isi APK dan uji ulang RLS pada build ini belum dilakukan dan menjadi lingkup `T-W4-04`.

## Catatan Android

Pengujian harian dilakukan di iPhone memakai Expo Go. APK Android dibangun lewat EAS dan sudah diuji pada realme XT (Android 8) di `T-W2-08` dan pada build release candidate `439654c8` di `T-W4-02`; smoke test lengkap dijadwalkan pada `T-W4-03`.
