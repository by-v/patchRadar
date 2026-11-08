# Environment Pengembangan — PatchRadar

Catatan versi lingkungan pengembangan dan perangkat uji. Diperbarui saat verifikasi `T-D0-05` (9 November 2026).

## Perangkat Uji

| Item | Nilai |
|---|---|
| Perangkat | iPhone X |
| Versi iOS | 16.7.16 |
| Aplikasi klien | Expo Go (dari App Store) |
| Versi Expo Go | Tidak dicatat saat verifikasi |
| Akun Expo | `codebyv10` |

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

## Cara Menjalankan

```powershell
cd "D:\code by-v\patchRadar\app"
npx expo start --lan
```

- Server Metro berjalan di `exp://192.168.1.27:8081` melalui LAN.
- Buka aplikasi dengan memindai QR memakai **aplikasi Kamera iPhone**, lalu ketuk “Buka di Expo Go”.
- Expo Go iOS mensyaratkan Expo CLI dan Expo Go login ke akun Expo yang sama (`codebyv10`).
- Opsi “Enter URL manually” tidak tersedia pada Expo Go iOS versi ini; gunakan pemindaian QR atau buka `exp://192.168.1.27:8081` lewat Safari.

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

## Catatan Android

Pengujian harian dilakukan di iPhone memakai Expo Go. APK Android tetap dibangun lewat EAS dan diuji terpisah di emulator Android atau HP Android pinjaman pada `T-W2-08` dan `T-W4-03`.
