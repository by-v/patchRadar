-- T-W3-04 — tabel cloud pengguna dan kebijakan RLS.
--
-- PRD §8.1: `scans`, `findings`, dan `rate_limit_events`. Tabel cache/katalog
-- Minggu 1 (`osv_cache`, `kev_entries`, `epss_cache`) sudah mengaktifkan RLS
-- pada migrasinya masing-masing.
--
-- Batas kepercayaan PRD §7:
--   * klien hanya boleh membaca `scans` miliknya sendiri (`user_id = auth.uid()`);
--   * klien hanya boleh membaca `findings` yang `scan_id`-nya ia miliki;
--   * klien tidak mendapat izin tulis apa pun;
--   * `rate_limit_events` hanya untuk service role Edge Function.
--
-- Semua pernyataan idempoten agar migrasi aman dijalankan ulang.

create extension if not exists pgcrypto;

-- ── scans ────────────────────────────────────────────────────────────────────
create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  repo_owner text not null,
  repo_name text not null,
  repo_url text not null,
  status text not null,
  manifest_source text not null,
  lockfile_format text,
  estimated boolean not null default false,
  total_packages integer not null default 0,
  affected_packages integer not null default 0,
  finding_count integer not null default 0,
  partial boolean not null default false,
  warnings jsonb not null default '[]'::jsonb,
  source_status jsonb not null default '{}'::jsonb,
  engine_version text not null,
  duration_ms integer not null default 0,
  created_at timestamptz not null default now(),
  constraint scans_status_check check (status in ('COMPLETED', 'PARTIAL')),
  constraint scans_manifest_source_check check (manifest_source in ('LOCKFILE', 'PACKAGE_JSON')),
  constraint scans_lockfile_format_check check (lockfile_format is null or lockfile_format in ('v2', 'v3')),
  constraint scans_total_packages_check check (total_packages >= 0),
  constraint scans_affected_packages_check check (affected_packages >= 0),
  constraint scans_finding_count_check check (finding_count >= 0),
  constraint scans_duration_ms_check check (duration_ms >= 0)
);

comment on table public.scans is
  'Satu baris per pemindaian sukses/parsial; hanya dapat dibaca pemiliknya lewat RLS.';
comment on column public.scans.user_id is
  'Pemilik scan dari klaim JWT anonim (auth.uid()).';

create index if not exists scans_user_id_created_at_idx
  on public.scans (user_id, created_at desc);

-- ── findings ─────────────────────────────────────────────────────────────────
create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans (id) on delete cascade,
  osv_id text not null,
  cve_ids text[] not null default '{}'::text[],
  package_name text not null,
  installed_version text not null,
  direct boolean not null default false,
  dev_only boolean not null default false,
  parent_package text,
  severity text not null,
  cvss_score numeric,
  epss numeric,
  epss_percentile numeric,
  kev boolean not null default false,
  label text not null,
  score numeric not null default 0,
  reason text not null,
  fix_version text,
  fix_command text,
  summary text not null default '',
  "references" jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint findings_severity_check check (severity in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN')),
  constraint findings_label_check check (label in ('FIX_NOW', 'SCHEDULE', 'MONITOR')),
  constraint findings_epss_check check (epss is null or (epss >= 0 and epss <= 1)),
  constraint findings_epss_percentile_check check (epss_percentile is null or (epss_percentile >= 0 and epss_percentile <= 1)),
  constraint findings_score_check check (score >= 0 and score <= 100)
);

comment on table public.findings is
  'Satu baris per pasangan paket+advisory; dapat dibaca bila scan induknya milik pengguna.';
comment on column public.findings."references" is
  'Daftar tautan referensi advisory (jsonb array {label,url}).';

create index if not exists findings_scan_id_idx
  on public.findings (scan_id);

-- ── rate_limit_events ────────────────────────────────────────────────────────
create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  ip_hash text,
  kind text not null default 'scan',
  created_at timestamptz not null default now()
);

comment on table public.rate_limit_events is
  'Catatan pemakaian untuk rate limit FR-25a; hanya service role yang mengakses.';
comment on column public.rate_limit_events.ip_hash is
  'NULL selama FR-25b tidak aktif; diisi hanya bila pembatasan per IP diaktifkan.';

create index if not exists rate_limit_events_user_id_created_at_idx
  on public.rate_limit_events (user_id, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.scans enable row level security;
alter table public.findings enable row level security;
alter table public.rate_limit_events enable row level security;

-- Klien (termasuk sesi anonim) hanya boleh membaca scan miliknya sendiri.
drop policy if exists scans_select_own on public.scans;
create policy scans_select_own
  on public.scans
  for select
  to authenticated
  using (user_id = auth.uid());

-- Klien hanya boleh membaca findings yang scan induknya ia miliki.
drop policy if exists findings_select_own_scan on public.findings;
create policy findings_select_own_scan
  on public.findings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.scans s
      where s.id = findings.scan_id
        and s.user_id = auth.uid()
    )
  );

-- Tidak ada policy tulis dan tidak ada policy untuk role anon: seluruh akses
-- tulis hanya lewat service role Edge Function.
revoke all on table public.scans from anon, authenticated;
revoke all on table public.findings from anon, authenticated;
revoke all on table public.rate_limit_events from anon, authenticated;

grant select on table public.scans to authenticated;
grant select on table public.findings to authenticated;

grant all on table public.scans to service_role;
grant all on table public.findings to service_role;
grant all on table public.rate_limit_events to service_role;
