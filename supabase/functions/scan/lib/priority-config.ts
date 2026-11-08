/**
 * Konfigurasi mesin prioritas PatchRadar.
 *
 * Seluruh ambang batas, label, dan bobot skor berada di berkas ini agar mudah
 * dikalibrasi. Perubahan nilai wajib menaikkan `ENGINE_VERSION` (PRD §11.2).
 * Tidak memakai API Node; aman untuk Deno Edge Function.
 */

import type { Severity } from './severity.ts';

/** Versi mesin label/skor. Naikkan setiap ambang atau bobot berubah. */
export const ENGINE_VERSION = '1.0.0';

/** Ambang EPSS untuk FIX_NOW bersama severity CRITICAL. */
export const EPSS_FIX_NOW_THRESHOLD = 0.1;

/** Ambang EPSS untuk SCHEDULE tanpa severity HIGH/CRITICAL. */
export const EPSS_SCHEDULE_THRESHOLD = 0.05;

/** Severity yang langsung memenuhi syarat SCHEDULE. */
export const SCHEDULE_SEVERITIES: readonly Severity[] = ['HIGH', 'CRITICAL'];

/** Poin severity untuk skor 0–100 (PRD §11.3). */
export const SEVERITY_SCORE: Readonly<Record<Severity, number>> = {
  CRITICAL: 60,
  HIGH: 45,
  MEDIUM: 25,
  LOW: 10,
  UNKNOWN: 20,
};

/** Faktor EPSS: `epss × 100 × 0,35`, dibatasi `EPSS_SCORE_MAX`. */
export const EPSS_SCORE_MULTIPLIER = 100;
export const EPSS_SCORE_FACTOR = 0.35;
export const EPSS_SCORE_MAX = 35;

/** Batas atas skor akhir. */
export const SCORE_MAX = 100;

/** Peringkat label untuk pengurutan. */
export const LABEL_RANK = {
  FIX_NOW: 0,
  SCHEDULE: 1,
  MONITOR: 2,
} as const;
