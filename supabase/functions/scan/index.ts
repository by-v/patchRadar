/**
 * Entry point Edge Function `scan`.
 *
 * JWT verification tetap aktif pada platform (deploy tanpa `--no-verify-jwt`).
 * Token GitHub dan service role hanya dibaca dari environment fungsi; tidak
 * pernah dicetak. Bila kredensial Supabase tidak tersedia, pipeline memakai
 * store memori (cache/katalog tidak persisten) agar unit test dan lokal aman.
 */

import { handleScanRequest } from './handler.ts';
import {
  createSupabaseKevStore,
  createSupabaseOsvCacheStore,
} from './supabase-store.ts';

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: {
    get: (name: string) => string | undefined;
  };
};

const token = Deno.env.get('GITHUB_TOKEN') ?? null;
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? null;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? null;

const stores =
  supabaseUrl && serviceRoleKey
    ? {
        osvStore: createSupabaseOsvCacheStore({ url: supabaseUrl, serviceRoleKey }),
        kevStore: createSupabaseKevStore({ url: supabaseUrl, serviceRoleKey }),
      }
    : {};

Deno.serve((request: Request) => handleScanRequest(request, { token, ...stores }));
