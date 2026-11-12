/**
 * Aturan perbaikan pada layar Detail (PRD FR-19).
 *
 * Perintah install hanya diberikan untuk dependensi langsung yang punya versi
 * aman. Temuan transitif selalu diarahkan ke pembaruan paket induk, dan temuan
 * tanpa perbaikan memakai pesan tetap yang sama dengan PRD.
 */

import type { ScanFinding } from '@/types/scan';

export const NO_SAFE_VERSION_MESSAGE = 'Belum ada versi aman yang diketahui';
export const TRANSITIVE_FIX_MESSAGE = 'Perbarui paket induk atau jalankan `npm audit fix`';

export type FixAdvice =
  | { kind: 'command'; command: string }
  | { kind: 'transitive'; message: string }
  | { kind: 'unavailable'; message: string };

/** Perintah install sesuai PRD FR-19. */
export function buildInstallCommand(packageName: string, safeVersion: string): string {
  return `npm install ${packageName}@${safeVersion}`;
}

/**
 * Tentukan tindakan perbaikan yang ditampilkan.
 *
 * `fix.command` dari backend dipakai bila tersedia agar konsisten dengan
 * kontrak; bila kosong, perintah dirakit dari nama paket dan versi aman.
 */
export function getFixAdvice(finding: Pick<ScanFinding, 'package' | 'fix'>): FixAdvice {
  if (!finding.package.direct) {
    return { kind: 'transitive', message: TRANSITIVE_FIX_MESSAGE };
  }

  const safeVersion = finding.fix.safeVersion;
  if (!safeVersion) {
    return { kind: 'unavailable', message: NO_SAFE_VERSION_MESSAGE };
  }

  const command = finding.fix.command?.trim();
  return {
    kind: 'command',
    command: command && command.length > 0
      ? command
      : buildInstallCommand(finding.package.name, safeVersion),
  };
}
