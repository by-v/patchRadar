# Acuan Desain UI — PatchRadar

Dokumen ini menerjemahkan arah visual aplikasi menjadi aturan yang dapat diimplementasikan. Sumber fungsional tetap `docs/PRD.md` §10; dokumen ini **tidak** menggantikan spesifikasi layar di sana.

## 1. Status

| Item | Nilai |
|---|---|
| Versi dokumen | 1.1 |
| Tanggal | 12 November 2026 |
| Status | Disetujui dan diimplementasikan pada `T-W2-01` |
| Sumber desain | Hasil uji prompt Figma, disetujui pengembang (tanpa tautan; spesifikasi lengkap ada di dokumen ini) |
| Cakupan | Light mode saja (dark mode opsional, prioritas S) |
| Bahasa UI | Indonesia; istilah teknis (KEV, EPSS, CVSS, OSV, CVE) tetap Inggris |

Rujukan silang:
- `docs/PRD.md` §10.1 route map, §10.3 spesifikasi layar, §11 aturan label dan skor, §13 state parsial.
- `TASKS.md` Minggu 2, `T-W2-01` s.d. `T-W2-07`.

## 2. Prinsip

1. **Data di atas dekorasi.** Efek kaca dan latar hangat tidak boleh mengurangi keterbacaan angka, severity, dan alasan.
2. **Glass hanya untuk elemen mengambang.** Header, tab bar, kartu ringkasan, dialog. Daftar panjang memakai kartu kaca tipis dengan latar cukup pekat.
3. **Tenang, bukan kosong.** Banyak ruang kosong, satu aksen gelap besar per layar sebagai penekanan.
4. **Status tidak pernah hanya warna.** Setiap severity dan label selalu disertai ikon dan teks.
5. **Satu layar, satu tindakan utama.** Tombol utama selalu paling menonjol dan berbentuk kartu gelap.

## 3. Token warna

### 3.1 Permukaan

| Token | Nilai | Pemakaian |
|---|---|---|
| `canvasTop` | `#DDD3CC` | Awal gradient latar |
| `canvasMid` | `#CABEB5` | Tengah gradient |
| `canvasBottom` | `#A2958B` | Akhir gradient |
| `glassFill` | `rgba(255,255,255,0.22)` | Panel kaca standar |
| `glassFillStrong` | `rgba(255,255,255,0.38)` | Header ringkasan, dialog |
| `glassBorder` | `rgba(255,255,255,0.40)` | Garis tepi panel kaca |
| `inputFill` | `rgba(255,255,255,0.30)` | Pill input |
| `inputBorder` | `rgba(255,255,255,0.45)` | Garis tepi input |
| `inputBorderFocus` | `rgba(255,255,255,0.75)` | Input fokus |
| `hairline` | `#6B605A` | Garis pemisah di permukaan terang |
| `darkCard` | `#1E1E1E` | Kartu penekanan, CTA |
| `darkAccent` | `#2A2725` | Sub-permukaan gelap, blok kode |

### 3.2 Teks

| Token | Nilai | Di atas | Kontras | Catatan |
|---|---|---|---|---|
| `textPrimary` | `#1E1E1E` | canvas | 11,3:1 | Lulus AAA |
| `textPrimary` | `#1E1E1E` | input `#CABEB5` | 9,2:1 | Lulus AAA |
| `textSecondary` | `#544B45` | canvas | 5,8:1 | Lulus AA |
| `textSecondary` | `#544B45` | input `#CABEB5` | 4,7:1 | Lulus AA |
| `textOnDark` | `#F2EDE8` | `#1E1E1E` | 14,3:1 | Lulus AAA |
| `textMutedOnDark` | `#A2958B` | `#1E1E1E` | 5,7:1 | Lulus AA |
| `textMutedOnDark` | `#A2958B` | `#2A2725` | 5,1:1 | Lulus AA |
| `textOnDark` | `#F2EDE8` | `#2A2725` | 10,1:1 | Lulus AAA |

**Aturan keras:** `#A2958B` **dilarang** dipakai sebagai teks di atas canvas, input, atau panel kaca terang (kontras hanya 1,98:1). Nilai itu hanya untuk permukaan gelap dan ikon dekoratif.

Placeholder input memakai `textSecondary` dengan opasitas 70% — bukan `#A2958B`.

### 3.3 Warna status — *usulan, menunggu persetujuan*

Dipakai sebagai isi pill dengan teks putih; setiap badge wajib punya ikon dan teks pendamping.

| Severity | Latar | Teks | Kontras teks putih |
|---|---|---|---|
| Critical | `#B3261E` | putih | 6,5:1 |
| High | `#C2410C` | putih | 5,2:1 |
| Medium | `#92690B` | putih | 4,9:1 |
| Low | `#4D7C0F` | putih | 5,0:1 |
| Unknown | `#544B45` | putih | 8,5:1 |

Bentuk ikon per level: Critical = segitiga penuh, High = segitiga garis, Medium = lingkaran separuh, Low = lingkaran garis, Unknown = tanda tanya.

Status umum: sukses `#3F6212`, peringatan `#92690B`, error `#B3261E`. Banner memakai latar tint 12% dari warna tersebut di atas panel kaca, dengan teks `textPrimary`.

## 4. Tipografi

Memakai font sistem (tanpa font kustom) agar perilaku pembesaran teks sistem tetap benar dan tidak menambah waktu muat.

| Peran | Ukuran / tinggi baris | Berat | Letter spacing |
|---|---|---|---|
| Judul layar | 34 / 40 | 500 | -0,5 |
| Judul kartu gelap | 30 / 36 | 400 | -0,4 |
| Angka besar | 44 / 48 | 300 | -0,5 |
| Judul bagian | 16 / 22 | 600 | 0 |
| Body | 15 / 22 | 400 | 0 |
| Metadata | 13 / 18 | 400 | 0 |
| Label tab | 11 / 14 | 500 | 0 |
| Kode / perintah | 14 / 20 | 400 (mono) | 0 |

Semua ukuran memakai `allowFontScaling` bawaan (jangan dimatikan). Tata letak harus tetap rapi pada skala 200%: hindari tinggi tetap pada baris teks, gunakan `minHeight`.

## 5. Spacing, radius, elevasi

- Spacing: kelipatan 4 — `4, 8, 12, 16, 24, 32`.
- Margin horizontal layar: `24`. Jarak antar kartu: `12`. Padding dalam kartu: `16`–`20`.
- Radius: kartu `28`, panel `28`, banner `20`, pill `999`, tombol ikon `999`.
- Target sentuh minimum: `44 x 44`.
- Bayangan panel kaca: `0 12 32 rgba(30,30,30,0.12)`. Di Android gunakan `elevation: 6` dengan bayangan lebih lembut.

## 6. Komponen dan peta berkas

Nama berkas mengikuti konvensi yang sudah ada di repo (`kebab-case`), bukan `PascalCase` yang tertulis di `TASKS.md`. Penyimpangan ini dicatat pada `T-W2-01`.

| Komponen | Berkas tujuan | Keterangan |
|---|---|---|
| `GlassSurface` | `app/src/components/glass-surface.tsx` | Pembungkus efek kaca + fallback non-blur |
| `ScreenHeader` | `app/src/components/screen-header.tsx` | Judul, subjudul, tombol kembali |
| `PillInput` | `app/src/components/pill-input.tsx` | Ikon kiri, varian default/fokus/error |
| `DarkCTA` | `app/src/components/dark-cta.tsx` | Kartu gelap besar, label kecil + judul + panah |
| `FindingCard` | `app/src/components/finding-card.tsx` | Kartu temuan pada layar Hasil |
| `SeverityBadge` | `app/src/components/severity-badge.tsx` | Ikon + teks, bukan warna saja |
| `LabelBadge` | `app/src/components/label-badge.tsx` | Tambal sekarang / Jadwalkan / Pantau |
| `MetaChip` | `app/src/components/meta-chip.tsx` | KEV, EPSS, langsung, transitif, dev |
| `Banner` | `app/src/components/banner.tsx` | Info, peringatan, error |
| `EmptyState` | `app/src/components/empty-state.tsx` | Ilustrasi abstrak + teks + tindakan |
| `Skeleton` | `app/src/components/skeleton.tsx` | Placeholder loading dengan shimmer |
| `Wordmark` | `app/src/components/wordmark.tsx` | Tipografis "Patch" tebal + "Radar" ringan, tanpa aset gambar |
| Tab bar | `app/src/components/tab-bar.tsx` | Tab bar kaca mengambang, 4 tab |
| Token | `app/src/constants/theme.ts` (sudah ada) | Menggantikan nilai default Expo |

Token warna, spacing, dan tipografi didefinisikan di `theme.ts` dan diimpor oleh semua komponen. Tidak ada nilai hex yang ditulis langsung di komponen.

## 7. Spesifikasi layar

Route mengikuti struktur nyata `app/src/app/`. Pengelompokan `(tabs)` dan nama berkas final ditetapkan pada `T-W2-01`; PRD §10.1 tetap menjadi acuan nama rute.

### 7.1 Pindai

- Wordmark kecil di kiri atas, judul "Pindai repositori", subjudul satu kalimat.
- `PillInput` dengan ikon GitHub, placeholder `https://github.com/pemilik/repo`.
- Pemilih cakupan: "Hanya produksi" / "Termasuk dev" (default hanya produksi).
- `DarkCTA`: label kecil "Siap dipindai", judul "Mulai pemindaian", panah dalam lingkaran. Nonaktif saat input belum valid atau saat loading.
- Kartu kaca "Pindai terakhir" bila ada riwayat.
- Catatan kaki: batas 1.500 paket unik dan perkiraan hingga 25 detik.
- Error validasi tampil inline di bawah input, bukan modal.

### 7.2 Hasil

- Header: `owner/repo`, waktu relatif, tombol pindai ulang.
- Kartu ringkasan kaca: angka besar jumlah temuan, chip per label, dan teks persis `"{totalPackages} paket diperiksa, {affectedPackages} punya temuan"`.
- Banner parsial/perkiraan di atas daftar.
- Filter pill horizontal: Semua, Tambal sekarang, Jadwalkan, Pantau, Critical.
- `FindingCard`: severity + label di baris atas, `paket@versi`, chip KEV/EPSS/tag, alasan satu kalimat, chevron.
- Empty state: "Tidak ada temuan pada data yang diperiksa" + "Hasil ini potensial dan tidak menjamin proyek bebas risiko."

### 7.3 Detail

- Tombol kembali berbentuk lingkaran kaca.
- Kartu gelap identitas: label, `paket@versi`, skor prioritas, alasan.
- Grid kartu kaca: severity/CVSS, EPSS (nilai + persentil atau "tidak tersedia"), KEV (ya/tidak + tautan), versi aman.
- Blok perbaikan: perintah dalam `darkAccent` + tombol salin; saran untuk transitif; pesan bila belum ada versi aman.
- Ringkasan dampak dan daftar referensi.
- Chip ID OSV/CVE.
- Banner parsial/perkiraan bila relevan.

### 7.4 Riwayat

- Daftar kartu: repo, waktu lokal, `Y temuan`, badge label tertinggi, ikon cache.
- Urut terbaru. Tanpa filter atau pencarian pada MVP.
- Empty state "Belum ada pemindaian" + tombol mulai pindai.
- Tap membuka Hasil dari data lokal tanpa memanggil jaringan.

### 7.5 Tentang

- Tiga kartu definisi label beserta contoh pemicu.
- Penjelasan KEV, EPSS, OSV, dan asal severity.
- Disclaimer "potensial, bukan jaminan".
- Batas identitas anonim.
- Versi aplikasi dan tautan kebijakan privasi.

## 8. State wajib

| Kode | State | Tampilan |
|---|---|---|
| S1 | Loading | Skeleton kaca + teks "Memeriksa dependensi…", tanpa persentase palsu; setelah 5 detik tambah "Repo besar bisa memakan waktu lebih lama" |
| S2 | Kosong | Empty state netral, tidak mengklaim proyek aman |
| S3 | Error | Banner error + penyebab + `requestId` + tombol coba lagi |
| S4 | Parsial | Banner peringatan; data tetap ditampilkan |
| S5 | Repo besar | Dialog kaca batas 1.500 paket dengan "Mengerti" dan "Batalkan" |

## 9. Aksesibilitas

- Kontras teks minimum 4,5:1; komponen non-teks minimum 3:1 terhadap warna sekitarnya (karena itu `hairline` `#6B605A` dipakai, bukan `#A2958B`).
- Jangan menyampaikan status hanya lewat warna; selalu ada ikon dan teks.
- Semua elemen interaktif punya label aksesibilitas berbahasa Indonesia.
- Target sentuh minimum 44 x 44, termasuk chevron dan tombol ikon.
- Dukung skala font sistem hingga 200% tanpa pemotongan teks; teks panjang memakai `numberOfLines` hanya bila ada alternatif akses (mis. halaman Detail).
- Hormati `AccessibilityInfo.isReduceTransparencyEnabled()`: bila aktif, ganti semua panel kaca dengan versi opaque.

## 10. Implementasi efek kaca

Dua modul tersedia, dengan konsekuensi berbeda:

| Modul | Status | Platform | Catatan |
|---|---|---|---|
| `expo-glass-effect` | Sudah terpasang (`~58.0.5`) | iOS 26+, tvOS | `GlassView` otomatis menjadi `View` biasa di platform lain; tidak ada efek di Android |
| `expo-blur` | **Belum terpasang** | iOS + Android | Perlu `npx expo install expo-blur`; kualitas dan performa di Android lebih rendah |

Aturan:

1. Latar layar memakai gradient tiga titik dari `expo-linear-gradient` ditambah dua blob `View` semi-transparan. Tidak ada blur runtime untuk latar penuh.
2. `GlassSurface` memilih implementasi: iOS 26 → `GlassView`; lainnya → panel semi-opaque `glassFill` + `glassBorder`.
3. Selalu sediakan varian opaque; efek kaca adalah penyempurnaan, bukan syarat tampilan.
4. Jangan menaruh opasitas < 1 pada `GlassView` atau induknya — efek tidak akan tampil.

Dependensi yang ditambahkan pada `T-W2-01`:

| Paket | Versi | Alasan |
|---|---|---|
| `@expo/vector-icons` | `^15.0.2` | Ikon tab dan status; tersedia di Expo Go |
| `expo-linear-gradient` | `~58.0.4` | Gradient latar hangat |

**Keputusan:** `expo-blur` **tidak** ditambahkan. Android dan iOS < 26 memakai panel semi-opaque. Alasan: menghindari biaya performa dan ketidakkonsistenan blur di Android untuk keuntungan visual yang kecil.

**Keputusan:** tab bar memakai `Tabs` dari `expo-router/js-tabs` dengan `tabBar` kustom, menggantikan `NativeTabs`. Catatan penting: `Tabs` dari `expo-router` sudah ditandai *deprecated* pada SDK 58, sehingga impor harus dari `expo-router/js-tabs`. Tipe `BottomTabBarProps` di SDK 58 tidak memuat `navigation`; gunakan `emitter`, `navigateToTab`, dan `insets`.

## 11. Aset

Tidak ada aset gambar yang dibutuhkan. Semua elemen visual dibentuk dari kode:

| Aset | Pengganti | Catatan |
|---|---|---|
| Latar hangat ter-blur | `ScreenBackground` | `expo-linear-gradient` + dua blob `View` |
| Wordmark | `Wordmark` | Teks "Patch" (600) + "Radar" (300), 19px |
| Ikon tab | `@expo/vector-icons` (Ionicons) | `scan-outline`, `time-outline`, `information-circle-outline` |
| Ikon status | `@expo/vector-icons` | Ditentukan saat komponen badge dibuat |

Ikon aplikasi dan splash masih memakai aset bawaan Expo pada `T-W2-01`; penggantian ikon aplikasi di luar lingkup tugas ini.

## 12. Checklist handoff

- [x] Palet dan peran warna ditetapkan
- [x] Rasio kontras dihitung dan ambang minimum ditetapkan
- [x] Skala tipografi, spacing, radius, dan elevasi ditetapkan
- [x] Spesifikasi lima layar dan lima state dirangkum
- [x] Aturan aksesibilitas ditetapkan
- [x] Tautan Figma tidak diperlukan; spesifikasi lengkap ada di dokumen ini
- [x] Aset gambar digantikan komponen kode (§11)
- [x] Warna severity disetujui pengembang
- [x] Keputusan `expo-blur` dan tab bar diambil (§10)

## 13. Catatan keputusan

Seluruh keputusan terbuka pada versi 1.0 sudah ditutup pada `T-W2-01`:

1. **Warna severity** — disetujui sesuai §3.3.
2. **`textSecondary` `#544B45`** — dipakai; wajib untuk memenuhi kontras AA.
3. **`hairline` `#6B605A`** — dipakai untuk batas input dan pemisah (≥3:1).
4. **Tab bar kaca** — memakai `Tabs` dari `expo-router/js-tabs` dengan `tabBar` kustom.
5. **Efek kaca Android** — tanpa `expo-blur`; memakai panel semi-opaque.
6. **Mode gelap** — tidak diaktifkan pada MVP; `app.json` dikunci ke `light`.
7. **Web** — `react-native-web` tidak menyediakan `AccessibilityInfo.isReduceTransparencyEnabled`. `useReduceTransparency` mendeteksi kemampuan lewat `app/src/lib/reduce-transparency.ts` dan memakai fallback opaque di web; tidak ada efek kaca dan tidak ada error.
