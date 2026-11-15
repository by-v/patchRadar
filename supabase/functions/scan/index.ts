/**
 * Entry point Edge Function `scan`.
 *
 * JWT verification tetap aktif pada platform (deploy tanpa `--no-verify-jwt`).
 * Token GitHub dan service role hanya dibaca dari environment fungsi; tidak
 * pernah dicetak. Konfigurasi Supabase (URL/service role) wajib ada agar scan
 * tidak berjalan tanpa penyimpanan cloud dan rate limit; bila hilang, setiap
 * permintaan ditolak dengan error terklasifikasi dan log server mencatat nama
 * variabel yang hilang tanpa nilainya.
 */

import { corsPreflightResponse } from './cors.ts';
import { scanErrorResponse } from './errors.ts';
import { handleScanRequest } from './handler.ts';
import {
  buildScanDependencies,
  logScanMisconfiguration,
  scanMisconfiguredError,
} from './composition.ts';

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

function newRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, '')}`;
}

const built = buildScanDependencies((name) => Deno.env.get(name));
if (!built.ok) {
  logScanMisconfiguration(built.missing);
}

Deno.serve((request: Request) => {
  if (request.method === 'OPTIONS') return corsPreflightResponse();
  if (!built.ok) {
    return scanErrorResponse(scanMisconfiguredError(), newRequestId());
  }
  return handleScanRequest(request, built.dependencies);
});
