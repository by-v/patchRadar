import type { PriorityLabel, SeverityLevel } from '@/types/scan';

export const PRIORITY_ORDER: readonly PriorityLabel[] = ['FIX_NOW', 'SCHEDULE', 'MONITOR'];

export const PRIORITY_LABELS: Readonly<Record<PriorityLabel, string>> = {
  FIX_NOW: 'Tambal sekarang',
  SCHEDULE: 'Jadwalkan',
  MONITOR: 'Pantau',
};

export const SEVERITY_LABELS: Readonly<Record<SeverityLevel, string>> = {
  CRITICAL: 'Kritis',
  HIGH: 'Tinggi',
  MEDIUM: 'Sedang',
  LOW: 'Rendah',
  UNKNOWN: 'Tidak diketahui',
};
