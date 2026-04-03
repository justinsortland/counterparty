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

  // Missing docs — normalize for comparison, keep original strings for display
  const prevDocsNorm = new Map(previous.missingDocs.map((d) => [normalizeStr(d), d]));
  const latestDocsNorm = new Map(latest.missingDocs.map((d) => [normalizeStr(d), d]));

  const docsResolved = previous.missingDocs.filter((d) => !latestDocsNorm.has(normalizeStr(d)));
  const docsAdded = latest.missingDocs.filter((d) => !prevDocsNorm.has(normalizeStr(d)));

  const hasChanges =
    resolved.length > 0 ||
    introduced.length > 0 ||
    docsResolved.length > 0 ||
    docsAdded.length > 0;

  return { resolved, persisted, introduced, docsResolved, docsAdded, hasChanges };
}
