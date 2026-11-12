/** Konfigurasi Supabase dari environment publik Expo. */

export type SupabaseEnvSource = {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
};

export type SupabaseConfig = {
  /** Basis proyek tanpa garis miring di ujung, mis. `https://abc.supabase.co`. */
  url: string;
  /** Anon key bersifat publik; RLS melindungi data. */
  anonKey: string;
  /** Basis endpoint Edge Function, mis. `https://abc.supabase.co/functions/v1`. */
  functionsUrl: string;
};

export type SupabaseConfigField =
  | 'EXPO_PUBLIC_SUPABASE_URL'
  | 'EXPO_PUBLIC_SUPABASE_ANON_KEY';

export class SupabaseConfigError extends Error {
  readonly field: SupabaseConfigField;

  constructor(field: SupabaseConfigField, message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
    this.field = field;
  }
}

/**
 * Rapikan URL proyek. Dashboard Supabase menampilkan URL API sebagai
 * `{url}/rest/v1/`; pengguna sering menyalinnya utuh, jadi akhiran itu dibuang.
 */
export function normalizeSupabaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/u, '')
    .replace(/\/rest\/v1$/iu, '')
    .replace(/\/+$/u, '');
}

/** Baca konfigurasi dan gagal dengan pesan jelas bila belum diisi. */
export function readSupabaseConfig(env?: SupabaseEnvSource): SupabaseConfig {
  // Akses `process.env.EXPO_PUBLIC_*` harus berupa anggota statis agar Expo
  // menanam nilainya saat bundling. Jangan diganti dengan `process.env` lalu
  // indeks dinamis: variabel tidak akan ikut ke build produksi.
  const source: SupabaseEnvSource = env ?? {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };

  const url = normalizeSupabaseUrl(source.EXPO_PUBLIC_SUPABASE_URL ?? '');
  if (url.length === 0) {
    throw new SupabaseConfigError(
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_URL belum diisi di app/.env.',
    );
  }
  if (!/^https?:\/\/[^\s]+$/iu.test(url)) {
    throw new SupabaseConfigError(
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_URL harus berupa URL http(s) yang valid.',
    );
  }

  const anonKey = (source.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  if (anonKey.length === 0) {
    throw new SupabaseConfigError(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY belum diisi di app/.env.',
    );
  }

  return {
    url,
    anonKey,
    functionsUrl: `${url}/functions/v1`,
  };
}
