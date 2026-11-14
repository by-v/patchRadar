# Laporan Gerbang Minggu 2 — Go/No-Go

Tanggal keputusan: **14 November 2026**  
Ruang lingkup: UI Expo (Pindai, Hasil, Detail, Riwayat, Tentang), validasi URL, integrasi `scan`, build EAS percobaan, dan audit secret APK.  
Sumber kebenaran: `docs/PRD.md` v1.1 §17 (Minggu 2), FR-01, FR-17, NFR-03, NFR-10, NFR-13, R-13, R-14; `TASKS.md` T-W2-01 s.d. T-W2-08.

## 1. Keputusan gerbang

**GO** untuk melanjutkan ke pekerjaan offline/cloud Minggu 3. Tidak ada blocker.

Build yang diuji adalah build EAS percobaan `d4c8dfa1-9003-4d13-826e-5c778ca255df` dari commit `9114acc`. Build **tidak diulang** dari commit bersih setelah `eas.json` dan `android.package` di-commit; caveat ini dicatat pada §8 dan tidak mengubah verdict.

## 2. Bukti build dan perangkat

### 2.1 Build EAS

| Item | Nilai |
|---|---|
| Build ID | `d4c8dfa1-9003-4d13-826e-5c778ca255df` |
| Halaman build | https://expo.dev/accounts/codebyv10/projects/patchradar/builds/d4c8dfa1-9003-4d13-826e-5c778ca255df |
| Status | `FINISHED` |
| Profil / distribusi | `preview` / `internal` |
| Commit saat build | `9114acc` |
| `appIdentifier` | `com.codebyv.patchradar` |
| Versi / versionCode | `1.0.0` / `1` |
| Fingerprint | `dfa68b417ba936d07c54a4d947706f7c5814d63d` |
| SDK tercatat EAS | `58.0.0`; proyek memakai Expo `~58.0.23` |
| APK | `D:\builds\patchradar-preview.apk` — 101.327.543 byte (96,63 MB) |
| SHA-256 APK | `63E1AD6AD36B810CD89D330E868E235353B579B9750D790CADC8191393113F3A` |
| Environment build | EAS `preview`: `EXPO_PUBLIC_SUPABASE_URL` dan `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publik) |

### 2.2 Perangkat uji

| Platform | Perangkat | Versi | Aplikasi |
|---|---|---|---|
| iOS | iPhone X | iOS 16.7.16 | Expo Go, Expo SDK 58.0.23 |
| Android | realme XT | Android 8 | APK `preview` `d4c8dfa1` |

Uji perangkat dilakukan dan dikonfirmasi pengembang pada 14 November 2026. Versi Expo Go belum dicatat; yang dicatat adalah versi SDK Expo.

## 3. Alur utama

| Langkah | iPhone (Expo Go) | Android (APK) | Bukti |
|---|---|---|---|
| Aplikasi terbuka tanpa crash | Lulus | Lulus | Konfirmasi pengembang |
| Tab Pindai, Riwayat, Tentang dapat dibuka | Lulus | Lulus | Konfirmasi pengembang |
| Pindai `expressjs/express` → layar Hasil | Lulus | Lulus | Konfirmasi pengembang; respons nyata 44 paket, 1 temuan |
| Tap kartu `hbs` → layar Detail | Lulus | Lulus | Konfirmasi pengembang |
| Kembali dari Detail ke Hasil dan ke Pindai | Lulus | Lulus | Konfirmasi pengembang |
| Riwayat menampilkan hasil sesi | Lulus | Lulus | Konfirmasi pengembang |
| Tentang memuat disclaimer dan keterbatasan | Lulus | Lulus | Konfirmasi pengembang |
| Tombol salin perintah dan tautan referensi | Lulus | Lulus | Konfirmasi pengembang; rincian komponen di T-W2-05 dan T-W2-08 |

## 4. Validasi URL (FR-01 / PRD §12 baris 1–4)

Teks aplikasi memakai kata **“repositori”** sebagai hasil sapuan bahasa T-W2-07; PRD menulis “repo”. Perbedaan ini sudah disetujui dan bukan kegagalan.

| Kasus | Input | Hasil yang diharapkan | Status |
|---|---|---|---|
| Kosong | `""` atau spasi | Tombol **Mulai pemindaian** nonaktif dan tidak ada request. Parser mengembalikan `EMPTY`; pesan inline tidak dapat dipicu lewat tombol karena tombol `disabled`. | Lulus dengan catatan |
| Format | `github.com/a/b` | “Tautan tidak valid. Gunakan format https://github.com/pemilik/repositori.” | Lulus |
| Format | `http://github.com/a/b` | Pesan format yang sama | Lulus |
| Format | `https://github.com/a` | Pesan format yang sama | Lulus |
| Host | `https://gitlab.com/a/b` | “Hanya tautan github.com yang didukung.” | Lulus |
| Host | `https://www.github.com/a/b` | Pesan host yang sama | Lulus |
| Host | `https://192.168.0.1/a/b` | Pesan host yang sama | Lulus (unit test) |
| Path | `https://github.com/a/b/tree/main` | “Gunakan tautan halaman utama repositori, tanpa /tree, /blob, atau parameter.” | Lulus |
| Path | `https://github.com/a/b?tab=readme` | Pesan path yang sama | Lulus |
| Path | `https://github.com/a/b#readme` | Pesan path yang sama | Lulus |
| Valid | `https://github.com/expressjs/express/` | Diterima; pratinjau `https://github.com/expressjs/express` | Lulus |
| Valid | `https://github.com/expressjs/express.git` | Diterima; `.git` dibuang dari pratinjau | Lulus |
| Valid | `  https://GitHub.com/ExpressJS/Express  ` | Diterima; spasi diabaikan, huruf pemilik/repositori dipertahankan | Lulus |

Bukti otomatis: `app/src/lib/url.test.ts` lulus seluruh kasus `EMPTY`, `FORMAT`, `HOST`, dan `PATH`.

## 5. Field FR-17 pada kartu

Diuji pada kartu `hbs@4.4.0` dari `expressjs/express` (respons nyata 14 November 2026: 44 paket, 1 temuan, `estimated=true`).

| Field FR-17 | Nilai pada kartu | Status |
|---|---|---|
| Nama paket | `hbs` | Ada |
| Versi terpasang | `4.4.0` ditampilkan sebagai `@4.4.0` | Ada |
| Label | **Pantau** (`MONITOR`) | Ada |
| Severity | **Sedang** (`MEDIUM`) | Ada |
| KEV | **Tidak di KEV** (`kev=false`) | Ada |
| EPSS | **0,98%** (`epss=0.00982`) | Ada |
| Tag langsung/transitif | **Langsung** (`direct=true`) | Ada |
| Tag dev | **Pengembangan** (`devOnly=true`) | Ada |
| Alasan | “Tidak ada indikasi eksploitasi nyata dan severity relatif rendah; pantau saja.” | Ada |
| Tap kartu | Membuka Detail `hbs` | Lulus |

Kartu juga menampilkan chevron dan label aksesibel yang menggabungkan nama paket, label, severity, dan alasan.

## 6. Banner, indikator progres, dan empty state

| Kondisi | Pemicu / bukti | Hasil | Status |
|---|---|---|---|
| Hasil perkiraan | `expressjs/express`; respons nyata `estimated=true`, 44 paket | Banner **Hasil perkiraan** dan chip **Perkiraan** | Lulus |
| Repositori besar | `nestjs/nest`; respons nyata 1.425 paket (>500) | Banner **Repositori besar; pemindaian bisa lebih lama dari biasanya.** | Lulus |
| Hasil parsial | `nestjs/nest`; respons nyata 14 November 2026 `partial=true`, `status=PARTIAL`, 77 temuan, 21 paket terimbas, warning `LOCKFILE_PARTIAL` | Banner **Hasil parsial** berisi pesan warning | Lulus |
| Loading lebih dari 5 detik | Scan dingin repo besar | Spinner pada tombol sejak awal dan teks “Repositori besar bisa memakan waktu lebih lama.” setelah 5 detik | Lulus |
| Empty state | `chalk/chalk`; respons nyata 9 paket, 0 temuan | “Tidak ada temuan pada data yang diperiksa” + “Hasil ini potensial dan tidak menjamin proyek bebas risiko.” | Lulus |

Tidak ada progress bar persentase karena backend tidak mengirim progres; indikator yang dipakai adalah spinner indeterminate dan penjelasan setelah 5 detik. Ini sesuai FR-17.

## 7. Audit secret APK

Audit dilakukan ulang pada 14 November 2026 terhadap APK yang sama.

| Pemeriksaan | Hasil |
|---|---|
| SHA-256 | `63E1AD6AD36B810CD89D330E868E235353B579B9750D790CADC8191393113F3A` |
| `assets/index.android.bundle` | 3.303.852 byte |
| `service_role` | 0 kecocokan |
| `SUPABASE_SERVICE_ROLE_KEY` | 0 kecocokan |
| `GITHUB_TOKEN` | 0 kecocokan |
| `ghp_` / `github_pat_` | 0 kecocokan |
| `sk_live_` | 0 kecocokan |
| `BEGIN PRIVATE KEY` | 0 kecocokan |
| Berkas `.env` di APK | Tidak ada |
| Anon key dan host Supabase | Ada di bundle sesuai desain; bersifat publik dan dilindungi RLS |

Environment EAS `preview` hanya berisi dua variabel publik di atas; tidak ada service role atau token GitHub di build klien.

## 8. Verifikasi otomatis

| Pemeriksaan | Hasil |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | Lulus |
| `npm run lint` (`expo lint`) | Lulus |
| `npm test -- --runInBand` | Lulus 9 suite / 86 test |
| `npx expo-doctor` | 19/20; drift versi patch dependensi yang sudah ada sebelum gerbang, bukan blocker |

## 9. Kesesuaian dengan DoD Minggu 2

| DoD PRD §17 | Status |
|---|---|
| Alur Pindai → Hasil → Detail berjalan di perangkat Android fisik | Terpenuhi — realme XT, Android 8 |
| Validasi URL menolak semua kasus FR-01 | Terpenuhi — §4 |
| Kartu hasil memuat semua field FR-17 | Terpenuhi — §5 |
| Indikator progres repo besar tampil | Terpenuhi — §6 |
| Tidak ada secret di bundle | Terpenuhi — §7 |
| Build EAS percobaan berhasil | Terpenuhi — `d4c8dfa1` |

## 10. Deviasi dan tindak lanjut

1. **Build tidak diulang dari commit bersih.** Build berasal dari `9114acc` saat konfigurasi EAS masih di working tree. Rebuild dari commit bersih dijadwalkan pada `T-W4-02` sebelum rilis. Tidak menghalangi Minggu 3.
2. **Pesan inline input kosong tidak dapat dipicu lewat tombol.** Tombol nonaktif mencegah request; parser dan unit test menangani `EMPTY`. Ini non-blocker, tetapi dapat diperbaiki sebagai penyempurnaan UI bila diinginkan.
3. **Banner parsial** sudah diverifikasi dengan respons nyata `nestjs/nest` (`partial=true`) dan logika layar Hasil. Uji seluruh matriks error tetap menjadi lingkup `T-W3-07a`–`T-W3-07c`.
4. **Versi Expo Go belum dicatat.** Yang tercatat adalah Expo SDK 58.0.23 dan iPhone X / iOS 16.7.16.
5. **`expo-doctor` 19/20** karena drift versi patch dependensi; tidak memengaruhi build atau alur utama.

## 11. Blocker

Tidak ada blocker.

## 12. Tindak lanjut

1. `T-W4-02`: rebuild APK dari commit bersih dan audit ulang pada build rilis.
2. `T-W3-07a`–`T-W3-07c`: uji seluruh 23 kondisi matriks error, termasuk banner parsial dan error jaringan.
3. Opsional: tampilkan pesan inline/focus untuk input kosong tanpa mengaktifkan tombol.
4. `T-W3-13`: pantau performa dan CPU setelah fitur offline/cloud masuk.
