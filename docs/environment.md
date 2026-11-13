# Environment Pengembangan — PatchRadar

Catatan versi lingkungan pengembangan dan perangkat uji. Diperbarui saat verifikasi `T-D0-05` (9 November 2026) dan build EAS percobaan `T-W2-08` (13 November 2026).

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

- Build ini dibuat saat konfigurasi EAS masih berada di working tree. Setelah `eas.json` dan `android.package` di-commit, rebuild dari commit bersih disarankan sebelum atau selama `T-W2-09` untuk memastikan reproduksibilitas.
- `npx expo-doctor` melaporkan 19/20 pada 13 November 2026 karena 10 paket tertinggal versi patch (mis. `expo` 58.0.23 vs ~58.0.25). Ini kondisi yang sudah ada sebelum `T-W2-08` dan tidak menghalangi build; penyelarasan versi patch dapat menjadi commit terpisah.

## Catatan Android

Pengujian harian dilakukan di iPhone memakai Expo Go. APK Android dibangun lewat EAS dan sudah diuji pada realme XT (Android 8) di `T-W2-08`; pengujian ulang dengan build yang memuat fitur lengkap dijadwalkan pada `T-W4-03`.
