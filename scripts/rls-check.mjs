#!/usr/bin/env node
/**
 * T-W3-08 — uji isolasi RLS dua pengguna anonim pada proyek remote.
 *
 * Dibaca dari environment publik Expo (`--env-file=app/.env`). Skrip TIDAK
 * membaca/mencetak/menyimpan isi berkas env dan tidak pernah mencetak anon key,
 * access token, refresh token, atau JWT. Keluaran hanya label, status HTTP,
 * jumlah baris, dan requestId; user id dipotong menjadi 8 karakter.
 *
 * Tidak memakai service_role, tidak melakukan deploy/db push, dan tidak
 * menghapus data. Satu-satunya upaya hapus adalah DELETE oleh B terhadap scan A
 * yang justru harus ditolak (0 baris).
 */

const SCAN_REPO_URL = 'https://github.com/expressjs/express';
const REQUEST_TIMEOUT_MS = 40_000;

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} belum tersedia di environment.`);
  return value;
}

function normalizeBaseUrl(raw) {
  return raw
    .replace(/\/+$/u, '')
    .replace(/\/rest\/v1$/iu, '')
    .replace(/\/+$/u, '');
}

function shortId(value) {
  return typeof value === 'string' && value.length >= 8 ? value.slice(0, 8) : null;
}

async function requestJson(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body = null;
    if (text.length > 0) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function rowsOf(result) {
  return Array.isArray(result.body) ? result.body.length : null;
}

function print(entry) {
  console.log(JSON.stringify(entry));
}

async function signInAnonymous(baseUrl, anonKey) {
  return requestJson(`${baseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ data: {}, gotrue_meta_security: {} }),
  });
}

function authHeaders(anonKey, accessToken) {
  const headers = { apikey: anonKey, accept: 'application/json' };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return headers;
}

async function restGet(baseUrl, anonKey, accessToken, path) {
  return requestJson(`${baseUrl}/rest/v1/${path}`, {
    headers: authHeaders(anonKey, accessToken),
  });
}

async function restWrite(baseUrl, anonKey, accessToken, path, method, body) {
  return requestJson(`${baseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      ...authHeaders(anonKey, accessToken),
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function scan(baseUrl, anonKey, accessToken) {
  return requestJson(`${baseUrl}/functions/v1/scan`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'x-client-version': '1.0.0',
    },
    body: JSON.stringify({ repoUrl: SCAN_REPO_URL, clientVersion: '1.0.0' }),
  });
}

function failureExit(message) {
  print({ check: 'gagal', http: null, rows: null, requestId: null });
  console.error(message);
  process.exitCode = 2;
}

async function main() {
  const baseUrl = normalizeBaseUrl(requireEnv('EXPO_PUBLIC_SUPABASE_URL'));
  const anonKey = requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  // a. Dua sesi anonim dengan user id berbeda.
  const signupA = await signInAnonymous(baseUrl, anonKey);
  print({ check: 'signup_A', http: signupA.status, rows: null, requestId: null });
  if (signupA.status !== 200 || !signupA.body?.access_token || !signupA.body?.user?.id) {
    failureExit('Anonymous sign-in A gagal; pengaturan dashboard tidak dapat diubah dari sini.');
    return;
  }

  const signupB = await signInAnonymous(baseUrl, anonKey);
  print({ check: 'signup_B', http: signupB.status, rows: null, requestId: null });
  if (signupB.status !== 200 || !signupB.body?.access_token || !signupB.body?.user?.id) {
    failureExit('Anonymous sign-in B gagal; pengaturan dashboard tidak dapat diubah dari sini.');
    return;
  }

  const userA = signupB.body.user.id === signupA.body.user.id ? null : signupA.body.user.id;
  const userB = signupB.body.user.id;
  const tokenA = signupA.body.access_token;
  const tokenB = signupB.body.access_token;
  print({
    check: 'users_berbeda',
    http: 200,
    rows: null,
    requestId: null,
    userA: shortId(userA),
    userB: shortId(userB),
    berbeda: userA !== null,
  });
  if (userA === null) {
    failureExit('Sesi A dan B memiliki user id sama; uji tidak valid.');
    return;
  }

  // b. Scan A dan penyimpanan cloud.
  const scanA = await scan(baseUrl, anonKey, tokenA);
  const scanBody = scanA.body ?? {};
  const requestId = scanBody.requestId ?? null;
  print({
    check: 'scan_A',
    http: scanA.status,
    rows: Array.isArray(scanBody.findings) ? scanBody.findings.length : null,
    requestId,
    scanId: typeof scanBody.scanId === 'string' ? scanBody.scanId : null,
    persisted: scanBody.persisted ?? null,
  });

  if (scanA.status !== 200 || typeof scanBody.scanId !== 'string') {
    failureExit('Scan A tidak menghasilkan 200 + scanId; uji tidak valid.');
    return;
  }
  const scanId = scanBody.scanId;

  // c. A membaca tabel miliknya sendiri.
  const scansA = await restGet(baseUrl, anonKey, tokenA, 'scans?select=id,user_id');
  const rowsScansA = rowsOf(scansA);
  print({
    check: 'A_baca_scans',
    http: scansA.status,
    rows: rowsScansA,
    requestId: null,
  });

  const findingsA = await restGet(
    baseUrl,
    anonKey,
    tokenA,
    `findings?select=id,scan_id&scan_id=eq.${encodeURIComponent(scanId)}`,
  );
  const rowsFindingsA = rowsOf(findingsA);
  print({
    check: 'A_baca_findings',
    http: findingsA.status,
    rows: rowsFindingsA,
    requestId: null,
  });

  const scanAById = await restGet(
    baseUrl,
    anonKey,
    tokenA,
    `scans?select=id,user_id&id=eq.${encodeURIComponent(scanId)}`,
  );
  const rowsScanAById = rowsOf(scanAById);
  print({
    check: 'A_baca_scan_by_id',
    http: scanAById.status,
    rows: rowsScanAById,
    requestId: null,
  });

  const ownsScan =
    scansA.status === 200 &&
    rowsScansA !== null &&
    rowsScansA >= 1 &&
    scanAById.status === 200 &&
    rowsScanAById === 1;

  if (scanBody.persisted !== true || !ownsScan) {
    print({
      check: 'validitas',
      http: null,
      rows: null,
      requestId,
      valid: false,
      alasan: 'persisted bukan true atau A tidak dapat membaca scan miliknya',
    });
    failureExit(
      'Uji TIDAK VALID: scan A tidak tersimpan atau tidak terbaca oleh A. Isolasi tidak diklaim.',
    );
    return;
  }

  // d. B membaca data A.
  const scansB = await restGet(baseUrl, anonKey, tokenB, 'scans?select=id,user_id');
  print({ check: 'B_baca_scans', http: scansB.status, rows: rowsOf(scansB), requestId: null });

  const findingsB = await restGet(
    baseUrl,
    anonKey,
    tokenB,
    `findings?select=id,scan_id&scan_id=eq.${encodeURIComponent(scanId)}`,
  );
  print({
    check: 'B_baca_findings',
    http: findingsB.status,
    rows: rowsOf(findingsB),
    requestId: null,
  });

  const scanAByIdB = await restGet(
    baseUrl,
    anonKey,
    tokenB,
    `scans?select=id,user_id&id=eq.${encodeURIComponent(scanId)}`,
  );
  print({
    check: 'B_baca_scan_A_by_id',
    http: scanAByIdB.status,
    rows: rowsOf(scanAByIdB),
    requestId: null,
  });

  // e. B mencoba UPDATE lalu DELETE scan A; A harus tetap bisa membacanya.
  const patchB = await restWrite(
    baseUrl,
    anonKey,
    tokenB,
    `scans?id=eq.${encodeURIComponent(scanId)}`,
    'PATCH',
    { repo_name: 'rls-check-tidak-boleh-berhasil' },
  );
  print({ check: 'B_patch_scan_A', http: patchB.status, rows: rowsOf(patchB), requestId: null });

  const deleteB = await restWrite(
    baseUrl,
    anonKey,
    tokenB,
    `scans?id=eq.${encodeURIComponent(scanId)}`,
    'DELETE',
  );
  print({ check: 'B_delete_scan_A', http: deleteB.status, rows: rowsOf(deleteB), requestId: null });

  const scanAAfterB = await restGet(
    baseUrl,
    anonKey,
    tokenA,
    `scans?select=id,user_id&id=eq.${encodeURIComponent(scanId)}`,
  );
  print({
    check: 'A_baca_setelah_B',
    http: scanAAfterB.status,
    rows: rowsOf(scanAAfterB),
    requestId: null,
  });

  // f. B mencoba INSERT scan dengan user_id milik A.
  const insertB = await restWrite(baseUrl, anonKey, tokenB, 'scans', 'POST', {
    user_id: userA,
    repo_owner: 'rls-check',
    repo_name: 'insert-tidak-boleh-berhasil',
    repo_url: 'https://github.com/rls-check/insert-tidak-boleh-berhasil',
    status: 'COMPLETED',
    manifest_source: 'LOCKFILE',
    engine_version: 'rls-check',
  });
  print({ check: 'B_insert_user_A', http: insertB.status, rows: rowsOf(insertB), requestId: null });

  // g. Tabel internal: B dan tanpa login.
  for (const table of ['osv_cache', 'kev_entries']) {
    const column = table === 'osv_cache' ? 'cache_key' : 'cve_id';
    const asB = await restGet(baseUrl, anonKey, tokenB, `${table}?select=${column}&limit=1`);
    print({
      check: `B_baca_${table}`,
      http: asB.status,
      rows: rowsOf(asB),
      requestId: null,
    });

    const anonRead = await restGet(baseUrl, anonKey, null, `${table}?select=${column}&limit=1`);
    print({
      check: `anon_baca_${table}`,
      http: anonRead.status,
      rows: rowsOf(anonRead),
      requestId: null,
    });
  }

  // h. Tanpa login membaca scans dan findings.
  const anonScans = await restGet(baseUrl, anonKey, null, 'scans?select=id,user_id');
  print({
    check: 'anon_baca_scans',
    http: anonScans.status,
    rows: rowsOf(anonScans),
    requestId: null,
  });

  const anonFindings = await restGet(baseUrl, anonKey, null, 'findings?select=id,scan_id');
  print({
    check: 'anon_baca_findings',
    http: anonFindings.status,
    rows: rowsOf(anonFindings),
    requestId: null,
  });

  print({
    check: 'selesai',
    http: 200,
    rows: null,
    requestId,
    scanId,
    dataUjiDibiarkan: true,
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'kesalahan tidak dikenal';
  // Pesan dibuat sendiri dan tidak pernah memuat token/kunci.
  console.error(`RLS CHECK GAGAL: ${message}`);
  process.exitCode = 1;
});
