import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeScore } from './score.ts';
import type { Severity } from './severity.ts';

const SCENARIOS: Array<{ name: string; severity: Severity; epss: number | null; expected: number }> = [
  { name: 'A', severity: 'LOW', epss: 0.001, expected: 10 },
  { name: 'B', severity: 'CRITICAL', epss: 0.12, expected: 64.2 },
  { name: 'C', severity: 'HIGH', epss: 0.02, expected: 45.7 },
  { name: 'D', severity: 'MEDIUM', epss: 0.06, expected: 27.1 },
  { name: 'E', severity: 'MEDIUM', epss: 0.001, expected: 25 },
  { name: 'F', severity: 'UNKNOWN', epss: null, expected: 20 },
];

test('skenario PRD §11.5 menghasilkan skor yang sama', () => {
  for (const scenario of SCENARIOS) {
    assert.equal(
      computeScore({ severity: scenario.severity, epss: scenario.epss }),
      scenario.expected,
      `skenario ${scenario.name}`,
    );
  }
});

test('poin severity setiap level sesuai PRD §11.3', () => {
  assert.equal(computeScore({ severity: 'CRITICAL', epss: null }), 60);
  assert.equal(computeScore({ severity: 'HIGH', epss: null }), 45);
  assert.equal(computeScore({ severity: 'MEDIUM', epss: null }), 25);
  assert.equal(computeScore({ severity: 'LOW', epss: null }), 10);
  assert.equal(computeScore({ severity: 'UNKNOWN', epss: null }), 20);
});

test('poin EPSS dibatasi 35 dan skor dibatasi 100', () => {
  assert.equal(computeScore({ severity: 'CRITICAL', epss: 1 }), 95);
  assert.equal(computeScore({ severity: 'CRITICAL', epss: 2 }), 95);
  assert.equal(computeScore({ severity: 'UNKNOWN', epss: 1 }), 55);
  assert.ok(computeScore({ severity: 'CRITICAL', epss: 1 }) <= 100);
});

test('EPSS tidak tersedia atau tidak valid tidak menambah skor', () => {
  assert.equal(computeScore({ severity: 'HIGH', epss: null }), 45);
  assert.equal(computeScore({ severity: 'HIGH', epss: 0.9, epssAvailable: false }), 45);
  assert.equal(computeScore({ severity: 'HIGH', epss: Number.NaN }), 45);
  assert.equal(computeScore({ severity: 'HIGH', epss: -0.5 }), 45);
});

test('skor dibulatkan satu desimal agar stabil', () => {
  assert.equal(computeScore({ severity: 'CRITICAL', epss: 0.1 }), 63.5);
  assert.equal(computeScore({ severity: 'CRITICAL', epss: 0.05 }), 61.8);
  assert.equal(computeScore({ severity: 'MEDIUM', epss: 0.062 }), 27.2);
});
