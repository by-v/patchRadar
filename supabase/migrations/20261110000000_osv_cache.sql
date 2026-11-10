-- T-W1-12a — cache OSV per (paket, versi) dan cache detail advisory.
--
-- Keputusan 10 November 2026: migrasi ini HANYA ditulis sebagai file dan tidak
-- diterapkan ke proyek remote. Akses database di balik `OsvCacheStore`; unit
-- test memakai implementasi memori. Bukti penyimpanan di remote dicatat sebagai
-- TODO eksplisit di `T-W1-12d`.
--
-- PRD §8.1: `osv_cache` (cache_key PK, payload jsonb, fetched_at), termasuk
-- hasil negatif. Tabel internal tidak dapat diakses klien; hanya service role.

create table if not exists public.osv_cache (
  cache_key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

comment on table public.osv_cache is
  'Cache OSV per npm:pkg@versi dan detail advisory (osv:advisory:<id>); TTL 24 jam sementara.';

comment on column public.osv_cache.cache_key is
  'Kunci baku: npm:{nama}@{versi} atau osv:advisory:{id}.';

alter table public.osv_cache enable row level security;

-- Tidak ada policy untuk anon/authenticated: tabel internal hanya untuk
-- service role yang dipakai Edge Function (service role melewati RLS).
revoke all on table public.osv_cache from anon, authenticated;
grant all on table public.osv_cache to service_role;

create index if not exists osv_cache_fetched_at_idx on public.osv_cache (fetched_at);
