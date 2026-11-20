# PatchRadar — aplikasi Expo

Aplikasi seluler PatchRadar. Gambaran umum, prasyarat, dokumentasi, dan status rilis ada di [`README.md`](../README.md) pada root repositori.

## Perintah

Jalankan dari folder `app/`:

```powershell
npm install
npx expo start
npm run lint
npm run typecheck
npm test
```

Build APK memakai `npx eas-cli@latest build --profile release --platform android`. Profil dan environment ada di `eas.json`.

## Konfigurasi

Salin `.env.example` menjadi `.env` dan isi `EXPO_PUBLIC_SUPABASE_URL` serta `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Kedua nilai bersifat publik. Jangan taruh `SUPABASE_SERVICE_ROLE_KEY` atau `GITHUB_TOKEN` di sini: semua variabel `EXPO_PUBLIC_*` ikut masuk ke bundel aplikasi.

## Struktur

- `src/app/` — rute Expo Router; setiap berkas adalah layar, `_layout.tsx` menyusun navigator.
- `src/components/`, `src/hooks/`, `src/lib/`, `src/providers/`, `src/storage/` — kode non-rute.
- `assets/` — ikon dan aset splash.

Tema gelap/terang diatur manual di tab **Tentang** dan dibaca dari `ThemeModeProvider`, bukan dari pengaturan tema perangkat.
