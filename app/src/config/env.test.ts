import {
  normalizeSupabaseUrl,
  readSupabaseConfig,
  SupabaseConfigError,
} from '@/config/env';

const VALID_ENV = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-publik',
};

describe('normalizeSupabaseUrl', () => {
  it('membuang garis miring di ujung', () => {
    expect(normalizeSupabaseUrl('https://demo.supabase.co/')).toBe('https://demo.supabase.co');
  });

  it('membuang akhiran /rest/v1 yang tersalin dari dashboard', () => {
    expect(normalizeSupabaseUrl('https://demo.supabase.co/rest/v1/')).toBe(
      'https://demo.supabase.co',
    );
  });

  it('memangkas spasi', () => {
    expect(normalizeSupabaseUrl('  https://demo.supabase.co  ')).toBe('https://demo.supabase.co');
  });
});

describe('readSupabaseConfig', () => {
  it('mengembalikan URL, anon key, dan basis fungsi', () => {
    expect(readSupabaseConfig(VALID_ENV)).toEqual({
      url: 'https://demo.supabase.co',
      anonKey: 'anon-key-publik',
      functionsUrl: 'https://demo.supabase.co/functions/v1',
    });
  });

  it('menormalkan URL yang disalin lengkap dari dashboard', () => {
    const config = readSupabaseConfig({
      ...VALID_ENV,
      EXPO_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co/rest/v1/',
    });
    expect(config.functionsUrl).toBe('https://demo.supabase.co/functions/v1');
  });

  it('gagal dengan pesan jelas saat URL kosong', () => {
    expect(() => readSupabaseConfig({ ...VALID_ENV, EXPO_PUBLIC_SUPABASE_URL: '  ' })).toThrow(
      SupabaseConfigError,
    );
    expect(() => readSupabaseConfig({ ...VALID_ENV, EXPO_PUBLIC_SUPABASE_URL: '' })).toThrow(
      'EXPO_PUBLIC_SUPABASE_URL belum diisi',
    );
  });

  it('gagal saat URL bukan http(s)', () => {
    expect(() =>
      readSupabaseConfig({ ...VALID_ENV, EXPO_PUBLIC_SUPABASE_URL: 'demo.supabase.co' }),
    ).toThrow('harus berupa URL http(s)');
  });

  it('gagal dengan pesan jelas saat anon key kosong', () => {
    expect(() =>
      readSupabaseConfig({ ...VALID_ENV, EXPO_PUBLIC_SUPABASE_ANON_KEY: '   ' }),
    ).toThrow('EXPO_PUBLIC_SUPABASE_ANON_KEY belum diisi');
  });

  it('tidak mencetak nilai anon key pada pesan galat', () => {
    try {
      readSupabaseConfig({ ...VALID_ENV, EXPO_PUBLIC_SUPABASE_ANON_KEY: '' });
    } catch (error) {
      expect(String(error)).not.toContain(VALID_ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY);
    }
  });
});
