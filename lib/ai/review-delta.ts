import type { IssueSeverity } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeltaIssue = {
  severity: IssueSeverity;
  category: string;
  description: string;
  codeReference: string | null;
};

export type ReviewDelta = {
  resolved: DeltaIssue[];
  persisted: DeltaIssue[];
  introduced: DeltaIssue[];
  docsResolved: string[];
  docsAdded: string[];
  hasChanges: boolean;
};

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeStr(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function issueKey(i: DeltaIssue): string {
  return `${i.severity}|${normalizeStr(i.category)}|${normalizeStr(i.description)}|${i.codeReference ?? ""}`;
}

// ---------------------------------------------------------------------------
// Document family matching
// ---------------------------------------------------------------------------

const FAMILY_PATTERNS: { key: string; pattern: RegExp }[] = [
  { key: "site-plan",           pattern: /\bsite plan\b/ },
  { key: "floor-plan",          pattern: /\bfloor plan\b/ },
  { key: "electrical-plan",     pattern: /\belectrical plan\b/ },
  { key: "panel-schedule",      pattern: /\bpanel schedule\b/ },
  { key: "single-line-diagram", pattern: /\bsingle.?line diagram\b/ },
  { key: "structural-calc",     pattern: /\bstructural calc/ },
  { key: "plumbing-plan",       pattern: /\bplumbing plan\b/ },
  { key: "mechanical-plan",     pattern: /\bmechanical plan\b/ },
  { key: "energy-compliance",    pattern: /\benergy compliance\b/ },
  { key: "geotechnical-report",  pattern: /\b(soils|geotechnical)\b/ },
];

function docFamilyKey(s: string): string {
  const norm = normalizeStr(s);
  for (const { key, pattern } of FAMILY_PATTERNS) {
    if (pattern.test(norm)) return key;
  }
  return norm;
}

/**
 * Build a map from family key → longest (most specific) original string.
 * When multiple strings share a family, the longest one is the representative.
 */
function buildDocFamilyMap(docs: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of docs) {
    const key = docFamilyKey(d);
    const existing = map.get(key);
    if (!existing || d.length > existing.length) {
      map.set(key, d);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// computeDelta
// ---------------------------------------------------------------------------

export function computeDelta(
  latest: { issues: DeltaIssue[]; missingDocs: string[] },
  previous: { issues: DeltaIssue[]; missingDocs: string[] }
): ReviewDelta {
  // Issues
  const prevKeys = new Map(previous.issues.map((i) => [issueKey(i), i]));
  const latestKeys = new Map(latest.issues.map((i) => [issueKey(i), i]));

  const resolved: DeltaIssue[] = previous.issues.filter((i) => !latestKeys.has(issueKey(i)));
  const persisted: DeltaIssue[] = latest.issues.filter((i) => prevKeys.has(issueKey(i)));
  const introduced: DeltaIssue[] = latest.issues.filter((i) => !prevKeys.has(issueKey(i)));

  // Missing docs — family-aware matching, longest string as representative
  const prevFamilyMap = buildDocFamilyMap(previous.missingDocs);
  const latestFamilyMap = buildDocFamilyMap(latest.missingDocs);

  const docsResolved: string[] = [];
  for (const [key, repr] of prevFamilyMap) {
    if (!latestFamilyMap.has(key)) docsResolved.push(repr);
  }

  const docsAdded: string[] = [];
  for (const [key, repr] of latestFamilyMap) {
    if (!prevFamilyMap.has(key)) docsAdded.push(repr);
  }

  const hasChanges =
    resolved.length > 0 ||
    introduced.length > 0 ||
    docsResolved.length > 0 ||
    docsAdded.length > 0;

  return { resolved, persisted, introduced, docsResolved, docsAdded, hasChanges };
}
