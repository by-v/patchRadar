/**
 * Alasan satu kalimat berbahasa Indonesia (PRD §11.6).
 *
 * Alasan hanya menyebut pemicu yang benar-benar tersedia: KEV tidak disebut
 * bila `kev=false`, EPSS tidak disebut bila `epssAvailable=false`.
 */

import { assignLabel, effectiveEpss } from './label.ts';
import type { FindingSignals } from './label.ts';
import { EPSS_FIX_NOW_THRESHOLD, EPSS_SCHEDULE_THRESHOLD } from './priority-config.ts';

function formatPercent(epss: number): string {
  const rounded = Math.round(epss * 1000) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace('.', ',');
}

/** Bangun alasan final; selalu satu kalimat dan tidak kosong. */
export function buildReason(signals: FindingSignals): string {
  if (signals.kev === true) {
    return 'Kerentanan ini sudah dieksploitasi nyata dan tercatat di CISA KEV, jadi ini prioritas tertinggi.';
  }

  const epss = effectiveEpss(signals);
  const label = assignLabel(signals);

  if (label === 'FIX_NOW') {
    return `Severity Critical dan peluang eksploitasi EPSS ${formatPercent(epss)}% (≥${
      EPSS_FIX_NOW_THRESHOLD * 100
    }%), sehingga berisiko tinggi.`;
  }

  if (label === 'SCHEDULE') {
    if (signals.severity === 'HIGH' || signals.severity === 'CRITICAL') {
      return `Severity ${signals.severity === 'HIGH' ? 'High' : 'Critical'}, tetapi belum ada bukti eksploitasi nyata yang kuat.`;
    }
    return `Peluang eksploitasi EPSS ${formatPercent(epss)}% (≥${
      EPSS_SCHEDULE_THRESHOLD * 100
    }%) meski severity bukan High/Critical.`;
  }

  if (signals.severity === 'UNKNOWN') {
    return 'Severity belum tersedia dan tidak ada indikasi eksploitasi; pantau dan periksa referensi.';
  }

  return 'Tidak ada indikasi eksploitasi nyata dan severity relatif rendah; pantau saja.';
}
