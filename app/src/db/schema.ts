/**
 * Skema SQLite lokal PatchRadar (PRD §8.2).
 *
 * Tabel ini adalah sumber utama layar Riwayat dan tampilan offline. Tidak ada
 * `sync_state`: MVP tidak melakukan sinkronisasi ulang, `persisted` hanya
 * mencatat apakah penyimpanan cloud berhasil.
 */

export const LOCAL_SCHEMA_VERSION = 1;

export const LOCAL_SCHEMA_SQL = `
create table if not exists local_scans (
  scan_id text primary key not null,
  repo_full_name text not null,
  repo_url text not null,
  scanned_at text not null,
  status text not null,
  manifest_source text not null,
  estimated integer not null default 0,
  partial integer not null default 0,
  persisted integer not null default 0,
  total_packages integer not null default 0,
  affected_packages integer not null default 0,
  finding_count integer not null default 0,
  payload_json text not null
);

create table if not exists local_findings (
  finding_id text primary key not null,
  scan_id text not null references local_scans(scan_id) on delete cascade,
  package_name text not null,
  installed_version text not null,
  severity text not null,
  label text not null,
  osv_id text not null,
  payload_json text not null
);

create index if not exists local_findings_scan_id_idx
  on local_findings (scan_id);

create table if not exists local_meta (
  key text primary key not null,
  value text not null
);
`;

/** Parameter yang aman di-bind ke SQLite (tanpa objek bernama). */
export type SqliteParam = string | number | null;

/**
 * Antarmuka minimal yang dipakai repository.
 *
 * `expo-sqlite` memenuhi bentuk ini; unit test memakai adapter `node:sqlite`
 * in-memory sehingga tidak bergantung pada modul native.
 */
export interface SqliteDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: readonly SqliteParam[]): Promise<unknown>;
  getFirstAsync<T>(source: string, params?: readonly SqliteParam[]): Promise<T | null>;
  getAllAsync<T>(source: string, params?: readonly SqliteParam[]): Promise<T[]>;
}

export interface LocalScanRow {
  scan_id: string;
  repo_full_name: string;
  repo_url: string;
  scanned_at: string;
  status: string;
  manifest_source: string;
  estimated: number;
  partial: number;
  persisted: number;
  total_packages: number;
  affected_packages: number;
  finding_count: number;
  payload_json: string;
}

export interface LocalFindingRow {
  finding_id: string;
  scan_id: string;
  package_name: string;
  installed_version: string;
  severity: string;
  label: string;
  osv_id: string;
  payload_json: string;
}

export interface LocalMetaRow {
  key: string;
  value: string;
}
