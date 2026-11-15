# Metrik Operasional (T-W3-11, S)

Dokumen ini mendefinisikan metrik agregat, sumber data (kolom/tabel), query SQL (SELECT-only), aturan privasi, dan catatan retensi log. **Tidak ada migrasi, deploy, atau perubahan perilaku** yang dibuat.

## 1. Sumber data (skema tersimpan)

Dari `supabase/migrations/20261115000000_scans_findings_rate_limit.sql`:

- **`public.scans`**: `id` (uuid), `user_id` (uuid), `repo_owner`, `repo_name`, `repo_url`, `status` (`COMPLETED|PARTIAL`), `manifest_source`, `lockfile_format`, `estimated`, `total_packages`, `affected_packages`, `finding_count`, `partial` (bool), `warnings` (jsonb), `source_status` (jsonb), `engine_version`, `duration_ms`, `created_at`.
- **`public.findings`**: `id`, `scan_id`, `label` (`FIX_NOW|SCHEDULE|MONITOR`), `severity`, `osv_id`, dll., `created_at`.
- **`public.rate_limit_events`**: `id`, `user_id`, `ip_hash`, `kind` (default `scan`), `created_at`.

`scans.source_status` disimpan sebagai objek per sumber, mis. `{"osv":"CACHE"|"OK"|"PARTIAL"|"FAILED"|...,"kev":...,"epss":...}` (persist/response).

## 2. Definisi metrik dan keterhitungan

| Metrik | Definisi | Kolom/tabel | Status |
|---|---|---|---|
| Tingkat cache hit OSV | Persentase scan (dengan `source_status->>'osv'` tidak null) yang `source_status->>'osv' = 'CACHE'`. Definisi operasional: **hit = state `CACHE`**; non-hit mencakup `OK`/`PARTIAL`/`FAILED`/`STALE`/`EMPTY`/lainnya. Denominator dapat juga dilaporkan sebagai seluruh scan. | `public.scans.source_status` (jsonb), `scans.created_at` (opsional bucket) | **Dapat dihitung** dari data tersimpan (agregat). |
| Tingkat hasil parsial | Persentase scan dengan `partial = true` (atau `status = 'PARTIAL'`). | `public.scans.partial`, `public.scans.status` | **Dapat dihitung**. |
| Jumlah scan per hari | Hitungan baris `scans` per hari kalender UTC (`date_trunc('day', created_at)`). | `public.scans.created_at` | **Dapat dihitung**. |
| Distribusi label temuan | Hitungan findings per `label` (`FIX_NOW`, `SCHEDULE`, `MONITOR`). | `public.findings.label` | **Dapat dihitung**. |
| Rasio 429 terhadap total panggilan | `(jumlah respons 429 RATE_LIMITED aplikasi) / (total panggilan scan)` pada jendela waktu. | **Tidak tersimpan lengkap.** `rate_limit_events` mencatat event scan yang diizinkan/dicatat (kind `scan`), bukan panggilan yang ditolak 429; tidak ada tabel log permintaan total/429 di DB. | **Belum dapat dihitung dari data tersimpan.** |

### Metrik yang belum dapat dihitung (dan usulan, tanpa migrasi dibuat)

- **Rasio 429 terhadap total panggilan:** butuh data penolakan 429 dan/atau total permintaan. Opsi (butuh migrasi/perubahan terpisah, **tidak dibuat**): (a) tambah kolom/jenis event di `rate_limit_events` (mis. `kind='scan_rejected_429'` atau kolom `outcome`) untuk mencatat penolakan, atau (b) tabel agregat harian (`scan_request_counts`: date, allowed, rejected_429, dll.), atau (c) hitung dari log platform (di luar DB aplikasi) dengan ekspor/agregasi. Hingga ada penyimpanan/ekstraksi, rasio 429 **belum dapat dihitung** dari data tersimpan.

(Catatan: metrik lain yang diminta — cache hit OSV, parsial, scan/hari, distribusi label — **dapat** dihitung dari kolom tersimpan seperti didefinisikan di atas.)

## 3. Query SQL agregat (SELECT-only, tanpa PII)

Semua query berikut hanya menghasilkan hitungan/persentase/bucket waktu. **Tidak** memilih `user_id`, `repo_owner`, `repo_name`, `repo_url`, manifest, JWT, token, atau kolom pengidentifikasi pengguna. Jalankan satu per satu di SQL Editor.

### Q1 — Jumlah scan per hari (UTC) dan total
```sql
SELECT
  date_trunc('day', created_at) AS day_utc,
  count(*)::bigint AS scans
FROM public.scans
GROUP BY 1
ORDER BY 1 DESC;
```
**Kolom hasil yang diharapkan:** `day_utc` (timestamp), `scans` (bigint).

### Q2 — Tingkat hasil parsial
```sql
SELECT
  count(*)::bigint AS total_scans,
  count(*) FILTER (WHERE partial = true)::bigint AS partial_scans,
  count(*) FILTER (WHERE status = 'PARTIAL')::bigint AS status_partial_scans,
  CASE WHEN count(*) = 0 THEN NULL
       ELSE round((count(*) FILTER (WHERE partial = true))::numeric / count(*) * 100, 2)
  END AS partial_rate_pct
FROM public.scans;
```
**Kolom hasil yang diharapkan:** `total_scans`, `partial_scans`, `status_partial_scans`, `partial_rate_pct`.

### Q3 — Tingkat cache hit OSV (berdasarkan `source_status.osv`)
```sql
SELECT
  count(*)::bigint AS total_scans,
  count(*) FILTER (WHERE source_status ? 'osv')::bigint AS scans_with_osv_status,
  count(*) FILTER (WHERE source_status->>'osv' = 'CACHE')::bigint AS osv_cache_hits,
  CASE WHEN count(*) FILTER (WHERE source_status ? 'osv') = 0 THEN NULL
       ELSE round((count(*) FILTER (WHERE source_status->>'osv' = 'CACHE'))::numeric
                  / (count(*) FILTER (WHERE source_status ? 'osv')) * 100, 2)
  END AS osv_cache_hit_pct
FROM public.scans;
```
**Kolom hasil yang diharapkan:** `total_scans`, `scans_with_osv_status`, `osv_cache_hits`, `osv_cache_hit_pct`.

### Q4 — Rincian status sumber OSV (agregat)
```sql
SELECT
  COALESCE(source_status->>'osv', '(null)') AS osv_status,
  count(*)::bigint AS scans
FROM public.scans
GROUP BY 1
ORDER BY scans DESC, osv_status;
```
**Kolom hasil yang diharapkan:** `osv_status` (text), `scans` (bigint).

### Q5 — Distribusi label temuan
```sql
SELECT
  label,
  count(*)::bigint AS findings
FROM public.findings
GROUP BY label
ORDER BY findings DESC, label;
```
**Kolom hasil yang diharapkan:** `label` (`FIX_NOW|SCHEDULE|MONITOR`), `findings` (bigint).

### Q6 — Ringkasan rate_limit_events (agregat, tanpa per-pengguna)
```sql
SELECT
  count(*)::bigint AS events,
  min(created_at) AS first_event_at,
  max(created_at) AS last_event_at,
  count(DISTINCT kind)::bigint AS distinct_kinds
FROM public.rate_limit_events;
```
**Kolom hasil yang diharapkan:** `events`, `first_event_at`, `last_event_at`, `distinct_kinds`. (Tidak mengelompokkan per pengguna; tidak menampilkan `user_id`/`ip_hash`.)

**Catatan rasio 429:** tidak ada query DB yang valid untuk rasio 429/total panggilan karena penolakan 429 tidak tersimpan sebagai event; `rate_limit_events` merepresentasikan event tercatat (scan diizinkan), bukan total request termasuk 429. **Belum dapat dihitung.**

## 4. `supabase/functions/scan/metrics.ts`

**Tidak dibuat.** Alasan: metrik yang dapat dihitung saat ini diperoleh langsung dari query SQL agregat di atas (tanpa transformasi domain khusus di runtime). Fungsi murni penghitungan dari baris agregat hanya akan menjadi lapisan tipis tanpa kebutuhan saat ini dan berisiko menambah permukaan kode; bila kelak diperlukan (mis. ekspor terprogram dengan bentuk stabil), dapat ditambahkan terpisah dengan unit test tanpa mengubah perilaku handler/log.

## 5. Retensi log terstruktur & privasi log

**Field log (fungsi `scan`, `ScanLogEntry` / `defaultLogger` di `supabase/functions/scan/handler.ts`):** `requestId`, `owner`, `repo`, `status`, `githubMs`, `parseMs`, `registryMs`, `osvMs`, `kevMs`, `epssMs`, `findingsMs`, `labelMs`, `syncMs`, `totalMs`, `sourceStatus` (`osv/kev/epss`), `stages[]` (`name, async, ms`). Logger: `console.log(JSON.stringify(entry))`.

**Konfirmasi pemeriksaan kode:** log **tidak** memuat JWT, token akses, `Authorization`/apikey, isi manifest (`package.json`/lockfile), atau `user_id`. Log **memuat** `owner` dan `repo` (identitas repositori target yang dipindai) serta `requestId` dan durasi/status — bukan "nama repo pengguna" sebagai identitas akun, tetapi nama repo target; ini dicatat apa adanya. Tidak ada log tambahan data pribadi yang ditemukan pada `handler.ts`.

**Retensi log platform Supabase (plan):** **[PERLU DIVERIFIKASI]** untuk plan proyek ini. Dokumentasi resmi (diakses 15 November 2026): [Logs in Studio](https://supabase.com/docs/guides/platform/logs) menyatakan "Retention depends on your [pricing plan](https://supabase.com/pricing). See [Manage Logs usage](https://supabase.com/docs/guides/platform/manage-your-usage/logs) for billing details."; [Pricing](https://supabase.com/pricing) memuat tabel "Platform Security and Compliance" dengan baris "Log retention (API & Database)" per plan (nilai angka tidak disalin dari ingatan di sini — **rujuk tabel resmi pada URL di atas untuk plan yang berlaku**). Plan aktual proyek **[PERLU DIVERIFIKASI]**.

## 6. Hasil pengukuran

Hasil ditempel pengembang (SQL Editor, 15 November 2026). Angka tidak dikarang.

**Q1 — Jumlah scan per hari (UTC) dan total**
| day_utc | scans |
| --- | ---: |
| 2026-11-15 00:00:00+00 | 2 |

**Q2 — Tingkat hasil parsial**
| total_scans | partial_scans | status_partial_scans | partial_rate_pct |
| ---: | ---: | ---: | ---: |
| 2 | 0 | 0 | 0.00 |

**Q3 — Tingkat cache hit OSV (`source_status.osv`)**
| total_scans | scans_with_osv_status | osv_cache_hits | osv_cache_hit_pct |
| ---: | ---: | ---: | ---: |
| 2 | 2 | 1 | 50.00 |

**Q4 — Rincian status sumber OSV (agregat)**
| osv_status | scans |
| --- | ---: |
| CACHE | 1 |
| OK | 1 |

**Q5 — Distribusi label temuan**
| label | findings |
| --- | ---: |
| MONITOR | 4 |

**Q6 — Ringkasan rate_limit_events (agregat, tanpa per-pengguna)**
| events | first_event_at | last_event_at | distinct_kinds |
| ---: | --- | --- | ---: |
| 7 | 2026-11-15 14:32:07.514+00 | 2026-11-15 14:34:57.843+00 | 1 |

**Rasio 429 terhadap total panggilan:** **belum dapat dihitung dari data tersimpan** (penolakan 429 tidak dicatat di `rate_limit_events`; total panggilan tidak tersimpan). Lihat §2.

## 7. Status AC T-W3-11

- (a) Metrik agregat dapat dihitung dari data tersimpan: **Terbukti** untuk metrik yang kolomnya tersimpan — cache hit OSV, tingkat hasil parsial, jumlah scan per hari, distribusi label temuan (Q1–Q5). **Rasio 429 terhadap total panggilan belum dapat dihitung** dari data tersimpan (data penolakan/total request tidak tersedia; opsi dicatat di §2 tanpa migrasi).
- (b) Tidak ada data pribadi di metrik/log: **Terbukti.** Query agregat hanya hitungan/persentase/bucket waktu (tanpa `user_id`, repo/manifest, JWT, identitas pengguna). Pemeriksaan `ScanLogEntry`/`defaultLogger` (`handler.ts`): memuat `requestId`, `owner`/`repo` target, status, durasi per sumber & total, `sourceStatus`, `stages`; **tidak** memuat JWT/token/isi manifest/`user_id`.
- (c) `requestId` dan durasi per sumber tetap tersedia: **Terbukti** dari struktur log dan bukti log dashboard teramati (mis. `req_29bdf45c091b48d6a2a7ae4fa0f9cfa0` dengan durasi per sumber & `stages`).
