/**
 * Semver subset untuk kebutuhan PatchRadar.
 *
 * Mendukung perbandingan versi, `^`, `~`, exact, wildcard, range majemuk,
 * hyphen range, OR (`||`), dan aturan prerelease npm. Fungsi murni tanpa API
 * Node sehingga aman untuk Deno Edge Function.
 */

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
  raw: string;
}

interface PartialVersion {
  major: number | null;
  minor: number | null;
  patch: number | null;
  prerelease: string[];
}

type Operator = '>' | '>=' | '<' | '<=' | '=';

interface Comparator {
  operator: Operator;
  version: SemVer;
}

export type ComparatorSet = readonly Comparator[];

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const PARTIAL_PATTERN =
  /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function isWildcard(value: string | undefined): boolean {
  return value === undefined || value === '*' || value.toLowerCase() === 'x';
}

export function parseVersion(input: string): SemVer | null {
  const trimmed = input.trim().replace(/^=/, '');
  const match = VERSION_PATTERN.exec(trimmed);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || !Number.isSafeInteger(patch)) {
    return null;
  }
  return {
    major,
    minor,
    patch,
    prerelease: match[4] ? match[4].split('.') : [],
    raw: trimmed,
  };
}

export function isValidVersion(input: string): boolean {
  return parseVersion(input) !== null;
}

function comparePrerelease(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    if (left === right) continue;

    const leftNumeric = /^\d+$/.test(left);
    const rightNumeric = /^\d+$/.test(right);
    if (leftNumeric && rightNumeric) {
      const diff = Number(left) - Number(right);
      if (diff !== 0) return diff < 0 ? -1 : 1;
      continue;
    }
    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return left < right ? -1 : 1;
  }
  return 0;
}

export function compareSemVer(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return comparePrerelease(a.prerelease, b.prerelease);
}

export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) throw new Error(`Versi tidak valid: ${!left ? a : b}`);
  return compareSemVer(left, right);
}

function fullVersion(major: number, minor: number, patch: number, prerelease: string[] = []): SemVer {
  return {
    major,
    minor,
    patch,
    prerelease,
    raw: `${major}.${minor}.${patch}${prerelease.length > 0 ? `-${prerelease.join('.')}` : ''}`,
  };
}

function parsePartial(input: string): PartialVersion | null {
  const trimmed = input.trim().replace(/^=/, '');
  if (trimmed === '' || trimmed === '*' || trimmed.toLowerCase() === 'x') {
    return { major: null, minor: null, patch: null, prerelease: [] };
  }
  const match = PARTIAL_PATTERN.exec(trimmed);
  if (!match) return null;

  const major = isWildcard(match[1]) ? null : Number(match[1]);
  const minor = isWildcard(match[2]) ? null : Number(match[2]);
  const patch = isWildcard(match[3]) ? null : Number(match[3]);
  if (
    (major !== null && !Number.isSafeInteger(major)) ||
    (minor !== null && !Number.isSafeInteger(minor)) ||
    (patch !== null && !Number.isSafeInteger(patch))
  ) {
    return null;
  }

  return {
    major,
    minor,
    patch,
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

function lower(partial: PartialVersion): SemVer {
  return fullVersion(partial.major ?? 0, partial.minor ?? 0, partial.patch ?? 0, partial.prerelease);
}

function comparator(operator: Operator, version: SemVer): Comparator {
  return { operator, version };
}

function compareToComparator(version: SemVer, item: Comparator): boolean {
  const comparison = compareSemVer(version, item.version);
  switch (item.operator) {
    case '>':
      return comparison > 0;
    case '>=':
      return comparison >= 0;
    case '<':
      return comparison < 0;
    case '<=':
      return comparison <= 0;
    case '=':
      return comparison === 0;
  }
}

function caretComparators(partial: PartialVersion): Comparator[] | null {
  if (partial.major === null) return [];
  const base = lower(partial);

  let upper: SemVer;
  if (partial.minor === null) {
    upper = fullVersion(partial.major + 1, 0, 0);
  } else if (partial.patch === null) {
    upper = partial.major > 0
      ? fullVersion(partial.major + 1, 0, 0)
      : fullVersion(0, partial.minor + 1, 0);
  } else if (partial.major > 0) {
    upper = fullVersion(partial.major + 1, 0, 0);
  } else if (partial.minor > 0) {
    upper = fullVersion(0, partial.minor + 1, 0);
  } else {
    upper = fullVersion(0, 0, partial.patch + 1);
  }

  return [comparator('>=', base), comparator('<', upper)];
}

function tildeComparators(partial: PartialVersion): Comparator[] | null {
  if (partial.major === null) return [];
  const base = lower(partial);
  let upper: SemVer;
  if (partial.minor === null) {
    upper = fullVersion(partial.major + 1, 0, 0);
  } else {
    upper = fullVersion(partial.major, partial.minor + 1, 0);
  }
  return [comparator('>=', base), comparator('<', upper)];
}

function bareComparators(partial: PartialVersion): Comparator[] | null {
  if (partial.major === null) return [];
  if (partial.minor === null) {
    return [comparator('>=', fullVersion(partial.major, 0, 0)), comparator('<', fullVersion(partial.major + 1, 0, 0))];
  }
  if (partial.patch === null) {
    return [
      comparator('>=', fullVersion(partial.major, partial.minor, 0)),
      comparator('<', fullVersion(partial.major, partial.minor + 1, 0)),
    ];
  }
  return [comparator('=', lower(partial))];
}

function parseComparatorToken(token: string): Comparator[] | null {
  if (token === '' || token === '*' || token.toLowerCase() === 'x') return [];

  if (token.startsWith('^')) {
    const partial = parsePartial(token.slice(1));
    return partial ? caretComparators(partial) : null;
  }
  if (token.startsWith('~')) {
    const partial = parsePartial(token.slice(1));
    return partial ? tildeComparators(partial) : null;
  }

  const opMatch = /^(>=|<=|>|<|=)?(.*)$/.exec(token);
  if (!opMatch) return null;
  const operator = (opMatch[1] as Operator | undefined) ?? '=';
  const rest = opMatch[2] ?? '';
  const partial = parsePartial(rest);
  if (!partial) return null;

  if (partial.major === null) return [];
  if (operator === '=') return bareComparators(partial);

  const base = lower(partial);
  if (operator === '>') {
    if (partial.patch === null) {
      const nextMinor = partial.minor === null
        ? fullVersion(partial.major + 1, 0, 0)
        : fullVersion(partial.major, partial.minor + 1, 0);
      return [comparator('>=', nextMinor)];
    }
    return [comparator('>', base)];
  }
  return [comparator(operator, base)];
}

function hyphenComparators(leftToken: string, rightToken: string): Comparator[] | null {
  const left = parsePartial(leftToken);
  const right = parsePartial(rightToken);
  if (!left || !right || left.major === null || right.major === null) return null;

  const result: Comparator[] = [comparator('>=', lower(left))];
  if (right.patch === null) {
    const upper = right.minor === null
      ? fullVersion(right.major + 1, 0, 0)
      : fullVersion(right.major, right.minor + 1, 0);
    result.push(comparator('<', upper));
  } else {
    result.push(comparator('<=', lower(right)));
  }
  return result;
}

function parseComparatorSet(input: string): ComparatorSet | null {
  const trimmed = input.trim();
  if (trimmed === '') return [];

  const hyphen = /^(.+?)\s+-\s+(.+)$/.exec(trimmed);
  if (hyphen?.[1] && hyphen[2]) {
    return hyphenComparators(hyphen[1], hyphen[2]);
  }

  const tokens = trimmed.split(/\s+/);
  const comparators: Comparator[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    let token = tokens[index] ?? '';
    if (/^(>=|<=|>|<|=|\^|~)$/.test(token)) {
      const next = tokens[index + 1];
      if (!next) return null;
      token += next;
      index += 1;
    }
    const parsed = parseComparatorToken(token);
    if (!parsed) return null;
    comparators.push(...parsed);
  }
  return comparators;
}

export function parseRange(range: string): ComparatorSet[] | null {
  const trimmed = range.trim();
  if (trimmed === '') return [[]];
  const parts = trimmed.split('||');
  const sets: ComparatorSet[] = [];
  for (const part of parts) {
    const set = parseComparatorSet(part);
    if (!set) return null;
    sets.push(set);
  }
  return sets;
}

function satisfiesSet(version: SemVer, comparators: ComparatorSet): boolean {
  for (const item of comparators) {
    if (!compareToComparator(version, item)) return false;
  }

  if (version.prerelease.length > 0) {
    return comparators.some(
      (item) =>
        item.version.prerelease.length > 0 &&
        item.version.major === version.major &&
        item.version.minor === version.minor &&
        item.version.patch === version.patch,
    );
  }
  return true;
}

export function satisfies(version: string, range: string): boolean {
  const parsedVersion = parseVersion(version);
  const parsedRange = parseRange(range);
  if (!parsedVersion || !parsedRange) return false;
  return parsedRange.some((set) => satisfiesSet(parsedVersion, set));
}

export function maxSatisfying(versions: Iterable<string>, range: string): string | null {
  const parsedRange = parseRange(range);
  if (!parsedRange) return null;

  let best: SemVer | null = null;
  for (const candidate of versions) {
    const parsed = parseVersion(candidate);
    if (!parsed) continue;
    if (!parsedRange.some((set) => satisfiesSet(parsed, set))) continue;
    if (!best || compareSemVer(parsed, best) > 0) best = parsed;
  }
  return best?.raw ?? null;
}
