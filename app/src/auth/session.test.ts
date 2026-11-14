import type { SupabaseConfig } from '@/config/env';
import type { SecureStorage } from '@/storage/secure';

import {
  AUTH_MESSAGES,
  AUTH_STORAGE_KEY,
  createAuthClient,
  type AuthSession,
} from './session';

const CONFIG: SupabaseConfig = {
  url: 'https://project.supabase.co',
  anonKey: 'anon-key',
  functionsUrl: 'https://project.supabase.co/functions/v1',
};

const NOW = 1_700_000_000_000;

function tokenPayload(suffix = '1', expiresIn = 3600) {
  return {
    access_token: `access-${suffix}`,
    refresh_token: `refresh-${suffix}`,
    expires_in: expiresIn,
    user: { id: `user-${suffix}` },
  };
}

function sessionPayload(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    accessToken: 'access-lama',
    refreshToken: 'refresh-lama',
    expiresAt: NOW + 3_600_000,
    userId: 'user-lama',
    ...overrides,
  };
}

function createMemoryStorage(initial?: string): SecureStorage & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  if (initial !== undefined) raw.set(AUTH_STORAGE_KEY, initial);

  return {
    raw,
    async getItem(key) {
      return raw.get(key) ?? null;
    },
    async setItem(key, value) {
      raw.set(key, value);
    },
    async removeItem(key) {
      raw.delete(key);
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

type FetchCall = {
  url: string;
  headers: Record<string, string>;
  body: unknown;
};

function createFetch(
  handler: (url: string) => Response | Promise<Response>,
): { impl: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const impl = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null,
    });
    return handler(url);
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('sesi anonim', () => {
  it('membuat sesi anonim saat belum ada lalu menyimpannya', async () => {
    const storage = createMemoryStorage();
    const { impl, calls } = createFetch(() => jsonResponse(200, tokenPayload()));
    const client = createAuthClient({ config: CONFIG, fetchImpl: impl, storage, now: () => NOW });

    const result = await client.ensureSession();

    expect(result).toMatchObject({
      ok: true,
      session: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresAt: NOW + 3_600_000,
        userId: 'user-1',
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://project.supabase.co/auth/v1/signup');
    expect(calls[0]!.headers).toMatchObject({
      apikey: 'anon-key',
      'Content-Type': 'application/json',
    });
    expect(calls[0]!.body).toEqual({ data: {}, gotrue_meta_security: {} });

    const stored = JSON.parse(storage.raw.get(AUTH_STORAGE_KEY) ?? '{}') as AuthSession;
    expect(stored.accessToken).toBe('access-1');
  });

  it('memakai ulang sesi tersimpan tanpa membuat pengguna baru', async () => {
    const storage = createMemoryStorage(JSON.stringify(sessionPayload()));
    const { impl, calls } = createFetch(() => jsonResponse(200, tokenPayload('baru')));
    const client = createAuthClient({ config: CONFIG, fetchImpl: impl, storage, now: () => NOW });

    const first = await client.ensureSession();
    const second = await client.ensureSession();

    expect(first).toMatchObject({ ok: true, session: { accessToken: 'access-lama' } });
    expect(second).toMatchObject({ ok: true, session: { accessToken: 'access-lama' } });
    expect(calls).toHaveLength(0);
  });

  it('mendaur ulang promise yang sama saat dua pemanggilan bersamaan', async () => {
    const storage = createMemoryStorage();
    const { impl, calls } = createFetch(() => jsonResponse(200, tokenPayload()));
    const client = createAuthClient({ config: CONFIG, fetchImpl: impl, storage, now: () => NOW });

    const [first, second] = await Promise.all([client.ensureSession(), client.ensureSession()]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://project.supabase.co/auth/v1/signup');
  });

  it('me-refresh sekali ketika sesi mendekati kedaluwarsa', async () => {
    const storage = createMemoryStorage(
      JSON.stringify(sessionPayload({ expiresAt: NOW - 1_000 })),
    );
    const { impl, calls } = createFetch(() => jsonResponse(200, tokenPayload('2')));
    const client = createAuthClient({ config: CONFIG, fetchImpl: impl, storage, now: () => NOW });

    const result = await client.ensureSession();

    expect(result).toMatchObject({ ok: true, session: { accessToken: 'access-2' } });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      'https://project.supabase.co/auth/v1/token?grant_type=refresh_token',
    );
    expect(calls[0]!.body).toEqual({ refresh_token: 'refresh-lama' });

    const stored = JSON.parse(storage.raw.get(AUTH_STORAGE_KEY) ?? '{}') as AuthSession;
    expect(stored).toMatchObject({ accessToken: 'access-2', refreshToken: 'refresh-2' });
  });

  it('menampilkan pesan baris 19 saat refresh gagal karena jaringan tanpa menghapus sesi', async () => {
    const storage = createMemoryStorage(
      JSON.stringify(sessionPayload({ expiresAt: NOW - 1_000 })),
    );
    const { impl } = createFetch(() => jsonResponse(503, { message: 'sibuk' }));
    const client = createAuthClient({ config: CONFIG, fetchImpl: impl, storage, now: () => NOW });

    const result = await client.ensureSession();

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'SESSION_REFRESH_FAILED',
        message: AUTH_MESSAGES.SESSION_REFRESH_FAILED,
      },
    });
    expect(AUTH_MESSAGES.SESSION_REFRESH_FAILED).toBe('Sesi diperbarui. Silakan coba lagi.');
    expect(storage.raw.has(AUTH_STORAGE_KEY)).toBe(true);
  });

  it('menghapus sesi bila refresh token ditolak', async () => {
    const storage = createMemoryStorage(
      JSON.stringify(sessionPayload({ expiresAt: NOW - 1_000 })),
    );
    const { impl } = createFetch(() => jsonResponse(401, { message: 'refresh tidak valid' }));
    const client = createAuthClient({ config: CONFIG, fetchImpl: impl, storage, now: () => NOW });

    await client.ensureSession();

    expect(storage.raw.has(AUTH_STORAGE_KEY)).toBe(false);
  });

  it('menampilkan pesan baris 18 saat pembuatan sesi gagal', async () => {
    const storage = createMemoryStorage();
    const { impl } = createFetch(() => jsonResponse(500, { message: 'gagal' }));
    const client = createAuthClient({ config: CONFIG, fetchImpl: impl, storage, now: () => NOW });

    const result = await client.ensureSession();

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'SESSION_UNAVAILABLE',
        message: AUTH_MESSAGES.SESSION_UNAVAILABLE,
      },
    });
    expect(AUTH_MESSAGES.SESSION_UNAVAILABLE).toBe(
      'Sesi belum siap. Periksa koneksi lalu coba lagi.',
    );
  });

  it('menganggap data sesi rusak sebagai belum punya sesi', async () => {
    const storage = createMemoryStorage('{bukan json');
    const { impl, calls } = createFetch(() => jsonResponse(200, tokenPayload()));
    const client = createAuthClient({ config: CONFIG, fetchImpl: impl, storage, now: () => NOW });

    await expect(client.ensureSession()).resolves.toMatchObject({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://project.supabase.co/auth/v1/signup');
  });

  it('tidak menyertakan token pada pesan error', async () => {
    const storage = createMemoryStorage(
      JSON.stringify(sessionPayload({ expiresAt: NOW - 1_000 })),
    );
    const { impl } = createFetch(() => jsonResponse(400, {}));
    const client = createAuthClient({ config: CONFIG, fetchImpl: impl, storage, now: () => NOW });

    const result = await client.ensureSession();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(JSON.stringify(result.error)).not.toContain('refresh-lama');
      expect(JSON.stringify(result.error)).not.toContain('access-lama');
    }
  });
});
