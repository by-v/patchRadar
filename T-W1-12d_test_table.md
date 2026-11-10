# T-W1-12d — Tabel Kasus Uji Integrasi (hanya nilai teramati)

Kolom: kasus | repo (owner/nama) | manifest.source | status | totalPackages | findingCount | sourceStatus | partial | warnings | githubMs/registryMs/osvMs/kevMs/epssMs/totalMs | wall sinkron | requestId

Sumber: `docs/scan-12d-evidence.json`, `docs/scan-12d-body.json`, `docs/scan-12d-axios.json`, `docs/scan-12d-small.json`, `docs/scan-12d-logs.json`, `docs/scan-12d-cpu.json`, `docs/scan-12d-kev-epss.json`, `docs/scan-12d-cache-url.json`, `docs/scan-12d-cache-probe.json`. `totalMs` dan durasi per sumber diambil dari log fungsi `function_logs` (bukan dari klien). `wall sinkron` = `syncMs` pada log yang sama. `belum diverifikasi` berarti tidak ada artefak pengamatan, bukan perkiraan.

| kasus | repo (owner/nama) | manifest.source | status | totalPackages | findingCount | sourceStatus | partial | warnings | githubMs/registryMs/osvMs/kevMs/epssMs/totalMs | wall sinkron | requestId |
|---|---|---|---|---|---|---|---|---|---|---|---|
| valid_lockfile_v3 — cache dingin, 1.179 paket | socketio/socket.io | LOCKFILE v3 | 200 | 1.179 | 24 | github=OK, osv=PARTIAL, kev=CACHE, epss=FAILED | true | LOCKFILE_PARTIAL; OSV_CACHE_READ_FAILED; EPSS_UNAVAILABLE | 799/0/12.493/1.489/727/15.526 | 14 ms | req_da314650ef494e4ea84fb06002623cd1 |
| valid_lockfile_v3 — cache hangat, 1.179 paket | socketio/socket.io | LOCKFILE v3 | 200 | 1.179 | 24 | github=OK, osv=PARTIAL, kev=CACHE, epss=FAILED | true | LOCKFILE_PARTIAL; OSV_CACHE_READ_FAILED; EPSS_UNAVAILABLE | 478/0/10.238/816/8/11.553 | 11 ms | req_e30adfc793314aabb51d154ba8af5e26 |
| valid_lockfile_v3 — badan respons lengkap, 1.179 paket | socketio/socket.io | LOCKFILE v3 | 200 | 1.179 | 24 | github=OK, osv=PARTIAL, kev=CACHE, epss=FAILED | true | LOCKFILE_PARTIAL; OSV_CACHE_READ_FAILED; EPSS_UNAVAILABLE | 487/0/10.771/860/14/12.151 | 14 ms | req_a5c5a549d0bb419f9de85c863325f1ee |
| valid_lockfile_v3 — 679 paket | axios/axios | LOCKFILE v3 | 200 | 679 | 2 | github=OK, osv=PARTIAL, kev=CACHE, epss=FAILED | true | OSV_CACHE_READ_FAILED; EPSS_UNAVAILABLE | 1.073/0/6.658/1.037/11/8.788 | 8 ms | req_d2330df453ca4589bc8752792e094665 |
| valid_lockfile_v3 — cache dingin (03:13; `osv_cache` 721 baris) | axios/axios | LOCKFILE v3 | 200 | 679 | 2 | github=OK, osv=PARTIAL, kev=OK, epss=FAILED | true | OSV_CACHE_READ_FAILED; EPSS_UNAVAILABLE | 1.145/0/7.545/1.138/742/10.582 | 10 ms | req_0a806fcf99d742daa17471ef15442900 |
| lockfile_v1_fallback — cache dingin (03:13) | lodash/lodash | PACKAGE_JSON (`estimated=true`) | 200 | 27 | 6 | github=OK, osv=OK, kev=CACHE, epss=OK | false | LOCKFILE_V1 | 1.085/645/1.527/807/730/4.798 | 5 ms | req_bd14b50433e641c0bceaf0dc4bd4679f |
| lockfile_v1_fallback — cache hangat (07:29) | lodash/lodash | PACKAGE_JSON (`estimated=true`) | 200 | 27 | 6 | github=OK, osv=CACHE, kev=CACHE, epss=OK | false | LOCKFILE_V1 | 1.067/742/867/942/13/3.639 | 5 ms | req_6bd6c8d0f96b47819b4984e907f72dc7 |
| valid_no_lockfile — cache dingin (03:13) | expressjs/express | PACKAGE_JSON (`estimated=true`) | 200 | 44 | 1 | github=OK, osv=OK, kev=CACHE, epss=OK | false | LOCKFILE_MISSING | 641/516/1.245/765/725/4.135 | 3 ms | req_0bf9e29758db430c8dcf59114dcccb9c |
| valid_no_lockfile — cache hangat (07:30) | expressjs/express | PACKAGE_JSON (`estimated=true`) | 200 | 44 | 1 | github=OK, osv=CACHE, kev=CACHE, epss=OK | false | LOCKFILE_MISSING | 1.603/395/266/677/13/3.198 | 1 ms | req_d0e69a04c2334e61afe251b0d2460d87 |
| repo_not_found | patchradar-uji-tidak-ada-xyz/repo-tidak-ada-12345 | — | 404 | — | — | — | — | REPO_NOT_FOUND_OR_PRIVATE | 0/0/0/0/0/294 | 0 ms | req_a6f9e88fc0d8411bb7d5411149ffd0d7 |
| invalid_url | — (bukan URL) | — | 400 | — | — | — | — | INVALID_URL | 0/0/0/0/0/0 | 0 ms | req_66d89f3ef4f2476390bfbba01d5aa240 |
| tanpa_jwt | axios/axios | — | 401 | — | — | — | — | — (ditolak gateway) | — | — | null |
| redirect_upstream | facebook/react (301 → react/react) | — | 502 | — | — | — | — | UPSTREAM_UNAVAILABLE | 0/0/0/0/0/326 | 0 ms | req_7565e5db2e1e49f98771433926c65abc |
| EPSS gagal (alami, 07:13–07:19) | socketio/socket.io; axios/axios | LOCKFILE v3 | 200 | 1.179; 679 | 24; 2 | epss=FAILED pada keempat scan | true | EPSS_UNAVAILABLE | lihat baris 1–5 | 8–14 ms | req_da314650…, req_e30adfc7…, req_a5c5a549…, req_d2330df4… |
| OSV gagal total → 502 | belum disimulasikan | — | belum diverifikasi | — | — | — | — | — | — | — | — |
| KEV tidak tersedia / STALE | belum disimulasikan | — | belum diverifikasi | — | — | — | — | — | — | — | — |
| CPU platform `scan` (Agregat 1 jam) | — | — | — | — | — | — | — | — | CPU max 345 ms (04:00), 214 ms (03:00), 158 ms (07:00); CPU 02:00 = 0 (metrik tidak tersedia) | — | — |
| `[MANUAL]` dashboard CPU | — | — | belum dilaporkan pengembang | — | — | — | — | — | — | — | — |
| cache hangat 1.000–1.500 paket (tanpa panggilan OSV) | socketio/socket.io; axios/axios | LOCKFILE v3 | 200 tetapi `osv=PARTIAL` | 1.179; 679 | 24; 2 | osv=PARTIAL | true | OSV_CACHE_READ_FAILED | lihat baris 1–5 | — | lihat baris 1–5 |

## Bukti per AC

- **AC1 endpoint remote 200:** terbukti oleh baris socket.io, axios, lodash, dan express (200) dengan `requestId` yang cocok dengan header `X-Request-Id`.
- **AC2 EPSS gagal → 200 + `partial=true` + warning:** terbukti alami pada empat scan 07:13–07:19 UTC: `sourceStatus.epss=FAILED`, `partial=true`, warning `EPSS_UNAVAILABLE`. Bukan simulasi yang disuntikkan; kegagalan nyata dari EPSS.
- **AC3 OSV gagal total → 502:** **belum terbukti**. Tidak ada mekanisme flag uji/fault-injection di runtime remote. Paket socket.io/axios sudah ada di `osv_cache` atau gagal dibaca lalu diquery ulang; memaksa 502 memerlukan penghapusan baris cache (di luar izin) atau deploy kode uji (di luar izin). Unit test `osv.test.ts` membuktikan jalur 502, tetapi itu bukan bukti remote.
- **AC4 KEV tidak tersedia/STALE:** **belum terbukti**. Refresh KEV nyata teramati di `req_0a806fcf…` (03:13:50 UTC): `kevMs=1.138`, `kev=OK`, tahap `kev.catalog.fetch` ada. Scan berikutnya `kev=CACHE` dan `kev.catalog.fetch` tidak ada. Kondisi gagal/basi belum dipicu; butuh fault injection atau salinan > 24 jam, keduanya belum dijalankan.
- **AC5 log durasi per sumber + CPU:** durasi per sumber tersedia di `function_logs` (`githubMs`/`registryMs`/`osvMs`/`kevMs`/`epssMs`). CPU platform tersedia lewat Management API `functions.combined-stats`: nilai tertinggi 345 ms (04:00 UTC), jauh di bawah 2.000 ms. Dashboard manual belum dikonfirmasi.
- **AC6 wall time tahap sinkron:** `syncMs` 1–14 ms; rincian tahap tersimpan di `docs/scan-12d-logs.json`. Contoh `req_0a806fcf…`: `manifest.parse=5,229 ms`, `kev.parse=1,638 ms`, `findings.assembly=0,924 ms`, `kev.match=0,579 ms`, `response.build=1,487 ms`, `response.serialize=0,034 ms`, total `syncMs=10 ms` (pembulatan log). `labelMs` di log = `response.build` (skor/label dihitung di dalamnya). Jumlah ini adalah batas atas CPU pipeline sinkron.
- **AC7 `[MANUAL]` dashboard:** angka platform sudah dicatat di `docs/scan-12d-cpu.json`, tetapi pemeriksaan dashboard oleh pengembang belum dilaporkan. AC ini tetap terbuka.
- **AC8 bukti baris cache + scan kedua tanpa OSV:** terbukti untuk repo kecil. `lodash`/`express` pukul 03:13 memakai `osv.batch` (`osv=OK`); pukul 03:37, 04:40, 07:29/07:30 tidak ada `osv.batch` dan `osv=CACHE`. **Tidak terbukti untuk 1.000–1.500 paket**: `getMany` membangun satu URL `cache_key=in.(...)` yang terlalu panjang. Panjang URL ter-encode: axios 24.047 karakter (679 kunci), socket.io 37.768 karakter (1.179 kunci). Probe service-role lokal: 100 kunci → 200 (URL 5.560), 200 kunci → 200 (9.756), 300 kunci ke atas → `HeadersOverflowError` sebelum terkirim; permintaan 1.179 kunci ke PostgREST → HTTP 400. Edge log tidak memuat GET `osv_cache` untuk axios/socket, konsisten dengan kegagalan di sisi klien. Perbaikan batch 100 kunci sudah ditulis dan lulus 155/155 unit test + typecheck strict, tetapi **belum di-deploy**, sehingga perilaku remote 1.000–1.500 paket masih `PARTIAL` dengan `OSV_CACHE_READ_FAILED`.

## Bukti pendukung yang tersimpan

1. **`docs/scan-12d-evidence.json`:** tiga scan remote (socket.io dingin, socket.io hangat, react) dengan `requestId`, `sourceStatus`, `partial`, `warnings`, dan `timings`.
2. **`docs/scan-12d-body.json` / `docs/scan-12d-axios.json`:** badan respons lengkap 1.179 dan 679 paket; seluruh 24 temuan socket.io memiliki `epss=null` dan `epssAvailable=false` saat EPSS gagal.
3. **`docs/scan-12d-small.json`:** lodash/express hangat dengan `osv=CACHE` dan tanpa `osv.batch`.
4. **`docs/scan-12d-logs.json`:** 39 entri `function_logs` (03:13, 03:37, 04:40, 07:13–07:30), termasuk pasangan dingin/hangat dan tahap sinkron.
5. **`docs/scan-12d-cpu.json`:** metrik `functions.combined-stats` (CPU max 345 ms; eksekusi max 15.671 ms).
6. **`docs/scan-12d-kev-epss.json`:** CISA KEV 200, `catalogVersion=2026.11.09`, `count=1773`, `dateReleased=2026-11-09T19:54:37.4945Z`; EPSS 200, 22/23 CVE socket.io dikembalikan, `CVE-2026-93753` tidak ada skor (bukan error).
7. **`docs/scan-12d-cache-url.json` + `docs/scan-12d-cache-probe.json`:** panjang URL dan hasil probe cache per jumlah kunci.
8. **`kev_entries` (SQL pengembang):** 1.773 baris, `updated_at` terbaru 2026-11-10 03:13:48 UTC; cocok dengan katalog CISA `2026.11.09` (1.773 entri, dirilis 2026-11-09 19:54:37 UTC).
9. **PostgREST anon `osv_cache`:** 401 `42501 permission denied for table osv_cache`; RLS aktif dan tidak ada policy anon/authenticated.

## Selisih dari laporan sebelumnya

- `facebook/react`: klaim 1.240 paket / 1 temuan / status 200 tidak dapat direproduksi. GitHub API mengembalikan 301 ke `react/react`; `scan` tidak mengikuti redirect dan mengembalikan 502 `UPSTREAM_UNAVAILABLE`.
- `expressjs/express`: temuan sebenarnya **1**, bukan 0.
- Angka `osvMs ~300 ms`, `registryMs ~50 ms`, dan `totalMs 420 ms` pada tabel lama tidak punya artefak; dihapus.
- `sourceStatus`/`partial` lama yang kosong kini terisi dari badan respons/log yang tersimpan.
- Kenaikan 1.769 → 1.773 bukan anomali: katalog CISA berubah dari `2026.11.06` (1.769) ke `2026.11.09` (1.773).

## Hal yang belum boleh diklaim

- **OSV gagal total (502)** dan **KEV STALE/tidak tersedia** belum dipicu di remote. Hanya unit test yang membuktikan jalur kode.
- **CPU nyata pipeline** tidak diukur per request; angka 345 ms adalah `max_cpu_time_used` agregat per jam dari Management API, bukan CPU satu scan. Angka ini tidak boleh dipakai sebagai p95.
- **Dashboard CPU** belum diperiksa pengembang.
- **Cache hangat 1.000–1.500 paket** belum terbukti karena cacat URL `in.(...)`; perbaikan belum di-deploy.
- **`facebook/react`** tidak dapat dipakai sebagai kasus "tanpa lockfile"; gunakan `lodash`/`express` atau repo lain yang tidak redirect.
