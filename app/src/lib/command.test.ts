import {
  NO_SAFE_VERSION_MESSAGE,
  TRANSITIVE_FIX_MESSAGE,
  buildInstallCommand,
  getFixAdvice,
} from '@/lib/command';
import type { ScanFinding } from '@/types/scan';

function findingWithFix(
  overrides: {
    direct?: boolean;
    safeVersion?: string | null;
    command?: string | null;
  } = {},
): Pick<ScanFinding, 'package' | 'fix'> {
  const { direct = true, safeVersion = '4.5.0', command = null } = overrides;

  return {
    package: {
      name: 'hbs',
      installedVersion: '4.4.0',
      direct,
      devOnly: false,
      parentPackage: direct ? null : 'express',
    },
    fix: { safeVersion, command, suggestion: null },
  };
}

describe('buildInstallCommand', () => {
  it('merakit perintah sesuai PRD FR-19', () => {
    expect(buildInstallCommand('hbs', '4.5.0')).toBe('npm install hbs@4.5.0');
  });
});

describe('getFixAdvice', () => {
  it('memberi perintah untuk dependensi langsung dengan versi aman', () => {
    expect(getFixAdvice(findingWithFix())).toEqual({
      kind: 'command',
      command: 'npm install hbs@4.5.0',
    });
  });

  it('memakai perintah dari backend bila tersedia', () => {
    expect(
      getFixAdvice(findingWithFix({ command: 'npm install hbs@4.5.0 --save-exact' })),
    ).toEqual({ kind: 'command', command: 'npm install hbs@4.5.0 --save-exact' });
  });

  it('mengabaikan perintah backend yang kosong', () => {
    expect(getFixAdvice(findingWithFix({ command: '   ' }))).toEqual({
      kind: 'command',
      command: 'npm install hbs@4.5.0',
    });
  });

  it('tidak memberi perintah install untuk temuan transitif', () => {
    expect(getFixAdvice(findingWithFix({ direct: false, safeVersion: '4.5.0' }))).toEqual({
      kind: 'transitive',
      message: TRANSITIVE_FIX_MESSAGE,
    });
  });

  it('menampilkan pesan tetap bila belum ada versi aman', () => {
    expect(getFixAdvice(findingWithFix({ safeVersion: null }))).toEqual({
      kind: 'unavailable',
      message: NO_SAFE_VERSION_MESSAGE,
    });
  });
});
