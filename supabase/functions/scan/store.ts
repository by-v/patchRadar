/**
 * Antarmuka penyimpanan untuk cache/katalog pipeline `scan`.
 *
 * Implementasi produksi memakai Supabase (service role), sedangkan unit test
 * memakai implementasi tiruan di memori. Dengan pemisahan ini pipeline dapat
 * diuji tanpa jaringan dan tanpa menerapkan migrasi ke proyek remote.
 */

export interface OsvCacheRecord {
  cacheKey: string;
  payload: unknown;
  fetchedAt: string;
}

export interface OsvCacheStore {
  /** Baca beberapa kunci sekaligus; kunci yang tidak ada tidak dimasukkan. */
  getMany(keys: readonly string[]): Promise<Map<string, OsvCacheRecord>>;
  /** Tulis/ubah beberapa baris cache sekaligus. */
  upsert(records: readonly OsvCacheRecord[]): Promise<void>;
}

export interface EpssCacheRecord {
  cveId: string;
  /** `null` menandai hasil kosong yang tetap di-cache (cache negatif). */
  epss: number | null;
  percentile: number | null;
  fetchedAt: string;
}

export interface EpssCacheStore {
  /** Baca beberapa CVE sekaligus; CVE yang tidak ada tidak dimasukkan. */
  getMany(cveIds: readonly string[]): Promise<Map<string, EpssCacheRecord>>;
  /** Tulis/ubah beberapa baris cache sekaligus. */
  upsert(records: readonly EpssCacheRecord[]): Promise<void>;
}

export interface MemoryEpssCacheStore extends EpssCacheStore {
  readonly records: Map<string, EpssCacheRecord>;
  readonly writes: EpssCacheRecord[];
  readCalls: number;
}

export function createMemoryEpssCacheStore(
  seed: readonly EpssCacheRecord[] = [],
): MemoryEpssCacheStore {
  const records = new Map<string, EpssCacheRecord>();
  for (const record of seed) records.set(record.cveId, record);

  return {
    records,
    writes: [],
    readCalls: 0,
    async getMany(cveIds) {
      this.readCalls += 1;
      const found = new Map<string, EpssCacheRecord>();
      for (const cveId of cveIds) {
        const record = records.get(cveId);
        if (record) found.set(cveId, record);
      }
      return found;
    },
    async upsert(next) {
      for (const record of next) {
        records.set(record.cveId, record);
        this.writes.push(record);
      }
    },
  };
}

export interface KevEntryRecord {
  cveId: string;
  vendor: string;
  product: string;
  name: string;
  dateAdded: string;
  knownRansomware: boolean;
  raw: unknown;
  updatedAt: string;
}

export interface KevStore {
  count(): Promise<number>;
  latestUpdatedAt(): Promise<string | null>;
  loadAll(): Promise<KevEntryRecord[]>;
  /** Ganti seluruh isi katalog dengan salinan baru. */
  replaceAll(entries: readonly KevEntryRecord[], updatedAt: string): Promise<void>;
}

export interface MemoryOsvCacheStore extends OsvCacheStore {
  readonly records: Map<string, OsvCacheRecord>;
  readonly writes: OsvCacheRecord[];
  readCalls: number;
}

export function createMemoryOsvCacheStore(
  seed: readonly OsvCacheRecord[] = [],
): MemoryOsvCacheStore {
  const records = new Map<string, OsvCacheRecord>();
  for (const record of seed) records.set(record.cacheKey, record);

  return {
    records,
    writes: [],
    readCalls: 0,
    async getMany(keys) {
      this.readCalls += 1;
      const found = new Map<string, OsvCacheRecord>();
      for (const key of keys) {
        const record = records.get(key);
        if (record) found.set(key, record);
      }
      return found;
    },
    async upsert(next) {
      for (const record of next) {
        records.set(record.cacheKey, record);
        this.writes.push(record);
      }
    },
  };
}

export interface ScanRecord {
  id: string;
  userId: string;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  status: 'COMPLETED' | 'PARTIAL';
  manifestSource: 'LOCKFILE' | 'PACKAGE_JSON';
  lockfileFormat: 'v2' | 'v3' | null;
  estimated: boolean;
  totalPackages: number;
  affectedPackages: number;
  findingCount: number;
  partial: boolean;
  warnings: unknown;
  sourceStatus: unknown;
  engineVersion: string;
  durationMs: number;
  createdAt: string;
}

export interface FindingRecord {
  id: string;
  scanId: string;
  osvId: string;
  cveIds: string[];
  packageName: string;
  installedVersion: string;
  direct: boolean;
  devOnly: boolean;
  parentPackage: string | null;
  severity: string;
  cvssScore: number | null;
  epss: number | null;
  epssPercentile: number | null;
  kev: boolean;
  label: string;
  score: number;
  reason: string;
  fixVersion: string | null;
  fixCommand: string | null;
  summary: string;
  references: unknown;
}

/** Penyimpanan cloud best-effort `scans` + `findings` (FR-22/FR-23). */
export interface ScanStore {
  /** Simpan satu scan beserta seluruh findings-nya; lempar error bila gagal. */
  save(scan: ScanRecord, findings: readonly FindingRecord[]): Promise<void>;
}

export interface MemoryScanStore extends ScanStore {
  readonly scans: ScanRecord[];
  readonly findings: FindingRecord[];
  saveCalls: number;
  /** Bila diisi, `save` melempar error ini (simulasi cloud gagal). */
  failWith: Error | null;
}

export function createMemoryScanStore(): MemoryScanStore {
  return {
    scans: [],
    findings: [],
    saveCalls: 0,
    failWith: null,
    async save(scan, findings) {
      this.saveCalls += 1;
      if (this.failWith) throw this.failWith;
      this.scans.push(scan);
      this.findings.push(...findings);
    },
  };
}

export interface RateLimitEventRecord {
  userId: string;
  kind: string;
  createdAt: string;
}

/** Catatan pemakaian untuk rate limit FR-25a (hanya service role). */
export interface RateLimitStore {
  /** Kejadian pada/atau setelah `sinceIso`, urut lama → baru. */
  listRecent(userId: string, kind: string, sinceIso: string): Promise<RateLimitEventRecord[]>;
  record(event: RateLimitEventRecord): Promise<void>;
}

export interface MemoryRateLimitStore extends RateLimitStore {
  readonly events: RateLimitEventRecord[];
  listCalls: number;
}

export function createMemoryRateLimitStore(
  seed: readonly RateLimitEventRecord[] = [],
): MemoryRateLimitStore {
  return {
    events: [...seed],
    listCalls: 0,
    async listRecent(userId, kind, sinceIso) {
      this.listCalls += 1;
      return this.events
        .filter((event) => event.userId === userId && event.kind === kind && event.createdAt >= sinceIso)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    },
    async record(event) {
      this.events.push(event);
    },
  };
}

export interface MemoryKevStore extends KevStore {
  readonly entries: Map<string, KevEntryRecord>;
  replaceCalls: number;
}

export function createMemoryKevStore(
  seed: readonly KevEntryRecord[] = [],
): MemoryKevStore {
  const entries = new Map<string, KevEntryRecord>();
  for (const entry of seed) entries.set(entry.cveId, entry);

  return {
    entries,
    replaceCalls: 0,
    async count() {
      return entries.size;
    },
    async latestUpdatedAt() {
      let latest: string | null = null;
      for (const entry of entries.values()) {
        if (latest === null || entry.updatedAt > latest) latest = entry.updatedAt;
      }
      return latest;
    },
    async loadAll() {
      return [...entries.values()];
    },
    async replaceAll(next, updatedAt) {
      this.replaceCalls += 1;
      entries.clear();
      for (const entry of next) {
        entries.set(entry.cveId, { ...entry, updatedAt });
      }
    },
  };
}
