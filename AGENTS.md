# AGENTS.md — Aturan Kerja Agent AI PatchRadar

Dokumen ini berlaku untuk semua agent yang mengerjakan repositori ini.

## Sumber kebenaran
- `docs/PRD.md` v1.1 adalah satu-satunya sumber kebenaran. Baca bagian yang relevan sebelum bekerja.
- Jika sebuah keputusan perlu berubah, jangan menyimpang diam-diam: catat di bagian **Catatan keputusan** pada `TASKS.md` dan minta konfirmasi pengembang.

## Alur kerja
- Kerjakan **satu tugas** dalam satu waktu sesuai urutan `TASKS.md`.
- Jangan mulai tugas berikutnya sebelum seluruh kriteria selesai (AC) tugas saat ini terpenuhi.
- Setelah selesai: centang tugas, isi **Catatan hasil:**, lalu commit dengan format `T-xx: ringkasan` (mis. `T-W1-03: uji OSV`; satu commit per tugas).
- Jika tugas terblokir, tandai `[!]` dan tulis alasannya; jangan melewati tugas secara diam-diam.
- Baca hanya file yang diperlukan untuk tugas saat ini. Jika butuh file lain, sebutkan nama file dan alasannya sebelum mengubahnya.
- Jangan berasumsi isi file yang belum dibaca.
- Jangan mengedit `TASKS.md` atau `docs/*` dengan redirect shell; gunakan alat edit. Commit sebelum dan sesudah mengubah berkas besar. Setelah edit, verifikasi jumlah baris/heading dan `git diff --stat`.

## Ruang lingkup
- Jangan menambah fitur di luar MVP PRD.
- Fitur **Backlog Tahap 2** dilarang dikerjakan sebelum seluruh tugas MVP selesai.
- Item prioritas **S** hanya dipotong bila aturan scope PRD §17 memerintahkannya; jangan memotong fitur **M**.

## Keamanan
- Tidak ada secret, token, service role, atau keystore di `app/` maupun di repo.
- Secret hanya lewat environment/secret Supabase atau secret EAS.
- Jangan mencetak JWT, token, atau isi manifest penuh ke log.
- Anon key Supabase boleh ada di APK karena bersifat publik; service role dan token GitHub tidak.

## Kualitas
- Fungsi murni (parser lockfile, resolver versi, normalisasi severity, skor/label, pengurutan) wajib punya unit test.
- Semua teks UI berbahasa Indonesia; nama identifier kode dalam bahasa Inggris.
- TypeScript `strict`; `lint`, `typecheck`, dan `test` wajib lulus sebelum commit.

## Klaim eksternal
- Klaim API yang belum terbukti harus diuji dengan respons nyata dan dicatat di `docs/due-diligence-log.md`.
- Jangan mengarang batas laju, kuota, CPU, atau format respons. Tandai yang belum teruji dengan `[PERLU DIVERIFIKASI]`.

## Manual dan ambiguitas
- Tugas bertanda `[MANUAL]` dikerjakan pengembang: berhenti dan minta pengembang melakukannya; jangan dilewati atau disimulasikan.
- Tugas `[GATE]` hanya boleh ditutup setelah bukti uji dicatat.
- Jika ada ambiguitas yang memblokir, berhenti dan ajukan **satu** pertanyaan spesifik. Selain itu, ambil asumsi wajar dan catat.
