-- T-W1-12b — katalog CISA KEV lokal.
--
-- Keputusan 10 November 2026: migrasi ini HANYA ditulis sebagai file dan tidak
-- diterapkan ke proyek remote. Akses database di balik `KevStore`; unit test
-- memakai implementasi memori. Bukti baris remote dicatat di `T-W1-12d`.
--
-- PRD §8.1: `kev_entries` (cve_id PK, vendor, product, name, date_added,
-- known_ransomware, raw jsonb, updated_at). Tabel internal hanya untuk service
-- role; klien tidak dapat mengaksesnya.

create table if not exists public.kev_entries (
  cve_id text primary key,
  vendor text not null default '',
  product text not null default '',
  name text not null default '',
  date_added date,
  known_ransomware boolean not null default false,
  raw jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.kev_entries is
  'Salinan katalog CISA KEV; satu baris per CVE. Diperbarui lazy bila > 24 jam.';

alter table public.kev_entries enable row level security;

revoke all on table public.kev_entries from anon, authenticated;
grant all on table public.kev_entries to service_role;

create index if not exists kev_entries_updated_at_idx on public.kev_entries (updated_at);
