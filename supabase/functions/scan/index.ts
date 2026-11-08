/**
 * Entry point Edge Function `scan`.
 *
 * JWT verification tetap aktif pada platform (deploy tanpa `--no-verify-jwt`).
 * Token GitHub hanya dibaca dari environment fungsi; tidak pernah dicetak.
 */

import { handleScanRequest } from './handler.ts';

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

const token = Deno.env.get('GITHUB_TOKEN') ?? null;

Deno.serve((request: Request) => handleScanRequest(request, { token }));
