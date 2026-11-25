import { DatabaseSync } from 'node:sqlite';

import type { ScanFinding, ScanResult } from '@/types/scan';

import type { SavedRepo } from '@/lib/saved-repo';

import {
  deleteSavedRepo,
  deleteScanResult,
  getScanFinding,
  getScanResult,
  listSavedRepos,
  listScanFindings,
  listScanResults,
  saveSavedRepo,
  saveScanResult,
  updateSavedRepo,
} from './repository';
import { getSchemaVersion, getStoredSchemaVersion, migrateLocalDatabase } from './migrations';
import type { SqliteDatabase, SqliteParam } from './schema';

interface TestDatabase extends SqliteDatabase {
  raw: DatabaseSync;
  close(): void;
}

/** Adapter tipis di atas SQLite in-memory bawaan Node, bukan modul native Expo. */
function createTestDatabase(): TestDatabase {
  const raw = new DatabaseSync(':memory:');

  return {
    raw,
    close() {
      raw.close();
    },
    async execAsync(source) {
      raw.exec(source);
    },
    async runAsync(source, params: readonly SqliteParam[] = []) {
      return raw.prepare(source).run(...params);
    },
    async getFirstAsync<T>(source: string, params: readonly SqliteParam[] = []) {
      const row = raw.prepare(source).get(...params);
      return (row ?? null) as T | null;
    },
    async getAllAsync<T>(source: string, params: readonly SqliteParam[] = []) {
      return raw.prepare(source).all(...params) as T[];
    },
  };
}

function finding(overrides: Partial<ScanFinding> = {}): ScanFinding {
  return {
    findingId: 'finding-1',
    osvId: 'GHSA-aaaa-bbbb-cccc',
    cveIds: ['CVE-2099-0001'],
    package: {
      name: 'express',
      installedVersion: '4.21.2',
      direct: true,
      devOnly: false,
      parentPackage: null,
    },
    severity: { level: 'HIGH', cvss: 8.1, source: 'OSV' },
    exploitation: { kev: true, epss: 0.5, epssPercentile: 0.9, epssAvailable: true },
    priority: { label: 'FIX_NOW', score: 92.5, reason: 'Ada bukti eksploitasi nyata.' },
    fix: {
      safeVersion: '4.21.3',
      command: 'npm install express@4.21.3',
      suggestion: null,
    },
    summary: 'Paket express punya celah yang perlu segera ditambal.',
    references: [{ label: 'Advisory', url: 'https://example.test/ghsa' }],
    ...overrides,
  };
}

function scanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    scanId: 'scan-1',
    repo: {
      owner: 'expressjs',
      name: 'express',
      url: 'https://github.com/expressjs/express',
      defaultBranch: 'master',
    },
    scannedAt: '2026-11-14T10:00:00.000Z',
    status: 'PARTIAL',
    manifest: { source: 'LOCKFILE', lockfileFormat: 'v3', estimated: false },
    summary: { totalPackages: 107, affectedPackages: 1, findingCount: 1 },
    findings: [finding()],
    partial: true,
    persisted: false,
    warnings: [{ code: 'EPSS_UNAVAILABLE', message: 'Data EPSS tidak tersedia.' }],
    sourceStatus: { github: 'OK', osv: 'OK', kev: 'CACHE', epss: 'FAILED' },
    timings: { githubMs: 100, osvMs: 40, enrichmentMs: 150, totalMs: 250 },
    requestId: 'request-1',
    ...overrides,
  };
}

describe('migrasi SQLite lokal', () => {
  let db: TestDatabase;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('membuat semua tabel, memuat persisted, dan tidak memuat sync_state', async () => {
    await migrateLocalDatabase(db);

    const tables = await db.getAllAsync<{ name: string }>(
      "select name from sqlite_master where type = 'table'",
    );
    expect(tables.map((table) => table.name).sort()).toEqual(
      expect.arrayContaining(['local_findings', 'local_meta', 'local_scans', 'saved_repos']),
    );

    const columns = await db.getAllAsync<{ name: string }>('pragma table_info(local_scans)');
    const names = columns.map((column) => column.name);
    expect(names).toContain('persisted');
    expect(names).not.toContain('sync_state');
  });

  it('dapat dijalankan dua kali tanpa error dan mencatat versi skema', async () => {
    await migrateLocalDatabase(db);
    await expect(migrateLocalDatabase(db)).resolves.toBeUndefined();

    await expect(getSchemaVersion(db)).resolves.toBe(2);
    await expect(getStoredSchemaVersion(db)).resolves.toBe('2');
  });
});

describe('repository SQLite lokal', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await migrateLocalDatabase(db);
  });

  afterEach(() => {
    db.close();
  });

  it('menyimpan lalu membaca kembali payload yang sama', async () => {
    const result = scanResult();
    await saveScanResult(db, result);

    await expect(listScanResults(db)).resolves.toEqual([result]);
    await expect(getScanResult(db, result.scanId)).resolves.toEqual(result);
    await expect(listScanFindings(db, result.scanId)).resolves.toEqual(result.findings);
    await expect(
      getScanFinding(db, result.scanId, result.findings[0]!.findingId),
    ).resolves.toEqual(result.findings[0]);
  });

  it('mengurutkan daftar dari waktu pemindaian terbaru', async () => {
    const older = scanResult({
      scanId: 'scan-lama',
      scannedAt: '2026-11-13T10:00:00.000Z',
      findings: [finding({ findingId: 'finding-lama' })],
    });
    const newer = scanResult({
      scanId: 'scan-baru',
      scannedAt: '2026-11-14T10:00:00.000Z',
      findings: [finding({ findingId: 'finding-baru' })],
    });

    await saveScanResult(db, newer);
    await saveScanResult(db, older);

    const list = await listScanResults(db);
    expect(list.map((item) => item.scanId)).toEqual(['scan-baru', 'scan-lama']);
  });

  it('menyimpan ulang scan yang sama tanpa menduplikasi temuan', async () => {
    const first = scanResult();
    await saveScanResult(db, first);

    const secondFinding = finding({ findingId: 'finding-2', osvId: 'GHSA-dddd-eeee-ffff' });
    const second = scanResult({
      findings: [secondFinding],
      summary: { totalPackages: 107, affectedPackages: 1, findingCount: 1 },
      persisted: true,
    });
    await saveScanResult(db, second);

    const list = await listScanResults(db);
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(second);

    const findings = await listScanFindings(db, second.scanId);
    expect(findings).toEqual([secondFinding]);
    await expect(getScanFinding(db, second.scanId, 'finding-1')).resolves.toBeNull();
  });

  it('menghapus scan beserta temuan dan tidak menyentuh scan lain', async () => {
    const kept = scanResult({ scanId: 'scan-tetap' });
    const removed = scanResult({
      scanId: 'scan-hapus',
      scannedAt: '2026-11-14T11:00:00.000Z',
      findings: [finding({ findingId: 'finding-hapus' })],
    });
    await saveScanResult(db, kept);
    await saveScanResult(db, removed);

    await deleteScanResult(db, removed.scanId);

    await expect(getScanResult(db, removed.scanId)).resolves.toBeNull();
    await expect(listScanFindings(db, removed.scanId)).resolves.toEqual([]);
    await expect(getScanResult(db, kept.scanId)).resolves.toEqual(kept);
  });

  it('mengembalikan null untuk scan atau temuan yang tidak ada', async () => {
    await expect(getScanResult(db, 'tidak-ada')).resolves.toBeNull();
    await expect(getScanFinding(db, 'tidak-ada', 'tidak-ada')).resolves.toBeNull();
  });
});

function savedRepo(overrides: Partial<SavedRepo> = {}): SavedRepo {
  return {
    id: 'saved-1',
    repoFullName: 'expressjs/express',
    repoUrl: 'https://github.com/expressjs/express',
    note: 'Repo latihan',
    createdAt: '2026-11-14T10:00:00.000Z',
    updatedAt: '2026-11-14T10:00:00.000Z',
    ...overrides,
  };
}

describe('repository repo tersimpan', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await migrateLocalDatabase(db);
  });

  afterEach(() => {
    db.close();
  });

  it('menyimpan lalu membaca kembali repo tersimpan', async () => {
    const repo = savedRepo();
    await saveSavedRepo(db, repo);

    await expect(listSavedRepos(db)).resolves.toEqual([repo]);
  });

  it('mengurutkan dari waktu pembaruan terbaru', async () => {
    await saveSavedRepo(
      db,
      savedRepo({
        id: 'saved-lama',
        repoUrl: 'https://github.com/lama/repo',
        repoFullName: 'lama/repo',
        updatedAt: '2026-11-14T10:00:00.000Z',
      }),
    );
    await saveSavedRepo(
      db,
      savedRepo({
        id: 'saved-baru',
        repoUrl: 'https://github.com/baru/repo',
        repoFullName: 'baru/repo',
        updatedAt: '2026-11-15T10:00:00.000Z',
      }),
    );

    const repos = await listSavedRepos(db);
    expect(repos.map((repo) => repo.id)).toEqual(['saved-baru', 'saved-lama']);
  });

  it('memperbarui catatan dan tautan tanpa membuat baris baru', async () => {
    const repo = savedRepo();
    await saveSavedRepo(db, repo);

    const updated = savedRepo({
      repoFullName: 'expressjs/express-js',
      repoUrl: 'https://github.com/expressjs/express-js',
      note: 'Catatan baru',
      updatedAt: '2026-11-15T10:00:00.000Z',
    });
    await updateSavedRepo(db, updated);

    const repos = await listSavedRepos(db);
    expect(repos).toHaveLength(1);
    expect(repos[0]).toEqual(updated);
  });

  it('menolak tautan duplikat dan menghapus tanpa menyentuh baris lain', async () => {
    const kept = savedRepo({ id: 'saved-1' });
    const removed = savedRepo({
      id: 'saved-2',
      repoUrl: 'https://github.com/lain/repo',
      repoFullName: 'lain/repo',
    });
    await saveSavedRepo(db, kept);
    await saveSavedRepo(db, removed);

    await expect(
      saveSavedRepo(
        db,
        savedRepo({
          id: 'saved-3',
          note: 'Duplikat',
        }),
      ),
    ).rejects.toThrow();

    await deleteSavedRepo(db, removed.id);

    await expect(listSavedRepos(db)).resolves.toEqual([kept]);
  });
});
