/**
 * Penyusunan findings dasar dari hasil OSV (PRD FR-06/FR-12).
 *
 * Satu finding per pasangan paket+advisory. Alias GHSA/CVE dinormalisasi lewat
 * `normalizeAdvisoryAliases`. Tahap sinkron ini diukur dengan `timed` agar
 * wall time-nya dapat dipakai sebagai batas atas CPU pada `T-W1-12d`.
 */

import type { ParsedPackage } from './lib/dedupe.ts';
import { normalizeAdvisoryAliases } from './lib/severity.ts';
import { createStageTimings, timed, type StageTimings } from './lib/timing.ts';
import type { OsvAdvisoryDetail, OsvEnrichmentResult, OsvPackageVulns } from './osv.ts';

export interface BaseFinding {
  findingKey: string;
  osvId: string;
  cveIds: string[];
  ghsaIds: string[];
  packageName: string;
  installedVersion: string;
  direct: boolean;
  devOnly: boolean;
  parentPackage: string | null;
}

export function findingKey(osvId: string, packageName: string, version: string): string {
  return `${osvId}|${packageName}@${version}`;
}

/**
 * Fungsi murni: gabungkan advisory per paket dengan metadata paket hasil
 * parser. Advisory tanpa detail tetap menghasilkan finding dengan ID OSV saja;
 * warning parsial ditangani pemanggil.
 */
export function buildBaseFindings(
  packages: readonly ParsedPackage[],
  packageResults: readonly OsvPackageVulns[],
  advisories: Readonly<Record<string, OsvAdvisoryDetail>>,
): BaseFinding[] {
  const packageByKey = new Map<string, ParsedPackage>();
  for (const entry of packages) {
    packageByKey.set(`${entry.name}@${entry.version}`, entry);
  }

  const findings: BaseFinding[] = [];
  const seen = new Set<string>();

  for (const result of packageResults) {
    const metadata = packageByKey.get(`${result.name}@${result.version}`);
    for (const vuln of result.vulns) {
      const key = findingKey(vuln.id, result.name, result.version);
      if (seen.has(key)) continue;
      seen.add(key);

      const detail = advisories[vuln.id];
      const aliases = normalizeAdvisoryAliases(
        detail ?? { id: vuln.id, aliases: [] },
      );

      findings.push({
        findingKey: key,
        osvId: vuln.id,
        cveIds: aliases.cveIds,
        ghsaIds: aliases.ghsaIds,
        packageName: result.name,
        installedVersion: result.version,
        direct: metadata?.direct ?? false,
        devOnly: metadata?.devOnly ?? false,
        parentPackage: metadata?.parentPackage ?? null,
      });
    }
  }

  findings.sort((a, b) => {
    if (a.packageName !== b.packageName) return a.packageName < b.packageName ? -1 : 1;
    if (a.installedVersion !== b.installedVersion) {
      return a.installedVersion < b.installedVersion ? -1 : 1;
    }
    return a.osvId < b.osvId ? -1 : a.osvId > b.osvId ? 1 : 0;
  });

  return findings;
}

export interface AssembleFindingsInput {
  packages: readonly ParsedPackage[];
  enrichment: OsvEnrichmentResult;
  timings?: StageTimings;
}

export async function assembleBaseFindings(
  input: AssembleFindingsInput,
): Promise<{ findings: BaseFinding[]; timings: StageTimings }> {
  const timings = input.timings ?? createStageTimings();
  const findings = await timed(timings, 'findings.assembly', () =>
    buildBaseFindings(input.packages, input.enrichment.packageResults, input.enrichment.advisories),
  );
  return { findings, timings };
}
