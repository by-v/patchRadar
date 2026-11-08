import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildReason } from './reason.ts';
import type { FindingSignals } from './label.ts';
import { normalizeSeverity } from './severity.ts';
import type { Severity } from './severity.ts';

const EXPECTED: Array<{ name: string; signals: FindingSignals; reason: string }> = [
  {
    name: 'A',
    signals: { severity: 'LOW', epss: 0.001, kev: true },
    reason:
      'Kerentanan ini sudah dieksploitasi nyata dan tercatat di CISA KEV, jadi ini prioritas tertinggi.',
  },
  {
    name: 'B',
    signals: { severity: 'CRITICAL', epss: 0.12, kev: false },
    reason: 'Severity Critical dan peluang eksploitasi EPSS 12% (≥10%), sehingga berisiko tinggi.',
  },
  {
    name: 'C',
    signals: { severity: 'HIGH', epss: 0.02, kev: false },
    reason: 'Severity High, tetapi belum ada bukti eksploitasi nyata yang kuat.',
  },
  {
    name: 'D',
    signals: { severity: 'MEDIUM', epss: 0.06, kev: false },
    reason: 'Peluang eksploitasi EPSS 6% (≥5%) meski severity bukan High/Critical.',
  },
  {
    name: 'E',
    signals: { severity: 'MEDIUM', epss: 0.001, kev: false },
    reason: 'Tidak ada indikasi eksploitasi nyata dan severity relatif rendah; pantau saja.',
  },
  {
    name: 'F',
    signals: { severity: 'UNKNOWN', epss: null, kev: false },
    reason:
      'Severity belum tersedia dan tidak ada indikasi eksploitasi; pantau dan periksa referensi.',
  },
];

test('alasan skenario PRD §11.5 sama persis dengan templat', () => {
  for (const scenario of EXPECTED) {
    assert.equal(buildReason(scenario.signals), scenario.reason, `skenario ${scenario.name}`);
  }
});

test('alasan memakai persen desimal koma bila perlu', () => {
  assert.match(
    buildReason({ severity: 'MEDIUM', epss: 0.062, kev: false }),
    /EPSS 6,2% \(≥5%\)/,
  );
  assert.match(
    buildReason({ severity: 'CRITICAL', epss: 0.1, kev: false }),
    /EPSS 10% \(≥10%\)/,
  );
});

test('alasan tidak menyebut KEV saat kev=false', () => {
  for (const scenario of EXPECTED.filter((entry) => !entry.signals.kev)) {
    assert.doesNotMatch(buildReason(scenario.signals), /KEV/);
  }
});

test('alasan tidak menyebut EPSS saat EPSS tidak tersedia', () => {
  const levels: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
  for (const severity of levels) {
    const reason = buildReason({ severity, epss: 0.99, epssAvailable: false, kev: false });
    assert.doesNotMatch(reason, /EPSS/, severity);
  }
});

test('100% temuan pada fixture advisory mendapat alasan tidak kosong', () => {
  const fixturePath = fileURLToPath(
    new URL('../../../../fixtures/osv/advisory-details.json', import.meta.url),
  );
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    details: Array<Record<string, unknown>>;
  };

  assert.ok(fixture.details.length > 0);
  for (const detail of fixture.details) {
    const severity = normalizeSeverity(detail as Parameters<typeof normalizeSeverity>[0]).level;
    const reason = buildReason({ severity, epss: null, kev: false });
    assert.ok(reason.trim().length > 0, String(detail.id));
  }
});

test('100% kombinasi sinyal menghasilkan alasan tidak kosong dan satu kalimat', () => {
  const levels: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
  const epssValues: Array<number | null> = [null, 0, 0.001, 0.0499, 0.05, 0.0999, 0.1, 0.12, 1];

  for (const severity of levels) {
    for (const epss of epssValues) {
      for (const kev of [false, true]) {
        const reason = buildReason({ severity, epss, kev });
        assert.ok(reason.trim().length > 0);
        assert.ok(reason.endsWith('.'), reason);
        assert.equal(reason.split('.').filter((part) => part.trim().length > 0).length, 1, reason);
      }
    }
  }
});
