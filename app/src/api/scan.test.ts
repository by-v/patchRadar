import { requestScan } from '@/api/scan';
import type { SupabaseConfig } from '@/config/env';

import notFoundFixture from './__fixtures__/scan-error-not-found.json';
import findingsFixture from './__fixtures__/scan-findings.json';
import partialFixture from './__fixtures__/scan-partial.json';
import successFixture from './__fixtures__/scan-success.json';

const CONFIG: SupabaseConfig = {
  url: 'https://demo.supabase.co',
  anonKey: 'anon-key-publik',
  functionsUrl: 'https://demo.supabase.co/functions/v1',
};

function jsonResponse(
  body: unknown,
  options: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
}

function fetchMock(response: Response | (() => Promise<Response>)) {
  return jest.fn(() =>
    typeof response === 'function' ? response() : Promise.resolve(response),
  ) as unknown as typeof fetch;
}

describe('requestScan — respons sukses nyata', () => {
  it('mengirim POST dengan apikey dan tanpa Authorization', async () => {
    const fetchImpl = fetchMock(jsonResponse(successFixture));

    const result = await requestScan({
      repoUrl: 'https://github.com/chalk/chalk',
      config: CONFIG,
      fetchImpl,
      clientVersion: '1.0.0',
    });

    expect(result.ok).toBe(true);
    const [url, init] = (fetchImpl as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://demo.supabase.co/functions/v1/scan');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      apikey: 'anon-key-publik',
      'Content-Type': 'application/json',
      'X-Client-Version': '1.0.0',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      repoUrl: 'https://github.com/chalk/chalk',
      clientVersion: '1.0.0',
    });
  });

  it('mempertahankan field kontrak dan tidak membuang warnings', async () => {
    const result = await requestScan({
      repoUrl: 'https://github.com/chalk/chalk',
      config: CONFIG,
      fetchImpl: fetchMock(jsonResponse(successFixture)),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.scanId).toBe(successFixture.scanId);
    expect(result.data.repo).toEqual(successFixture.repo);
    expect(result.data.summary).toEqual(successFixture.summary);
    expect(result.data.persisted).toBe(false);
    expect(result.data.partial).toBe(false);
    expect(result.data.warnings).toEqual(successFixture.warnings);
    expect(result.data.sourceStatus).toEqual(successFixture.sourceStatus);
    expect(result.data.timings).toEqual(successFixture.timings);
    expect(result.data.requestId).toBe(successFixture.requestId);
  });

  it('mempertahankan seluruh field temuan dari respons nyata', async () => {
    const result = await requestScan({
      repoUrl: 'https://github.com/expressjs/express',
      config: CONFIG,
      fetchImpl: fetchMock(jsonResponse(findingsFixture)),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.summary).toEqual({
      totalPackages: 44,
      affectedPackages: 1,
      findingCount: 1,
    });
    const finding = result.data.findings[0];
    expect(finding?.package).toEqual({
      name: 'hbs',
      installedVersion: '4.4.0',
      direct: true,
      devOnly: true,
      parentPackage: null,
    });
    expect(finding?.severity).toEqual({ level: 'MEDIUM', cvss: 4, source: 'OSV' });
    expect(finding?.priority.label).toBe('MONITOR');
    expect(finding?.fix.safeVersion).toBeNull();
    expect(finding?.references).toHaveLength(4);
  });

  it('menambahkan Authorization hanya bila accessToken tersedia', async () => {
    const fetchImpl = fetchMock(jsonResponse(successFixture));

    await requestScan({
      repoUrl: 'https://github.com/chalk/chalk',
      config: CONFIG,
      fetchImpl,
      accessToken: 'jwt-sesi-anonim',
    });

    const [, init] = (fetchImpl as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-sesi-anonim' });
  });
});

describe('requestScan — respons parsial', () => {
  it('menganggap partial dan persisted=false sebagai hasil sah', async () => {
    const result = await requestScan({
      repoUrl: 'https://github.com/demo-user/patchradar-demo',
      config: CONFIG,
      fetchImpl: fetchMock(jsonResponse(partialFixture)),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.status).toBe('PARTIAL');
    expect(result.data.partial).toBe(true);
    expect(result.data.persisted).toBe(false);
    expect(result.data.warnings.map((warning) => warning.code)).toEqual([
      'EPSS_UNAVAILABLE',
      'CLOUD_PERSIST_FAILED',
    ]);
    expect(result.data.findings).toHaveLength(1);
    expect(result.data.findings[0]?.exploitation).toEqual({
      kev: true,
      epss: null,
      epssPercentile: null,
      epssAvailable: false,
    });
    expect(result.data.findings[0]?.priority.label).toBe('FIX_NOW');
    expect(result.data.findings[0]?.fix.command).toBeNull();
  });
});

describe('requestScan — respons error', () => {
  it('memetakan 404 menjadi pesan pengguna dan membawa requestId', async () => {
    const result = await requestScan({
      repoUrl: 'https://github.com/definitely-not-real/nope',
      config: CONFIG,
      fetchImpl: fetchMock(
        jsonResponse(notFoundFixture, {
          status: 404,
          headers: { 'x-request-id': notFoundFixture.error.requestId },
        }),
      ),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('REPO_NOT_FOUND_OR_PRIVATE');
    expect(result.error.message).toBe(
      'Repo tidak ditemukan atau bersifat privat. PatchRadar hanya bisa memindai repo publik.',
    );
    expect(result.error.retryable).toBe(false);
    expect(result.error.requestId).toBe(notFoundFixture.error.requestId);
    expect(result.error.status).toBe(404);
  });

  it('menampilkan hitung mundur menit pada 429', async () => {
    const result = await requestScan({
      repoUrl: 'https://github.com/a/b',
      config: CONFIG,
      fetchImpl: fetchMock(
        jsonResponse(
          {
            error: {
              code: 'RATE_LIMITED',
              message: 'Batas permintaan tercapai.',
              retryable: true,
              requestId: 'req_rate',
              retryAfter: 120,
            },
          },
          { status: 429 },
        ),
      ),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe('RATE_LIMITED');
    expect(result.error.message).toBe('Terlalu banyak pemindaian. Coba lagi dalam 2 menit.');
    expect(result.error.retryAfterSeconds).toBe(120);
    expect(result.error.retryable).toBe(true);
  });

  it('membaca retry-after dari header bila body tidak memuatnya', async () => {
    const result = await requestScan({
      repoUrl: 'https://github.com/a/b',
      config: CONFIG,
      fetchImpl: fetchMock(
        jsonResponse(
          {
            error: {
              code: 'RATE_LIMITED',
              message: 'Batas permintaan tercapai.',
              retryable: true,
              requestId: 'req_rate',
            },
          },
          { status: 429, headers: { 'retry-after': '90' } },
        ),
      ),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.retryAfterSeconds).toBe(90);
    expect(result.error.message).toBe('Terlalu banyak pemindaian. Coba lagi dalam 2 menit.');
  });

  it('memakai kode HTTP bila body error tidak dapat dibaca', async () => {
    const result = await requestScan({
      repoUrl: 'https://github.com/a/b',
      config: CONFIG,
      fetchImpl: fetchMock(
        new Response('bukan json', {
          status: 500,
          headers: { 'x-request-id': 'req_internal' },
        }),
      ),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INTERNAL');
    expect(result.error.message).toBe(
      'Terjadi kesalahan pada server. Coba lagi. Kode: req_internal.',
    );
  });
});

describe('requestScan — validasi dan kegagalan jaringan', () => {
  it('menolak respons 200 yang tidak lengkap dengan kode requestId', async () => {
    const result = await requestScan({
      repoUrl: 'https://github.com/a/b',
      config: CONFIG,
      fetchImpl: fetchMock(
        jsonResponse({ scanId: 'hanya-id' }, { headers: { 'x-request-id': 'req_rusak' } }),
      ),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_RESPONSE');
    expect(result.error.message).toBe(
      'Terjadi kesalahan saat membaca hasil. Coba lagi. Kode: req_rusak.',
    );
    expect(result.error.requestId).toBe('req_rusak');
  });

  it('menolak body non-JSON pada 200', async () => {
    const result = await requestScan({
      repoUrl: 'https://github.com/a/b',
      config: CONFIG,
      fetchImpl: fetchMock(new Response('<html>bukan json</html>', { status: 200 })),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_RESPONSE');
  });

  it('memetakan kegagalan fetch menjadi NETWORK', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.reject(new TypeError('Network request failed')),
    ) as unknown as typeof fetch;

    const result = await requestScan({
      repoUrl: 'https://github.com/a/b',
      config: CONFIG,
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NETWORK');
    expect(result.error.message).toBe(
      'Tidak ada koneksi. Hasil tersimpan tetap bisa dibuka dari Riwayat.',
    );
    expect(result.error.retryable).toBe(true);
  });

  it('membatalkan permintaan setelah timeout klien', async () => {
    const fetchImpl = jest.fn(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    ) as unknown as typeof fetch;

    const result = await requestScan({
      repoUrl: 'https://github.com/a/b',
      config: CONFIG,
      fetchImpl,
      timeoutMs: 10,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('TIMEOUT');
    expect(result.error.message).toBe(
      'Pemindaian melebihi batas waktu. Coba lagi atau pindai repo yang lebih kecil.',
    );
  });

  it('melaporkan konfigurasi yang belum diisi tanpa membocorkan nilai', async () => {
    const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const previousKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    try {
      const result = await requestScan({ repoUrl: 'https://github.com/a/b' });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('CONFIG');
      expect(result.error.message).toBe(
        'Konfigurasi aplikasi belum lengkap. Hubungi pengembang.',
      );
    } finally {
      if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = previousKey;
    }
  });
});
