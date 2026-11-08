# Log Due Diligence API/Data PatchRadar

Catat setiap verifikasi klaim eksternal di sini **sebelum** klaim tersebut dianggap fakta.
Satu baris per pemeriksaan. Simpan respons mentah sebagai fixture bila memungkinkan, dan
sebutkan jalur fixture pada kolom "hasil".

Aturan:
- Jangan menulis batas laju, kuota, atau format respons dari ingatan; tulis hanya hasil pengamatan.
- Jika hasil berbeda dari PRD, catat keputusan dan perbarui rencana cadangan.
- Tanda `[PERLU DIVERIFIKASI]` di PRD hanya boleh dihapus setelah ada baris log yang mendukung.

| Tanggal | Sumber | Yang dicek | Hasil | Keputusan |
|---|---|---|---|---|
| 9 November 2026 | Repo lokal (`git grep`, termasuk `--untracked`) | Pola `service_role`, `ghp_`, `github_pat_`, `BEGIN PRIVATE KEY` | Tidak ada nilai secret; hanya rujukan teks di `TASKS.md` dan komentar `supabase/config.toml` | Baseline bersih; pemindaian diulang sebelum build rilis (`T-W4-01`) |
