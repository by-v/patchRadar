import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { compareFindings, sortFindings } from './sort.ts';
import type { SortableFinding } from './sort.ts';
import type { PriorityLabel } from './label.ts';
import type { Severity } from './severity.ts';

interface FixtureFinding extends SortableFinding {
  id: string;
}

function finding(
  id: string,
  packageName: string,
  severity: Severity,
  epss: number | null,
  kev: boolean,
  label: PriorityLabel,
  score: number,
): FixtureFinding {
  return {
    id,
    packageName,
    packageVersion: '1.0.0',
    osvId: `GHSA-${id}`,
    severity,
    epss,
    kev,
    label,
    score,
  };
}

const SCENARIOS: FixtureFinding[] = [
  finding('F', 'pkg-f', 'UNKNOWN', null, false, 'MONITOR', 20),
  finding('D', 'pkg-d', 'MEDIUM', 0.06, false, 'SCHEDULE', 27.1),
  finding('B', 'pkg-b', 'CRITICAL', 0.12, false, 'FIX_NOW', 64.2),
  finding('A', 'pkg-a', 'LOW', 0.001, true, 'FIX_NOW', 10),
  finding('E', 'pkg-e', 'MEDIUM', 0.001, false, 'MONITOR', 25),
  finding('C', 'pkg-c', 'HIGH', 0.02, false, 'SCHEDULE', 45.7),
];

test('urutan skenario PRD §11.5: A → B → C → D → E → F', () => {
  assert.deepEqual(
    sortFindings(SCENARIOS).map((item) => item.id),
    ['A', 'B', 'C', 'D', 'E', 'F'],
  );
});

test('KEV lebih dulu dalam label yang sama walau skornya lebih rendah', () => {
  assert.ok(compareFindings(SCENARIOS[3]!, SCENARIOS[2]!) < 0);
});

test('skor menurun dalam label dan EPSS yang sama', () => {
  const high = finding('H1', 'zeta', 'MEDIUM', null, false, 'MONITOR', 50);
  const low = finding('H2', 'alpha', 'MEDIUM', null, false, 'MONITOR', 45);
  assert.deepEqual(sortFindings([low, high]).map((item) => item.id), ['H1', 'H2']);
});

test('EPSS menurun saat skor sama', () => {
  const lowerEpss = finding('E1', 'alpha', 'HIGH', 0, false, 'SCHEDULE', 45);
  const higherEpss = finding('E2', 'zeta', 'MEDIUM', 0.5714, false, 'SCHEDULE', 45);
  assert.deepEqual(sortFindings([lowerEpss, higherEpss]).map((item) => item.id), ['E2', 'E1']);
});

test('urutan stabil saat label, KEV, skor, dan EPSS sama: nama paket A–Z', () => {
  const zeta = finding('S1', 'zeta', 'MEDIUM', 0.01, false, 'MONITOR', 25.4);
  const alpha = finding('S2', 'alpha', 'MEDIUM', 0.01, false, 'MONITOR', 25.4);
  const middle = finding('S3', 'middle', 'MEDIUM', 0.01, false, 'MONITOR', 25.4);

  const result = sortFindings([zeta, alpha, middle]);
  assert.deepEqual(result.map((item) => item.packageName), ['alpha', 'middle', 'zeta']);
  assert.deepEqual(result.map((item) => item.id), ['S2', 'S3', 'S1']);
});

test('sortFindings tidak mengubah array masukan', () => {
  const input = [...SCENARIOS];
  const snapshot = input.map((item) => item.id);
  sortFindings(input);
  assert.deepEqual(input.map((item) => item.id), snapshot);
});
