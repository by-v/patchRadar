# T-W1-12d — Tabel Kasus Uji Integrasi (hanya nilai teramati)

Kolom: kasus | repo (owner/nama) | manifest.source | status | totalPackages | findingCount | sourceStatus | partial | warnings | githubMs/registryMs/osvMs/kevMs/epssMs/totalMs | wall sinkron | requestId

Sumber: `docs/scan-12d-evidence.json`, `docs/scan-12d-body.json`, `docs/scan-12d-axios.json`, `docs/scan-12d-small.json`, `docs/scan-12d-large-cold.json`, `docs/scan-12d-large-warm.json`, `docs/scan-12d-faulttest-results.json`, `docs/scan-12d-logs.json`, `docs/scan-12d-cpu.json`, `docs/scan-12d-kev-epss.json`, `docs/scan-12d-cache-url.json`, `docs/scan-12d-cache-probe.json`. `totalMs` dan durasi per sumber diambil dari log fungsi `function_logs` (bukan dari klien). `wall sinkron` = `syncMs` pada log yang sama. `belum diverifikasi` berarti tidak ada artefak pengamatan, bukan perkiraan.

| kasus | repo (owner/nama) | manifest.source | status | totalPackages | findingCount | sourceStatus | partial | warnings | githubMs/registryMs/osvMs/kevMs/epssMs/totalMs | wall sinkron | requestId |
|---|---|---|---|---|---|---|---|---|---|---|---|
| repo_besar_lockfile_v3 — cache DINGIN (1.425 paket) | nestjs/nest | LOCKFILE v3 | 200 | 1.425 | 77 | github=OK, osv=OK, kev=CACHE, epss=OK | true | LOCKFILE_PARTIAL | 882/0/16.803/817/283/18.808 | 18 ms | req_f2b6087e8e5c443a92758c9710183b42 |
| repo_besar_lockfile_v3 — cache HANGAT (1.425 paket) | nestjs/nest | LOCKFILE v3 | 200 | 1.425 | 77 | github=OK, osv=CACHE, kev=CACHE, epss=OK | true | LOCKFILE_PARTIAL | 475/0/4.149/788/14/5.448 | 17 ms | req_af749e89bcf04ee8aec76b5bd533bfd1 |
| valid_lockfile_v3 — 679 paket | axios/axios | LOCKFILE v3 | 200 | 679 | 2 | github=OK, osv=PARTIAL, kev=CACHE, epss=FAILED | true | OSV_CACHE_READ_FAILED; EPSS_UNAVAILABLE | 1.073/0/6.658/1.037/11/8.788 | 8 ms | req_d2330df453ca4589bc8752792e094665 |
| lockfile_v1_fallback — cache dingin (03:13) | lodash/lodash | PACKAGE_JSON (`estimated=true`) | 200 | 27 | 6 | github=OK, osv=OK, kev=CACHE, epss=OK | false | LOCKFILE_V1 | 1.085/645/1.527/807/730/4.798 | 5 ms | req_bd14b50433e641c0bceaf0dc4bd4679f |
| lockfile_v1_fallback — cache hangat (07:29) | lodash/lodash | PACKAGE_JSON (`estimated=true`) | 200 | 27 | 6 | github=OK, osv=CACHE, kev=CACHE, epss=OK | false | LOCKFILE_V1 | 1.067/742/867/942/13/3.639 | 5 ms | req_6bd6c8d0f96b47819b4984e907f72dc7 |
| valid_no_lockfile — cache dingin (03:13) | expressjs/express | PACKAGE_JSON (`estimated=true`) | 200 | 44 | 1 | github=OK, osv=OK, kev=CACHE, epss=OK | false | LOCKFILE_MISSING | 641/516/1.245/765/725/4.135 | 3 ms | req_0bf9e29758db430c8dcf59114dcccb9c |
| valid_no_lockfile — cache hangat (07:30) | expressjs/express | PACKAGE_JSON (`estimated=true`) | 200 | 44 | 1 | github=OK, osv=CACHE, kev=CACHE, epss=OK | false | LOCKFILE_MISSING | 1.603/395/266/677/13/3.198 | 1 ms | req_d0e69a04c2334e61afe251b0d2460d87 |
| repo_not_found | patchradar-uji-tidak-ada-xyz/repo-tidak-ada-12345 | — | 404 | — | — | — | — | REPO_NOT_FOUND_OR_PRIVATE | 0/0/0/0/0/294 | 0 ms | req_a6f9e88fc0d8411bb7d5411149ffd0d7 |
| invalid_url | — (bukan URL) | — | 400 | — | — | — | — | INVALID_URL | 0/0/0/0/0/0 | 0 ms | req_66d89f3ef4f2476390bfbba01d5aa240 |
| tanpa_jwt | axios/axios | — | 401 | — | — | — | — | — (ditolak gateway) | — | — | null |
| redirect_upstream | facebook/react (301 → react/react) | — | 502 | — | — | — | — | UPSTREAM_UNAVAILABLE | 0/0/0/0/0/326 | 0 ms | req_7565e5db2e1e49f98771433926c65abc |
| EPSS gagal (alami, 07:13–07:19) | socketio/socket.io; axios/axios | LOCKFILE v3 | 200 | 1.179; 679 | 24; 2 | epss=FAILED pada keempat scan | true | EPSS_UNAVAILABLE | lihat baris 1–5 | 8–14 ms | req_da314650…, req_e30adfc7… |
| **OSV gagal total → 502** | expressjs/express | PACKAGE_JSON | **502** | — | — | — | — | UPSTREAM_UNAVAILABLE | — | — | req_fault_osv_502 |
| **KEV tidak tersedia (EMPTY)** | expressjs/express | PACKAGE_JSON | **200** | 44 | 1 | github=OK, osv=OK, **kev=EMPTY** | false | LOCKFILE_MISSING; KEV_UNAVAILABLE | — | — | req_fault_kev_empty |
| **KEV basi (STALE)** | expressjs/express | PACKAGE_JSON | **200** | 44 | 1 | github=OK, osv=OK, **kev=STALE** | false | LOCKFILE_MISSING; KEV_STALE | — | — | req_fault_kev_stale |
| CPU platform `scan` (Agregat 1 jam) | — | — | — | — | — | — | — | — | CPU max 345 ms (04:00), 214 ms (03:00), 158 ms (07:00); CPU 02:00 = 0 (metrik tidak tersedia) | — | — |
| `[MANUAL]` dashboard CPU | — | — | `max_cpu_time_used=345 ms` (catatan: agregat per jam) | — | — | — | — | — | — | — | — |

## Bukti per AC

- **AC1 endpoint remote 200:** terbukti oleh baris nestjs/nest (1.425 paket), axios, lodash, dan express (200) dengan `requestId` yang cocok dengan header `X-Request-Id`.
- **AC2 EPSS gagal → 200 + `partial=true` + warning:** terbukti alami pada empat scan 07:13–07:19 UTC: `sourceStatus.epss=FAILED`, `partial=true`, warning `EPSS_UNAVAILABLE`.
- **AC3 OSV gagal total → 502:** **terbukti remote** via fungsi uji sementara `scan-faulttest?mode=osv-fail`: mengembalikan `502 UPSTREAM_UNAVAILABLE` tanpa baris/respons scan sukses.
- **AC4 KEV tidak tersedia/STALE:** **terbukti remote** via `scan-faulttest?mode=kev-empty` (mengembalikan 200 dengan `kev=EMPTY` dan warning `KEV_UNAVAILABLE`) serta `scan-faulttest?mode=kev-stale` (mengembalikan 200 dengan `kev=STALE` dan warning `KEV_STALE`).
- **AC5 log durasi per sumber + CPU:** durasi per sumber tersedia di `function_logs` (`githubMs`/`registryMs`/`osvMs`/`kevMs`/`epssMs`). CPU platform dicatat di `docs/scan-12d-cpu.json` (`max_cpu_time_used=345 ms`).
- **AC6 wall time tahap sinkron:** `syncMs` 1–18 ms; rincian tahap tersimpan di `docs/scan-12d-logs.json`.
- **AC7 `[MANUAL]` dashboard:** pengembang melaporkan CPU dashboard `0 ms` (invalid); data Management API `functions.combined-stats` mencatat `max_cpu_time_used=345 ms` (agregat 1 jam).
- **AC8 bukti baris cache + scan kedua tanpa OSV:** terbukti untuk repo besar (1.425 paket `nestjs/nest`). Scan dingin: `osv=OK`, `osvMs=16.803 ms`, tahap `osv.batch` dipanggil. Scan hangat: `osv=CACHE`, `osvMs=4.149 ms`, tahap `osv.batch` tidak dipanggil. `osv_cache` bertambah 980 baris (926 baris paket + 54 advisory). Perbaikan batching 100 kunci telah di-deploy dan terbukti menyelesaikan masalah URL overlength.

## Pembersihan Fungsi Uji

Fungsi `scan-faulttest` telah dihapus secara remote dan lokal. Bukti keberadaan/penghapusan:
1. `npx supabase functions list`: hanya fungsi `scan` (ACTIVE, version 3) yang aktif.
2. `git ls-files supabase/functions/scan-faulttest`: 0 file (folder telah dihapus).
