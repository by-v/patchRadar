-- T-W1-13 — cache skor EPSS per CVE.
--
-- PRD §8.1: `epss_cache` (cve_id PK, epss, percentile, fetched_at). Cache juga
-- menyimpan hasil kosong (epss/percentile NULL) agar CVE tanpa skor tidak
-- ditanyakan ulang selama TTL. Tabel internal hanya untuk service role.
--
-- TTL 24 jam mengikuti header `Cache-Control: max-age=86400` dari FIRST
-- (lihat `docs/due-diligence-log.md`, probe 9 November 2026).
--
-- Semua pernyataan idempoten agar migrasi dapat dijalankan ulang tanpa error.

create table if not exists public.epss_cache (
  cve_id text primary key,
  epss numeric,
  percentile numeric,
  fetched_at timestamptz not null default now()
);

comment on table public.epss_cache is
  'Cache skor EPSS per CVE (termasuk hasil kosong); TTL baca 24 jam.';

comment on column public.epss_cache.cve_id is
  'ID CVE yang sudah dinormalisasi (huruf besar).';

comment on column public.epss_cache.epss is
  'Skor EPSS 0-1; NULL berarti CVE tidak memiliki skor pada respons FIRST.';

comment on column public.epss_cache.percentile is
  'Persentil EPSS 0-1; NULL bila skor tidak tersedia.';

alter table public.epss_cache enable row level security;

-- Tidak ada policy untuk anon/authenticated: tabel internal hanya untuk
-- service role yang dipakai Edge Function (service role melewati RLS).
revoke all on table public.epss_cache from anon, authenticated;
grant all on table public.epss_cache to service_role;

create index if not exists epss_cache_fetched_at_idx on public.epss_cache (fetched_at);
