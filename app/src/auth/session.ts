/**
 * Sesi anonim Supabase (FR-22, FR-25a).
 *
 * Klien memakai REST Auth langsung tanpa menambah `@supabase/supabase-js`.
 * Sesi disimpan di penyimpanan aman, dipakai ulang untuk setiap scan, dan
 * di-refresh sekali ketika mendekati kedaluwarsa. Token tidak pernah dicetak
 * ke log atau disertakan dalam pesan error.
 */

import { readSupabaseConfig, type SupabaseConfig } from '@/config/env';
import { secureStorage, type SecureStorage } from '@/storage/secure';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  /** Epoch milidetik. */
  expiresAt: number;
  userId: string;
};

export type AuthErrorCode = 'SESSION_UNAVAILABLE' | 'SESSION_REFRESH_FAILED';

export type AuthError = {
  code: AuthErrorCode;
  message: string;
};

export type AuthResult = { ok: true; session: AuthSession } | { ok: false; error: AuthError };

/** Teks PRD §12 baris 18 dan 19. */
export const AUTH_MESSAGES = {
  SESSION_UNAVAILABLE: 'Sesi belum siap. Periksa koneksi lalu coba lagi.',
  SESSION_REFRESH_FAILED: 'Sesi diperbarui. Silakan coba lagi.',
} as const;

export const AUTH_STORAGE_KEY = 'patchradar.auth.session.v1';

/** Refresh sedikit lebih awal agar token tidak kedaluwarsa di tengah scan. */
const EXPIRY_SKEW_MS = 60_000;
const DEFAULT_EXPIRES_IN_MS = 3_600_000;

export type AuthDeps = {
  config?: SupabaseConfig;
  fetchImpl?: typeof fetch;
  storage?: SecureStorage;
  now?: () => number;
};

export type AuthClient = {
  ensureSession(): Promise<AuthResult>;
  refreshSession(): Promise<AuthResult>;
  readSession(): Promise<AuthSession | null>;
  clearSession(): Promise<void>;
};

type AuthHttpResponse = {
  ok: boolean;
  status: number;
  payload: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function toSession(payload: unknown, nowMs: number): AuthSession | null {
  if (!isRecord(payload)) return null;
  const accessToken = asString(payload.access_token);
  const refreshToken = asString(payload.refresh_token);
  if (!accessToken || !refreshToken) return null;

  const expiresAt =
    typeof payload.expires_at === 'number' && Number.isFinite(payload.expires_at)
      ? payload.expires_at * 1000
      : nowMs +
        (typeof payload.expires_in === 'number' && Number.isFinite(payload.expires_in)
          ? payload.expires_in * 1000
          : DEFAULT_EXPIRES_IN_MS);

  const user = isRecord(payload.user) ? payload.user : null;
  const userId = user ? (asString(user.id) ?? '') : '';

  return { accessToken, refreshToken, expiresAt, userId };
}

function parseStoredSession(raw: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)) return null;
    const accessToken = asString(value.accessToken);
    const refreshToken = asString(value.refreshToken);
    const expiresAt = value.expiresAt;
    if (!accessToken || !refreshToken) return null;
    if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return null;
    const userId = asString(value.userId) ?? '';
    return { accessToken, refreshToken, expiresAt, userId };
  } catch {
    return null;
  }
}

function failure(code: AuthErrorCode): AuthResult {
  return { ok: false, error: { code, message: AUTH_MESSAGES[code] } };
}

/**
 * Buat klien auth dengan dependensi yang bisa disuntikkan pada unit test.
 * Klien default di bawah dipakai layar aplikasi.
 */
export function createAuthClient(overrides: AuthDeps = {}): AuthClient {
  const storage = overrides.storage ?? secureStorage;
  const now = () => overrides.now?.() ?? Date.now();
  let inFlight: Promise<AuthResult> | null = null;

  function resolveConfig(): SupabaseConfig | null {
    try {
      return overrides.config ?? readSupabaseConfig();
    } catch {
      return null;
    }
  }

  function getFetch(): typeof fetch {
    return overrides.fetchImpl ?? fetch;
  }

  async function readSession(): Promise<AuthSession | null> {
    try {
      return parseStoredSession(await storage.getItem(AUTH_STORAGE_KEY));
    } catch {
      // Gagal membaca penyimpanan diperlakukan seperti belum punya sesi.
      return null;
    }
  }

  async function writeSession(session: AuthSession): Promise<void> {
    try {
      await storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Penyimpanan gagal tidak boleh menggagalkan scan yang sedang berjalan.
    }
  }

  async function clearSession(): Promise<void> {
    try {
      await storage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Abaikan; sesi baru akan ditulis pada percobaan berikutnya.
    }
  }

  async function post(config: SupabaseConfig, url: string, body: unknown): Promise<AuthHttpResponse | null> {
    try {
      const response = await getFetch()(url, {
        method: 'POST',
        headers: {
          apikey: config.anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const text = await response.text();
      let payload: unknown = null;
      if (text.trim().length > 0) {
        try {
          payload = JSON.parse(text) as unknown;
        } catch {
          payload = null;
        }
      }
      return { ok: response.ok, status: response.status, payload };
    } catch {
      return null;
    }
  }

  async function signInAnonymously(config: SupabaseConfig): Promise<AuthResult> {
    const response = await post(config, `${config.url}/auth/v1/signup`, {
      data: {},
      gotrue_meta_security: {},
    });
    const session = response?.ok ? toSession(response.payload, now()) : null;
    if (!session) return failure('SESSION_UNAVAILABLE');

    await writeSession(session);
    return { ok: true, session };
  }

  async function refresh(config: SupabaseConfig, stored: AuthSession): Promise<AuthResult> {
    const response = await post(
      config,
      `${config.url}/auth/v1/token?grant_type=refresh_token`,
      { refresh_token: stored.refreshToken },
    );
    const session = response?.ok ? toSession(response.payload, now()) : null;
    if (session) {
      await writeSession(session);
      return { ok: true, session };
    }

    // Refresh token yang ditolak tidak akan pernah berhasil lagi; hapus agar
    // percobaan berikutnya membuat sesi anonim baru. Gangguan jaringan tidak
    // menghapus sesi supaya pengguna bisa mencoba lagi tanpa akun baru.
    if (response && (response.status === 400 || response.status === 401)) {
      await clearSession();
    }
    return failure('SESSION_REFRESH_FAILED');
  }

  function runOnce(work: () => Promise<AuthResult>): Promise<AuthResult> {
    if (!inFlight) {
      inFlight = work().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  }

  async function loadOrCreate(): Promise<AuthResult> {
    const config = resolveConfig();
    if (!config) return failure('SESSION_UNAVAILABLE');

    const stored = await readSession();
    if (stored && stored.expiresAt - now() > EXPIRY_SKEW_MS) {
      return { ok: true, session: stored };
    }
    if (stored) return refresh(config, stored);
    return signInAnonymously(config);
  }

  return {
    ensureSession() {
      return runOnce(loadOrCreate);
    },

    refreshSession() {
      return runOnce(async () => {
        const config = resolveConfig();
        if (!config) return failure('SESSION_REFRESH_FAILED');
        const stored = await readSession();
        if (!stored) return failure('SESSION_REFRESH_FAILED');
        return refresh(config, stored);
      });
    },

    readSession,
    clearSession,
  };
}

export const authClient = createAuthClient();

/** Pastikan ada sesi anonim yang siap dipakai; buat atau refresh bila perlu. */
export function ensureSession(): Promise<AuthResult> {
  return authClient.ensureSession();
}

/** Paksa refresh sekali, dipakai setelah server menolak token (401). */
export function refreshSession(): Promise<AuthResult> {
  return authClient.refreshSession();
}
