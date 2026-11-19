-- T-W3-09 & T-W3-10 — indeks hash IP dan retensi cloud 90 hari.
--
-- FR-25b: `rate_limit_events.ip_hash` sudah ada (migrasi T-W3-04) dan boleh
-- NULL. Migrasi ini hanya menambah indeks untuk pencarian jendela per IP.
--
-- NFR-14: pembersihan lazy tanpa cron. Edge Function `scan` memanggil RPC
-- `purge_old_scans` maksimal sekali per jam per instance (lihat retention.ts)
-- dan mencatat ukuran database lewat `scan_storage_stats`.
--
-- Semua pernyataan idempoten agar migrasi aman dijalankan ulang.

-- ── indeks FR-25b ──────────────────────────────────────────────────────────
create index if not exists rate_limit_events_ip_hash_created_at_idx
  on public.rate_limit_events (ip_hash, created_at desc)
  where ip_hash is not null;

comment on column public.rate_limit_events.ip_hash is
  'Hash SHA-256 (garam rahasia) alamat IP untuk FR-25b; NULL bila fitur nonaktif. IP mentah tidak pernah disimpan.';

-- ── NFR-14: hapus scan (dan findings via cascade) lebih tua dari cutoff ─────
create or replace function public.purge_old_scans(
  cutoff timestamptz,
  max_rows integer default 1000
)
returns table (deleted_scans bigint, deleted_findings bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  cap integer := greatest(1, least(coalesce(max_rows, 1000), 10000));
begin
  return query
  with target as (
    select id
    from public.scans
    where created_at < cutoff
    order by created_at asc
    limit cap
    for update skip locked
  ),
  findings_count as (
    select count(*)::bigint as total
    from public.findings f
    join target t on t.id = f.scan_id
  ),
  removed as (
    delete from public.scans s
    using target t
    where s.id = t.id
    returning s.id
  )
  select (select count(*)::bigint from removed),
         (select total from findings_count);
end;
$$;

comment on function public.purge_old_scans(timestamptz, integer) is
  'Retensi NFR-14: hapus scan lebih tua dari cutoff (maks max_rows per panggilan).';

-- ── NFR-14/NFR-15: ukuran database untuk log kuota ─────────────────────────
create or replace function public.scan_storage_stats()
returns table (db_size_bytes bigint)
language sql
security definer
set search_path = public
as $$
  select pg_database_size(current_database())::bigint;
$$;

comment on function public.scan_storage_stats() is
  'Ukuran database saat ini untuk log retensi NFR-14/NFR-15.';

-- Hanya service role Edge Function yang boleh memanggil RPC retensi.
revoke all on function public.purge_old_scans(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.scan_storage_stats() from public, anon, authenticated;
grant execute on function public.purge_old_scans(timestamptz, integer) to service_role;
grant execute on function public.scan_storage_stats() to service_role;
