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
