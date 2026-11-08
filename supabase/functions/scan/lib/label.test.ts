import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { assignLabel, effectiveEpss, PRIORITY_LABEL_TEXT } from './label.ts';
import type { FindingSignals, PriorityLabel } from './label.ts';
import type { Severity } from './severity.ts';

interface Scenario extends FindingSignals {
  name: string;
  expected: PriorityLabel;
  score: number;
}

const SCENARIOS: Scenario[] = [
  { name: 'A', severity: 'LOW', epss: 0.001, kev: true, expected: 'FIX_NOW', score: 10 },
  { name: 'B', severity: 'CRITICAL', epss: 0.12, kev: false, expected: 'FIX_NOW', score: 64.2 },
  { name: 'C', severity: 'HIGH', epss: 0.02, kev: false, expected: 'SCHEDULE', score: 45.7 },
  { name: 'D', severity: 'MEDIUM', epss: 0.06, kev: false, expected: 'SCHEDULE', score: 27.1 },
  { name: 'E', severity: 'MEDIUM', epss: 0.001, kev: false, expected: 'MONITOR', score: 25 },
  { name: 'F', severity: 'UNKNOWN', epss: null, kev: false, expected: 'MONITOR', score: 20 },
];

test('skenario PRD §11.5 menghasilkan label yang sama', () => {
  for (const scenario of SCENARIOS) {
    assert.equal(assignLabel(scenario), scenario.expected, `skenario ${scenario.name}`);
  }
});

test('ambang EPSS tepat 0,10 dan 0,05 diterapkan inklusif', () => {
  assert.equal(assignLabel({ severity: 'CRITICAL', epss: 0.1, kev: false }), 'FIX_NOW');
  assert.equal(assignLabel({ severity: 'CRITICAL', epss: 0.0999, kev: false }), 'SCHEDULE');
  assert.equal(assignLabel({ severity: 'MEDIUM', epss: 0.1, kev: false }), 'SCHEDULE');
  assert.equal(assignLabel({ severity: 'MEDIUM', epss: 0.05, kev: false }), 'SCHEDULE');
  assert.equal(assignLabel({ severity: 'MEDIUM', epss: 0.0499, kev: false }), 'MONITOR');
  assert.equal(assignLabel({ severity: 'LOW', epss: 0.05, kev: false }), 'SCHEDULE');
  assert.equal(assignLabel({ severity: 'UNKNOWN', epss: 0.05, kev: false }), 'SCHEDULE');
});

test('KEV selalu FIX_NOW tanpa melihat severity atau EPSS', () => {
  const levels: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
  for (const severity of levels) {
    assert.equal(assignLabel({ severity, epss: null, kev: true }), 'FIX_NOW');
    assert.equal(assignLabel({ severity, epss: 0, kev: true }), 'FIX_NOW');
  }
});

test('EPSS tidak tersedia diperlakukan 0 untuk label', () => {
  assert.equal(effectiveEpss({ epss: 0.9, epssAvailable: false }), 0);
  assert.equal(
    assignLabel({ severity: 'CRITICAL', epss: 0.9, epssAvailable: false, kev: false }),
    'SCHEDULE',
  );
  assert.equal(assignLabel({ severity: 'MEDIUM', epss: 0.9, epssAvailable: false, kev: false }), 'MONITOR');
  assert.equal(assignLabel({ severity: 'MEDIUM', epss: null, kev: false }), 'MONITOR');
});

test('EPSS di luar 0–1 dijepit dan nilai tidak valid menjadi 0', () => {
  assert.equal(effectiveEpss({ epss: 2 }), 1);
  assert.equal(effectiveEpss({ epss: -1 }), 0);
  assert.equal(effectiveEpss({ epss: Number.NaN }), 0);
});

test('teks label berbahasa Indonesia', () => {
  assert.deepEqual(PRIORITY_LABEL_TEXT, {
    FIX_NOW: 'Tambal sekarang',
    SCHEDULE: 'Jadwalkan',
    MONITOR: 'Pantau',
  });
});
