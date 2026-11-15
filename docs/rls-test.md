# Uji Isolasi RLS Dua Pengguna Anonim

- **Tanggal:** 15 November 2026
- **Tugas:** `T-W3-08`
- **Lingkungan:** proyek Supabase remote (`umldsfkvifqoqfbouhca`), dua sesi anonim, Edge Function `scan` yang sudah ada. Tidak ada `db push`, deploy, `secrets set`, atau akses `service_role`.
- **Perintah persis:**

```powershell
node --env-file=app/.env scripts/rls-check.mjs
```

Skrip membaca `EXPO_PUBLIC_SUPABASE_URL` dan `EXPO_PUBLIC_SUPABASE_ANON_KEY` dari environment proses. Isi `app/.env` tidak dibaca, dicetak, atau disimpan oleh skrip; keluaran hanya label, status HTTP, jumlah baris, `requestId`, dan 8 karakter pertama user id.

## Versi migrasi

Migrasi yang berlaku per 15 November 2026 (nama berkas di `supabase/migrations/`):

1. `20261110000000_osv_cache.sql`
2. `20261110000100_kev_entries.sql`
3. `20261114000000_epss_cache.sql`
4. `20261115000000_scans_findings_rate_limit.sql`

## Keluaran skrip (persis)

```text
{"check":"signup_A","http":200,"rows":null,"requestId":null}
{"check":"signup_B","http":200,"rows":null,"requestId":null}
{"check":"users_berbeda","http":200,"rows":null,"requestId":null,"userA":"c138a815","userB":"3ae12066","berbeda":true}
{"check":"scan_A","http":200,"rows":1,"requestId":"req_ee553fc2d99740babab507e2e71d2d7e","scanId":"d9c45f6e-1ce3-4bdd-80c9-c5f43084194a","persisted":false}
{"check":"A_baca_scans","http":404,"rows":null,"requestId":null}
{"check":"A_baca_findings","http":404,"rows":null,"requestId":null}
{"check":"A_baca_scan_by_id","http":404,"rows":null,"requestId":null}
{"check":"validitas","http":null,"rows":null,"requestId":"req_ee553fc2d99740babab507e2e71d2d7e","valid":false,"alasan":"persisted bukan true atau A tidak dapat membaca scan miliknya"}
{"check":"gagal","http":null,"rows":null,"requestId":null}
Uji TIDAK VALID: scan A tidak tersimpan atau tidak terbaca oleh A. Isolasi tidak diklaim.
```

Kode keluar: `1`.

## Hasil per pemeriksaan

| Kode | Pemeriksaan | Harapan | Aktual | Status |
|---|---|---|---|---|
| a | A dan B punya user id berbeda | Berbeda | `c138a815…` vs `3ae12066…` | Lulus |
| b | Scan A | 200, `requestId`, `persisted=true`, `scanId` | 200, `requestId=req_ee553fc2d99740babab507e2e71d2d7e`, `scanId=d9c45f6e-1ce3-4bdd-80c9-c5f43084194a`, **`persisted=false`** | **Gagal → uji tidak valid** |
| c | A membaca `scans`/`findings` miliknya | `scans` ≥ 1 baris | HTTP **404** untuk `scans`, `findings`, dan scan A by id; jumlah baris tidak tersedia | **Gagal → uji tidak valid** |
| d | B membaca `scans`, `findings`, scan A by id | 0 baris atau 401/403 | Tidak dijalankan karena uji berhenti pada prasyarat | Tidak terbukti |
| e | B `PATCH`/`DELETE` scan A lalu A membaca ulang | 0 baris berubah; A tetap ≥ 1 baris | Tidak dijalankan | Tidak terbukti |
| f | B `INSERT` dengan `user_id` milik A | Ditolak | Tidak dijalankan | Tidak terbukti |
| g | B dan tanpa login membaca `osv_cache`/`kev_entries` | Ditolak atau 0 baris | Tidak dijalankan | Tidak terbukti |
| h | Tanpa login membaca `scans`/`findings` | 0 baris atau 401/403 | Tidak dijalankan | Tidak terbukti |

**`requestId` scan A:** `req_ee553fc2d99740babab507e2e71d2d7e`
**`scanId` scan A:** `d9c45f6e-1ce3-4bdd-80c9-c5f43084194a`

## Penyebab uji tidak valid

1. Scan A berhasil dihitung (HTTP 200, `requestId` ada, satu finding), tetapi backend mengembalikan `persisted=false`, artinya hasil tidak tersimpan ke cloud.
2. Ketiga operasi REST milik A ke `/rest/v1/scans` dan `/rest/v1/findings` mengembalikan **HTTP 404**.
3. Pola ini konsisten dengan catatan `T-W3-04` dan `T-W3-05`: migrasi Minggu 3 belum diterapkan ke proyek remote dan Edge Function belum di-deploy ulang dengan penyimpanan cloud. Mengubah remote (`db push`/deploy) berada di luar izin pengujian ini.

Karena A tidak dapat membaca datanya sendiri, isolasi B terhadap A tidak dapat diuji dan **tidak diklaim terbukti**. Tidak ada data uji A yang tersimpan sehingga tidak ada data yang perlu dibiarkan atau dihapus.

## Pemeriksaan policy RLS (grep seluruh migrasi)

Perintah: pencarian `create policy|using|with check` pada seluruh `supabase/migrations/*.sql`. Hasil:

| Tabel | Policy | Operasi / role | Ekspresi `USING` | `WITH CHECK` |
|---|---|---|---|---|
| `public.scans` | `scans_select_own` | `SELECT` untuk `authenticated` | `user_id = auth.uid()` | Tidak ada |
| `public.findings` | `findings_select_own_scan` | `SELECT` untuk `authenticated` | `exists (select 1 from public.scans s where s.id = findings.scan_id and s.user_id = auth.uid())` | Tidak ada |
| `public.rate_limit_events` | — | — | Tidak ada policy; hanya `service_role` | — |
| `public.osv_cache` | — | — | Tidak ada policy; hanya `service_role` | — |
| `public.kev_entries` | — | — | Tidak ada policy; hanya `service_role` | — |
| `public.epss_cache` | — | — | Tidak ada policy; hanya `service_role` | — |

- Tidak ditemukan policy `USING (true)` maupun `WITH CHECK (true)`.
- Tidak ada policy tulis untuk `authenticated`; `anon`/`authenticated` hanya diberi `SELECT` pada `scans` dan `findings` setelah `REVOKE ALL`.
- **Keterbatasan:** pemeriksaan ini hanya membaca file migrasi. Bukti policy yang benar-benar aktif di database remote akan ditambahkan pengembang melalui SQL dashboard.

## Keterbatasan

- Uji ini tidak membuktikan isolasi RLS karena prasyarat penyimpanan cloud belum terpenuhi; seluruh pemeriksaan B–H belum dijalankan.
- Uji tidak memakai `service_role`, tidak mengubah skema, dan tidak melakukan deploy.
- Data uji A tidak tersimpan; tidak ada baris yang ditinggalkan.
- Uji wajib diulang pada build rilis di Minggu 4 lewat `T-W4-04` ("Jalankan ulang skrip uji RLS dengan dua sesi anonim pada build rilis" dan AC "Uji RLS dua pengguna lulus pada build rilis").
