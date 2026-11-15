#!/usr/bin/env node
/**
 * Uji isolasi RLS dua pengguna anonim (T-W3-08, A3).
 *
 * Dibaca dari environment publik Expo (`--env-file=app/.env`). Skrip TIDAK
 * membaca/mencetak/menyimpan isi berkas env dan tidak pernah mencetak anon key,
 * access token, refresh token, atau JWT. Keluaran hanya label, status HTTP,
 * jumlah baris, requestId, dan kode error PostgREST bila ada; user id dipotong
 * menjadi 8 karakter.
 *
 * Tidak memakai service_role, tidak melakukan deploy/db push, dan tidak
 * menghapus data. Satu-satunya upaya hapus adalah DELETE oleh B terhadap scan A
 * yang justru harus ditolak/0 baris.
 */

const SCAN_REPO_URL = 'https://github.com/axios/axios';
const REQUEST_TIMEOUT_MS = 60_000;

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

function pgErrorCode(result) {
  const b = result?.body;
  if (b && typeof b === 'object' && !Array.isArray(b) && typeof b.code === 'string') return b.code;
  return null;
}

function baseEntry(label, result, requestId = null) {
  const entry = { label, http: result.status, rows: rowsOf(result), requestId };
  const code = pgErrorCode(result);
  if (code !== null) entry.pgErrorCode = code;
  return entry;
}

function print(entry) {
  console.log(JSON.stringify(entry));
}

async function signInAnonymous(baseUrl, anonKey) {
  return requestJson(`${baseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ data: {}, gotrue_meta_security: {} }),
  });
}

function authHeaders(anonKey, accessToken) {
  const headers = { apikey: anonKey, accept: 'application/json' };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return headers;
}

async function restGet(baseUrl, anonKey, accessToken, path) {
  return requestJson(`${baseUrl}/rest/v1/${path}`, { headers: authHeaders(anonKey, accessToken) });
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

async function scan(baseUrl, anonKey, accessToken, repoUrl) {
  return requestJson(`${baseUrl}/functions/v1/scan`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'x-client-version': '1.0.0',
    },
    body: JSON.stringify({ repoUrl, clientVersion: '1.0.0' }),
  });
}

let leakDetected = false;
function markLeak(detail) {
  leakDetected = true;
  print({ ...detail, leak: true });
}

function fail(message) {
  print({ label: 'gagal', http: null, rows: null, requestId: null, message });
  process.exitCode = 2;
}

async function main() {
  const baseUrl = normalizeBaseUrl(requireEnv('EXPO_PUBLIC_SUPABASE_URL'));
  const anonKey = requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  const signupA = await signInAnonymous(baseUrl, anonKey);
  print({ label: 'signup_A', http: signupA.status, rows: null, requestId: null, userId8: shortId(signupA.body?.user?.id) });
  if (signupA.status !== 200 || !signupA.body?.access_token || !signupA.body?.user?.id) {
    fail('Anonymous sign-in A gagal.');
    return;
  }

  const signupB = await signInAnonymous(baseUrl, anonKey);
  print({ label: 'signup_B', http: signupB.status, rows: null, requestId: null, userId8: shortId(signupB.body?.user?.id) });
  if (signupB.status !== 200 || !signupB.body?.access_token || !signupB.body?.user?.id) {
    fail('Anonymous sign-in B gagal.');
    return;
  }

  const userA = signupA.body.user.id;
  const userB = signupB.body.user.id;
  const tokenA = signupA.body.access_token;
  const tokenB = signupB.body.access_token;
  print({ label: 'users_berbeda', http: 200, rows: null, requestId: null, userA8: shortId(userA), userB8: shortId(userB), berbeda: userA !== userB });
  if (userA === userB) {
    fail('Sesi A dan B memiliki user id sama; uji tidak valid.');
    return;
  }

  const scanA = await scan(baseUrl, anonKey, tokenA, SCAN_REPO_URL);
  const scanBody = scanA.body ?? {};
  const requestId = scanBody.requestId ?? scanBody?.error?.requestId ?? null;
  const scanId = typeof scanBody.scanId === 'string' ? scanBody.scanId : null;
  const warningCodes = Array.isArray(scanBody.warnings)
    ? scanBody.warnings.map((w) => (w && typeof w.code === 'string' ? w.code : null)).filter((c) => c !== null)
    : null;
  print({
    label: 'scan_A',
    http: scanA.status,
    rows: Array.isArray(scanBody.findings) ? scanBody.findings.length : null,
    requestId,
    scanId,
    persisted: scanBody.persisted ?? null,
    warningCodes,
  });
  if (scanA.status !== 200 || !scanId) {
    fail('Scan A tidak menghasilkan 200 + scanId; uji tidak valid.');
    return;
  }

  const scansA = await restGet(baseUrl, anonKey, tokenA, 'scans?select=id,user_id');
  print(baseEntry('A_baca_scans', scansA));

  const findingsA = await restGet(baseUrl, anonKey, tokenA, `findings?select=id,scan_id&scan_id=eq.${encodeURIComponent(scanId)}`);
  print(baseEntry('A_baca_findings_scan_A', findingsA));

  const scanAById = await restGet(baseUrl, anonKey, tokenA, `scans?select=id,user_id&id=eq.${encodeURIComponent(scanId)}`);
  print(baseEntry('A_baca_scan_A_by_id', scanAById));

  const valid =
    scanBody.persisted === true &&
    Array.isArray(scanBody.findings) && scanBody.findings.length >= 1 &&
    scansA.status === 200 && (rowsOf(scansA) ?? 0) >= 1 &&
    findingsA.status === 200 && (rowsOf(findingsA) ?? 0) >= 1 &&
    scanAById.status === 200 && rowsOf(scanAById) === 1;

  print({ label: 'validitas_scan_A', http: null, rows: null, requestId, valid });
  if (!valid) {
    fail('Uji TIDAK VALID: scan A tidak memenuhi syarat (persisted=true, findings>=1, A baca scans>=1 dan findings>=1). Isolasi tidak diklaim.');
    return;
  }

  // B membaca data A
  const scansB = await restGet(baseUrl, anonKey, tokenB, 'scans?select=id,user_id');
  const eScansB = baseEntry('B_baca_scans', scansB); print(eScansB);
  if ((rowsOf(scansB) ?? 0) >= 1) markLeak(eScansB);

  const findingsB = await restGet(baseUrl, anonKey, tokenB, `findings?select=id,scan_id&scan_id=eq.${encodeURIComponent(scanId)}`);
  const eFindB = baseEntry('B_baca_findings_scan_A', findingsB); print(eFindB);
  if ((rowsOf(findingsB) ?? 0) >= 1) markLeak(eFindB);

  const scanAByIdB = await restGet(baseUrl, anonKey, tokenB, `scans?select=id,user_id&id=eq.${encodeURIComponent(scanId)}`);
  const eScanByIdB = baseEntry('B_baca_scan_A_by_id', scanAByIdB); print(eScanByIdB);
  if ((rowsOf(scanAByIdB) ?? 0) >= 1) markLeak(eScanByIdB);

  // B INSERT scans dengan user_id milik A
  const insertB = await restWrite(baseUrl, anonKey, tokenB, 'scans', 'POST', {
    user_id: userA,
    repo_owner: 'rls-check',
    repo_name: 'insert-tidak-boleh-berhasil',
    repo_url: 'https://github.com/rls-check/insert-tidak-boleh-berhasil',
    status: 'COMPLETED',
    manifest_source: 'LOCKFILE',
    engine_version: 'rls-check',
  });
  print(baseEntry('B_insert_scans_user_id_A', insertB));

  // B PATCH dan DELETE scan A
  const patchB = await restWrite(baseUrl, anonKey, tokenB, `scans?id=eq.${encodeURIComponent(scanId)}`, 'PATCH', { repo_name: 'rls-check-tidak-boleh-berhasil' });
  print(baseEntry('B_patch_scan_A', patchB));

  const deleteB = await restWrite(baseUrl, anonKey, tokenB, `scans?id=eq.${encodeURIComponent(scanId)}`, 'DELETE');
  print(baseEntry('B_delete_scan_A', deleteB));

  // A masih bisa membaca scan dan findings setelah upaya B
  const scanAAfter = await restGet(baseUrl, anonKey, tokenA, `scans?select=id,user_id&id=eq.${encodeURIComponent(scanId)}`);
  print(baseEntry('A_baca_scan_A_setelah_B', scanAAfter));
  const findingsAAfter = await restGet(baseUrl, anonKey, tokenA, `findings?select=id,scan_id&scan_id=eq.${encodeURIComponent(scanId)}`);
  print(baseEntry('A_baca_findings_scan_A_setelah_B', findingsAAfter));

  // anon/tanpa login membaca scans/findings dan tabel internal
  const anonScans = await restGet(baseUrl, anonKey, null, 'scans?select=id,user_id');
  const eAnonScans = baseEntry('anon_baca_scans', anonScans); print(eAnonScans);
  if ((rowsOf(anonScans) ?? 0) >= 1) markLeak(eAnonScans);

  const anonFindings = await restGet(baseUrl, anonKey, null, 'findings?select=id,scan_id');
  const eAnonFind = baseEntry('anon_baca_findings', anonFindings); print(eAnonFind);
  if ((rowsOf(anonFindings) ?? 0) >= 1) markLeak(eAnonFind);

  for (const [table, column] of [['osv_cache','cache_key'], ['kev_entries','cve_id'], ['epss_cache','cve_id'], ['rate_limit_events','id']]) {
    const asB = await restGet(baseUrl, anonKey, tokenB, `${table}?select=${column}&limit=1`);
    const eb = baseEntry(`B_baca_${table}`, asB); print(eb);
    if ((rowsOf(asB) ?? 0) >= 1) markLeak(eb);
    const anonR = await restGet(baseUrl, anonKey, null, `${table}?select=${column}&limit=1`);
    const ea = baseEntry(`anon_baca_${table}`, anonR); print(ea);
    if ((rowsOf(anonR) ?? 0) >= 1) markLeak(ea);
  }

  print({ label: 'selesai', http: 200, rows: null, requestId, scanId, userA8: shortId(userA), userB8: shortId(userB), leakDetected, dataUjiDibiarkan: true });
  if (leakDetected) {
    console.error('KEBOCORAN RLS TERDETEKSI: ada pemeriksaan B/anon yang mengembalikan >=1 baris.');
    process.exitCode = 3;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'kesalahan tidak dikenal';
  console.error(`RLS CHECK GAGAL: ${message}`);
  process.exitCode = 1;
});
