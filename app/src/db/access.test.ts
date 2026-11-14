import { DatabaseSync } from 'node:sqlite';

import { clearRememberedScans, rememberScanResult } from '@/lib/scan-session';
import type { ScanFinding, ScanResult } from '@/types/scan';

import {
  loadFindingForDisplay,
  loadScanForDisplay,
  loadScansForHistory,
  saveScanResultSafely,
} from './access';
import { migrateLocalDatabase } from './migrations';
import { saveScanResult } from './repository';
import type { SqliteDatabase, SqliteParam } from './schema';

interface TestDatabase extends SqliteDatabase {
  raw: DatabaseSync;
  close(): void;
}

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
    status: 'COMPLETED',
    manifest: { source: 'LOCKFILE', lockfileFormat: 'v3', estimated: false },
    summary: { totalPackages: 107, affectedPackages: 1, findingCount: 1 },
    findings: [finding()],
    partial: false,
    persisted: false,
    warnings: [],
    sourceStatus: { github: 'OK', osv: 'OK', kev: 'OK', epss: 'OK' },
    timings: { githubMs: 100, osvMs: 40, enrichmentMs: 150, totalMs: 250 },
    requestId: 'request-1',
    ...overrides,
  };
}

describe('akses data lokal', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    clearRememberedScans();
    db = createTestDatabase();
    await migrateLocalDatabase(db);
  });

  afterEach(() => {
    db.close();
  });

  it('menampilkan scan tersimpan sebagai sumber cache', async () => {
    const stored = scanResult();
    await saveScanResult(db, stored);

    const history = await loadScansForHistory(db);
    expect(history.map((scan) => scan.scanId)).toEqual([stored.scanId]);

    await expect(loadScanForDisplay(db, stored.scanId)).resolves.toEqual({
      result: stored,
      source: 'CACHE',
    });
  });

  it('menggabungkan hasil sesi yang gagal disimpan ke Riwayat', async () => {
    const stored = scanResult({
      scanId: 'scan-tersimpan',
      scannedAt: '2026-11-13T10:00:00.000Z',
      findings: [finding({ findingId: 'finding-tersimpan' })],
    });
    const unsaved = scanResult({
      scanId: 'scan-sesi',
      scannedAt: '2026-11-14T10:00:00.000Z',
      findings: [finding({ findingId: 'finding-sesi' })],
    });
    await saveScanResult(db, stored);
    rememberScanResult(unsaved);

    const history = await loadScansForHistory(db);
    expect(history.map((scan) => scan.scanId)).toEqual(['scan-sesi', 'scan-tersimpan']);
  });

  it('memakai hasil sesi bila database tidak tersedia atau gagal dibaca', async () => {
    const remembered = scanResult();
    rememberScanResult(remembered);

    await expect(loadScanForDisplay(null, remembered.scanId)).resolves.toEqual({
      result: remembered,
      source: 'MEMORY',
    });

    const broken = {
      ...db,
      async getFirstAsync<T>(
        source: string,
        params: readonly SqliteParam[] = [],
      ): Promise<T | null> {
        void source;
        void params;
        throw new Error('database rusak');
      },
    } as SqliteDatabase;

    await expect(loadScanForDisplay(broken, remembered.scanId)).resolves.toEqual({
      result: remembered,
      source: 'MEMORY',
    });
  });

  it('mengembalikan null bila hasil tidak ada di mana pun', async () => {
    await expect(loadScanForDisplay(db, 'tidak-ada')).resolves.toBeNull();
    await expect(loadFindingForDisplay(db, 'tidak-ada', 'tidak-ada')).resolves.toBeNull();
  });

  it('membuka Detail dari temuan tersimpan beserta konteks scan', async () => {
    const stored = scanResult();
    await saveScanResult(db, stored);

    await expect(
      loadFindingForDisplay(db, stored.scanId, 'finding-1'),
    ).resolves.toEqual({
      scan: stored,
      finding: stored.findings[0],
      source: 'CACHE',
    });

    // Temuan milik scan lain tidak boleh bocor.
    await expect(
      loadFindingForDisplay(db, stored.scanId, 'finding-lain'),
    ).resolves.toBeNull();
  });

  it('melaporkan kegagalan simpan tanpa melempar exception', async () => {
    const result = scanResult();
    await expect(saveScanResultSafely(null, result)).resolves.toBe(false);

    const broken = {
      ...db,
      async execAsync() {
        throw new Error('penyimpanan penuh');
      },
    } as SqliteDatabase;
    await expect(saveScanResultSafely(broken, result)).resolves.toBe(false);

    await expect(saveScanResultSafely(db, result)).resolves.toBe(true);
    await expect(loadScanForDisplay(db, result.scanId)).resolves.toEqual({
      result,
      source: 'CACHE',
    });
  });
});
