/**
 * Migrasi SQLite lokal yang idempoten.
 *
 * Versi skema disimpan di `PRAGMA user_version` dan dicerminkan di
 * `local_meta` untuk keperluan pemeliharaan/debug. Menjalankan migrasi berkali-
 * kali aman karena semua DDL memakai `IF NOT EXISTS`.
 */

import {
  LOCAL_SCHEMA_SQL,
  LOCAL_SCHEMA_VERSION,
  type LocalMetaRow,
  type SqliteDatabase,
  type SqliteParam,
} from './schema';

type UserVersionRow = { user_version: number };

export async function getSchemaVersion(db: SqliteDatabase): Promise<number> {
  const row = await db.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  const value = row?.user_version;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function setSchemaVersion(db: SqliteDatabase, version: number): Promise<void> {
  // PRAGMA tidak menerima parameter terikat; versi selalu konstanta numerik.
  await db.execAsync(`PRAGMA user_version = ${Math.trunc(version)}`);
}

/**
 * Terapkan skema lokal bila versinya masih lebih lama.
 *
 * Bila database berasal dari versi yang lebih baru, migrasi menolak berjalan
 * agar data tidak rusak oleh skema yang tidak dikenal.
 */
export async function migrateLocalDatabase(db: SqliteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');

  const current = await getSchemaVersion(db);
  if (current > LOCAL_SCHEMA_VERSION) {
    throw new Error(
      `Versi skema lokal ${current} lebih baru dari yang didukung (${LOCAL_SCHEMA_VERSION}).`,
    );
  }

  if (current < LOCAL_SCHEMA_VERSION) {
    await db.execAsync(LOCAL_SCHEMA_SQL);
    await setSchemaVersion(db, LOCAL_SCHEMA_VERSION);
  }

  await db.runAsync(
    `insert into local_meta (key, value) values (?, ?)
     on conflict(key) do update set value = excluded.value`,
    ['schema_version', String(LOCAL_SCHEMA_VERSION)],
  );
}

/** Baca versi yang dicerminkan di `local_meta`; `null` bila belum ada. */
export async function getStoredSchemaVersion(db: SqliteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<LocalMetaRow>(
    'select key, value from local_meta where key = ?',
    ['schema_version'],
  );
  return row?.value ?? null;
}

/** Buka database aplikasi dan langsung terapkan migrasi. */
export async function openLocalDatabase(name = 'patchradar.db'): Promise<SqliteDatabase> {
  const SQLite = await import('expo-sqlite');
  const db = await SQLite.openDatabaseAsync(name);
  await db.execAsync('PRAGMA journal_mode = WAL');
  const adapter = adaptExpoDatabase(db);
  await migrateLocalDatabase(adapter);
  return adapter;
}

/**
 * Bungkus `SQLiteDatabase` Expo agar cocok dengan antarmuka repository.
 * Parameter selalu diberikan sebagai array sehingga tidak ada varian variadik.
 */
function adaptExpoDatabase(db: import('expo-sqlite').SQLiteDatabase): SqliteDatabase {
  return {
    execAsync: (source) => db.execAsync(source),
    runAsync: (source, params = []) => db.runAsync(source, [...params]),
    getFirstAsync: <T>(source: string, params: readonly SqliteParam[] = []) =>
      db.getFirstAsync<T>(source, [...params]),
    getAllAsync: <T>(source: string, params: readonly SqliteParam[] = []) =>
      db.getAllAsync<T>(source, [...params]),
  };
}
