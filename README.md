# PatchRadar

PatchRadar adalah aplikasi seluler MVP untuk memindai repositori npm publik dan menunjukkan potensi kerentanan dependensi beserta tindakan yang disarankan. Aplikasi memakai Expo Router, berjalan di Android, dan menyimpan riwayat hasil secara lokal agar tetap dapat dibuka tanpa koneksi.

Status: **MVP selesai secara fungsional**; penutup rilis (build APK final, gate, laporan, demo) masih berjalan. Sumber kebenaran: [`docs/PRD.md`](docs/PRD.md) v1.1 dengan revisi cakupan validasi 1.2. Lihat [`TASKS.md`](TASKS.md) untuk status tiap tugas.

## Yang bisa dilakukan

- Memindai repo GitHub publik melalui URL; membaca `package-lock.json`, fallback ke `package.json`, lalu mencocokkan paket dengan OSV, KEV, dan EPSS.
- Menampilkan temuan dengan label **Tambal sekarang**, **Jadwalkan**, dan **Pantau**, disertai alasan, referensi, serta perintah perbaikan yang bisa disalin.
- Menyimpan riwayat dan detail scan di SQLite perangkat; Riwayat → Hasil → Detail tetap berjalan dalam mode pesawat.
- Menampilkan hasil parsial dengan banner bila sumber data tertentu gagal.
- Memilih tema **Gelap** atau **Terang** secara manual di tab **Tentang**; pilihan tidak mengikuti tema sistem dan tetap tersimpan setelah aplikasi dibuka lagi.
- Menolak repo privat, URL tidak sah, dan manifest di atas batas dengan pesan berbahasa Indonesia.

## Struktur repositori

| Path | Isi |
|---|---|
| `app/` | Aplikasi Expo (React Native). Rute ada di `app/src/app/`, komponen/hook/util di luar folder tersebut. |
| `supabase/functions/scan/` | Edge Function `scan`: GitHub, parser lockfile, OSV/KEV/EPSS, skor/label, cache, rate limit, retensi. |
| `supabase/migrations/` | Skema tabel, indeks, dan kebijakan RLS. |
| `fixtures/`, `patchradar-fixture-large/` | Respons nyata dan fixture lockfile untuk uji. |
| `scripts/` | Probe CLI untuk due diligence API eksternal dan pemeriksaan RLS. |
| `docs/` | PRD, desain UI, bukti uji, keamanan, keterbatasan, dan laporan. |

## Menjalankan secara lokal

Prasyarat: Node.js dengan npm, akun Supabase, dan akun Expo bila memakai Expo Go.

```powershell
cd "D:\code by-v\patchRadar\app"
npm install
Copy-Item .env.example .env
npx expo start
```

Isi `app/.env` dengan dua variabel publik berikut. Nilainya tidak boleh disimpan di repo.

| Variabel | Sifat | Keterangan |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Publik | URL proyek Supabase; akhiran `/rest/v1/` dinormalkan klien. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Publik | Anon/publishable key, dilindungi RLS. |

Setiap kali `.env` berubah, jalankan `npx expo start --clear` karena variabel `EXPO_PUBLIC_*` ditanam saat bundling. `GITHUB_TOKEN` dan `SUPABASE_SERVICE_ROLE_KEY` **hanya** boleh berada di environment/secret Supabase, tidak di `app/.env` maupun di repo. Rincian: [`docs/environment.md`](docs/environment.md).

## Pemeriksaan sebelum commit

Jalankan dari folder `app/`:

```powershell
npm run lint
npm run typecheck
npm test
```

Untuk backend, dari root repo:

```powershell
node --test "supabase/functions/scan/**/*.test.ts"
```

Terakhir kali dijalankan pada HEAD `7fd6288`: lint dan typecheck lulus, 16 suite/160 test aplikasi lulus, 215 test backend lulus.

## Build APK

Profil `release` di `app/eas.json` menghasilkan APK dengan `autoIncrement: true` dan environment `production`. Daftarkan dua variabel publik yang sama di environment EAS sebelum build.

```powershell
cd "D:\code by-v\patchRadar\app"
npx eas-cli@latest build --profile release --platform android
```

Artefak disimpan di luar repo. Setiap build wajib dicatat SHA-256, versionCode, commit sumber, dan bukti uji perangkat sebelum gate rilis ditutup. Status terkini: [`TASKS.md`](TASKS.md) bagian `T-W4-08` dan `docs/release-gate.md` (dalam penyiapan).

## Dokumentasi

| Topik | Berkas |
|---|---|
| Sumber kebenaran produk | [`docs/PRD.md`](docs/PRD.md) |
| Status dan bukti tiap tugas | [`TASKS.md`](TASKS.md) |
| Desain layar dan tema | [`docs/ui-design.md`](docs/ui-design.md) |
| Bukti API eksternal | [`docs/due-diligence-log.md`](docs/due-diligence-log.md) |
| Konfigurasi dan secret | [`docs/environment.md`](docs/environment.md) |
| Keamanan | [`docs/security-review.md`](docs/security-review.md) |
| Isolasi data | [`docs/rls-test.md`](docs/rls-test.md) |
| Uji perangkat | [`docs/smoke-test.md`](docs/smoke-test.md) |
| Validasi | [`docs/validation-results.md`](docs/validation-results.md) |
| Keterbatasan | [`docs/limitations.md`](docs/limitations.md) |
| Matriks error | [`docs/error-matrix.md`](docs/error-matrix.md) |

## Keterbatasan yang perlu diketahui

Keterbatasan lengkap ada di [`docs/limitations.md`](docs/limitations.md). Ringkasannya: riwayat lokal hilang saat uninstall dan tidak disinkronkan ulang; cloud bersifat upaya terbaik; 404 tetap menghitung kuota; retensi 90 hari baru berjalan saat scan berikutnya; dan metrik pemahaman label serta keputusan terbantu belum terukur karena studi pengguna ditunda ke Tahap 2. Hasil aplikasi bersifat potensial dan bukan pengganti audit keamanan profesional.
