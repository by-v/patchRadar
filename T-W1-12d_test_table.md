# T-W1-12d — Tabel Kasus Uji Integrasi (hanya angka teramati)

Kolom: kasus | repo (owner/nama) | manifest.source | status | totalPackages | findingCount | sourceStatus | partial | warnings | githubMs/registryMs/osvMs/kevMs/epssMs/totalMs | wall sinkron | requestId

Sumber baris 1–6: `scan_output.txt` (keluaran probe remote yang tersimpan di repo). Nilai `totalMs` di baris itu adalah **clientWallMs** yang diukur di mesin penguji, bukan durasi di dalam fungsi. Durasi per sumber dari log fungsi tidak pernah tersimpan, jadi ditulis `belum diverifikasi`.

| kasus | repo (owner/nama) | manifest.source | status | totalPackages | findingCount | sourceStatus | partial | warnings | githubMs/registryMs/osvMs/kevMs/epssMs/totalMs | wall sinkron | requestId |
|---|---|---|---|---|---|---|---|---|---|---|---|
| valid_lockfile_v3 | axios/axios | LOCKFILE v3 | 200 | 679 | 2 | belum diverifikasi | belum diverifikasi | belum diverifikasi | per sumber: belum diverifikasi; totalMs (client) = 7.771,5 | belum diverifikasi | req_5bd1eaed5c5442d19b3b1e1b78cf1614 |
| lockfile_v1_fallback | lodash/lodash | PACKAGE_JSON (`estimated=true`) | 200 | 27 | 6 | belum diverifikasi | belum diverifikasi | belum diverifikasi | per sumber: belum diverifikasi; totalMs (client) = 1.836,3 | belum diverifikasi | req_d6fead4e2fdd4124b94547a3cb5e1011 |
| valid_no_lockfile | expressjs/express | PACKAGE_JSON (`estimated=true`) | 200 | 44 | 1 | belum diverifikasi | belum diverifikasi | belum diverifikasi | per sumber: belum diverifikasi; totalMs (client) = 1.779,0 | belum diverifikasi | req_5ee4e1a955f340fcbdfed1a958056617 |
| repo_not_found | patchradar-uji-tidak-ada-xyz/repo-tidak-ada-12345 | — | 404 | — | — | — | — | `REPO_NOT_FOUND_OR_PRIVATE` | totalMs (client) = 767,8 | — | req_2764a99137614d37ac226d106be68832 |
| invalid_url | — (bukan-url) | — | 400 | — | — | — | — | `INVALID_URL` | totalMs (client) = 93,2 | — | req_3c325d96f3b54269b3d09e047e7f6ef4 |
| other_host | — (gitlab.com) | — | 400 | — | — | — | — | `INVALID_URL` | totalMs (client) = 109,4 | — | req_527643cb2d1c41d588d5423de3715363 |
| extra_path | — (…/tree/master) | — | 400 | — | — | — | — | `INVALID_URL` | totalMs (client) = 96,9 | — | req_fa4c6fa8aea14376aa20f1628f3ea439 |
| uppercase_host | — (GitHub.com) | — | 400 | — | — | — | — | `INVALID_URL` | totalMs (client) = 103,2 | — | req_e5d1608bbb9a4e03b7852c26c6817f96 |
| tanpa_jwt | axios/axios | — | 401 | — | — | — | — | — | — | — | null |
| react_package_json | facebook/react | belum diverifikasi | belum diverifikasi | belum diverifikasi | belum diverifikasi | — | — | — | belum diverifikasi | belum diverifikasi | belum diverifikasi |
| cache_dingin_large_1500 | belum dijalankan ke remote | LOCKFILE v3 (fixture lokal) | belum diverifikasi | 1.409 unik (terukur lokal) | belum diverifikasi | belum diverifikasi | belum diverifikasi | belum diverifikasi | belum diverifikasi | belum diverifikasi | belum diverifikasi |
| cache_hangat_large_1500 | belum dijalankan ke remote | LOCKFILE v3 (fixture lokal) | belum diverifikasi | 1.409 unik (terukur lokal) | belum diverifikasi | belum diverifikasi | belum diverifikasi | belum diverifikasi | belum diverifikasi | belum diverifikasi | belum diverifikasi |
| kev_runtime | — | — | — | 1.773 baris `kev_entries` | — | belum diverifikasi | — | — | — | — | — |
| epss_tanpa_skor | CVE-9999-99999 | — | 200 | — | — | — | — | — | belum diverifikasi | — | — |

## Bukti pendukung yang benar-benar tersimpan

1. **`osv_cache` (SQL pengembang, 10 November 2026):** 721 baris jenis paket + 9 baris jenis advisory (`osv:advisory:<id>`), seluruhnya ditulis 03:13:40–03:13:57 UTC.
2. **`kev_entries` (SQL pengembang):** 1.773 baris, 1.773 `cveID` unik, `updated_at` terbaru 03:13:48 UTC.
3. **`scan_output.txt`:** sepuluh kasus di atas beserta `requestId` dan `clientWallMs`; `requestIdMatchesHeader=true` untuk semua kasus ber-`requestId`.
4. **`docs/due-diligence-log.md`:** `CVE-9999-99999` → 200, `total=0`, `data=[]` (EPSS tidak memberi skor); `epss=null` + `epssAvailable=false` adalah perilaku yang diwajibkan.
5. **Fixture `fixtures/lockfiles/large-1500/package-lock.json`:** `lockfileVersion` 3, 1.516 entri, 1.409 paket unik (dihitung lokal, bukan bukti remote).

## Selisih dari laporan sebelumnya

- `facebook/react`: klaim 1.240 paket / 1 temuan / status 200 tidak punya artefak di repo. Baris ini sekarang `belum diverifikasi`; SQL pengembang hanya membuktikan tidak ada baris cache yang bisa dikaitkan ke react.
- `expressjs/express`: temuan sebenarnya **1**, bukan 0 (lihat `scan_output.txt`).
- `requestId` axios/lodash/express di tabel lama tidak cocok dengan `scan_output.txt`; nilai di atas diambil langsung dari artefak.
- `osvMs ~300 ms`, `registryMs ~50 ms`, dan `totalMs 420 ms` pada tabel lama adalah estimasi yang tidak berdasar; sudah dihapus.

## Hal yang belum boleh diklaim

- **Durasi per sumber** (`githubMs`, `registryMs`, `osvMs`, `kevMs`, `epssMs`) dan `wall sinkron` per tahap: tidak ada log fungsi yang tersimpan. Angka parser `cpu-spike` hanya berlaku untuk parser lokal/remote terpisah, bukan pipeline `scan`.
- **`sourceStatus` dan `partial`** untuk tiap scan: tidak tersimpan di artefak.
- **KEV `STALE`**: perilaku kode ada, tetapi belum dipicu pada remote; status `[PERLU DIVERIFIKASI]`.
- **Naik 1.769 → 1.773**: katalog CISA tampak bertambah, tetapi `catalogVersion` tidak terbaca dari runtime; catat sebagai "katalog bertambah, belum diverifikasi".
- **RLS**: migrasi menunjukkan `rowsecurity = true` tanpa policy untuk anon/authenticated, tetapi satu permintaan PostgREST dengan anon key belum dijalankan. 401 dari gateway bukan bukti RLS.
- **Docker/`db push`**: yang teramati hanya CLI 3.1.0, `db push --remote --yes` mengembalikan `upToDate:true`, dan `functions deploy --use-api --yes` berhasil. Mekanisme keterkaitan Docker belum diverifikasi.
