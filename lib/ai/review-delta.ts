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

function normalizeCodeReference(ref: string): string {
  return ref
    .toLowerCase()
    .replace(/\bsection\b/g, "") // "CBC Section 1030.2" → "cbc  1030.2"
    .replace(/§/g, "")           // "CBC § 106.1.3"      → "cbc  106.1.3"
    .replace(/,/g, "")           // "Title 24, Part 6"   → "title 24 part 6"
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts the leading alphabetic code body from a normalized code reference.
 * "ibc 1603.1" → "ibc", "iecc r103.2" → "iecc", "cbc 708.1" → "cbc".
 * Used to relax the Tier 2 guard so that same-code-body section drift
 * (e.g. IBC 1603.1 vs IBC 107.2.1) does not block description-overlap matching.
 */
function codeBodyOf(normalizedRef: string): string {
  return normalizedRef.match(/^[a-z]+/)?.[0] ?? "";
}

// ---------------------------------------------------------------------------
// Category-family matching
//
// Maps related category phrasings to a shared key so that category drift
// (e.g. "Structural Documentation" → "Structural") does not break Tier 2.
// Keep this list narrow: only families with concrete failing test coverage.
// ---------------------------------------------------------------------------

const CATEGORY_FAMILIES: { key: string; test: (norm: string) => boolean }[] = [
  // Broad document-absence summaries — matched by category name before description
  // fallback runs, preventing incidental keywords in the description from misclassifying
  // these issues into unrelated families (e.g. "structural", "plan-set").
  { key: "missing-docs",             test: (n) => /\b(no documents|missing documents)\b/.test(n) },
  { key: "structural",               test: (n) => /\bstructural\b/.test(n) },
  { key: "geotechnical",             test: (n) => /\b(geotechnical|foundation)\b/.test(n) },
  {
    key: "mep",
    // Match "mep" or "trades", OR ≥ 2 of {mechanical, electrical, plumbing}.
    // The two-of-three rule prevents a narrow single-trade category (e.g.
    // "Electrical Panel Location") from being merged into the broad MEP family.
    test: (n) =>
      /\b(mep|trades)\b/.test(n) ||
      [/\bmechanical\b/, /\belectrical\b/, /\bplumbing\b/].filter((p) => p.test(n)).length >= 2,
  },
  { key: "energy-compliance",        test: (n) => /\benergy compliance\b/.test(n) },
  { key: "grading-drainage",         test: (n) => /\bgrading\b/.test(n) },
  { key: "occupancy",                test: (n) => /\boccupancy\b/.test(n) },
  { key: "plan-set",                 test: (n) => /\b(plan set|plan sufficiency)\b/.test(n) },
  { key: "application-completeness", test: (n) => /\b(application|scope|jurisdiction)\b/.test(n) },
];

function categoryFamilyKey(cat: string): string {
  const norm = normalizeStr(cat);
  for (const { key, test } of CATEGORY_FAMILIES) {
    if (test(norm)) return key;
  }
  return norm;
}

// ---------------------------------------------------------------------------
// Issue matching — two-tier
//
// Issue lists are typically 3–10 items, so O(n²) linear scan is fine.
// Tier 2 uses token overlap rather than a positional prefix so that
// paraphrased descriptions (same topic, different word order) still match.
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "of", "in", "on",
  "at", "to", "for", "with", "by", "from", "as", "or", "and", "but",
  "not", "this", "that", "it", "its", "no", "any", "all", "if", "per",
  "nor", "only", "also", "both", "each",
]);

function significantTokens(s: string, n: number): string[] {
  return normalizeStr(s)
    .split(/\s+/)
    .map((w) => w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")) // strip leading/trailing punctuation
    .filter((w) => w.length > 0 && !STOPWORDS.has(w))
    .slice(0, n);
}

/**
 * Returns true when at least k of the first n significant tokens of a
 * appear in the first n significant tokens of b. Tolerates paraphrasing and
 * word-order changes while keeping unrelated descriptions apart.
 */
function descTokensOverlap(a: string, b: string, n = 10, k = 4): boolean {
  const setA = new Set(significantTokens(a, n));
  const setB = new Set(significantTokens(b, n));
  let shared = 0;
  for (const t of setA) {
    if (setB.has(t)) shared++;
  }
  return shared >= k;
}

/**
 * Returns the canonical topic key for an issue and whether it was classified
 * by a CATEGORY_FAMILIES pattern. Checks the category first, then falls back
 * to the description when the category contains no recognized keywords (e.g.
 * "Missing Soils Report" — the category has no "geotechnical"/"foundation"
 * keyword, but the description reliably contains them).
 *
 * classified=true  → a CATEGORY_FAMILIES pattern matched on category or description
 * classified=false → fell through to the exact normalized category string
 *
 * The boolean is returned separately so callers are not misled when the family
 * key happens to equal the normalized category string (e.g. category "Structural"
 * normalizes to "structural" which also happens to be the key — string comparison
 * alone cannot distinguish "matched" from "fell through").
 */
function issueTopicKey(issue: DeltaIssue): { key: string; classified: boolean } {
  const norm = normalizeStr(issue.category);
  for (const { key, test } of CATEGORY_FAMILIES) {
    if (test(norm)) return { key, classified: true };
  }
  // Category didn't match any pattern — try the description
  const normDesc = normalizeStr(issue.description);
  for (const { key, test } of CATEGORY_FAMILIES) {
    if (test(normDesc)) return { key, classified: true };
  }
  return { key: norm, classified: false }; // exact normalized category string
}

function issueHasMatchIn(issue: DeltaIssue, candidates: DeltaIssue[]): boolean {
  const { key: topicKey, classified: isClassified } = issueTopicKey(issue);
  // When classified, description token overlap is the sole guard against
  // over-merging — the code-body guard is disabled so that IBC↔CBC model
  // variance does not produce false churn for well-known missing-document issues.
  const normCodeRef = issue.codeReference
    ? normalizeCodeReference(issue.codeReference)
    : null;

  for (const candidate of candidates) {
    if (issueTopicKey(candidate).key !== topicKey) continue;

    // Tier 1: topic key + normalized code reference — fires when both sides
    // carry the same non-null code reference.
    if (normCodeRef && candidate.codeReference) {
      if (normCodeRef === normalizeCodeReference(candidate.codeReference)) return true;
    }

    // Tier 2: topic key + description token overlap.
    // Guard: only enforce for unclassified issues (exact category string) where
    // conflicting code bodies (IBC vs CBC) signal genuinely different requirements.
    // For classified issues, K=4 token overlap is sufficient.
    const bothHaveRefs = normCodeRef !== null && candidate.codeReference !== null;
    const refsConflict =
      !isClassified &&
      bothHaveRefs &&
      codeBodyOf(normCodeRef!) !== codeBodyOf(normalizeCodeReference(candidate.codeReference!));
    if (!refsConflict && descTokensOverlap(issue.description, candidate.description)) {
      return true;
    }
  }

  return false;
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
  const resolved: DeltaIssue[] = previous.issues.filter((i) => !issueHasMatchIn(i, latest.issues));
  const persisted: DeltaIssue[] = latest.issues.filter((i) => issueHasMatchIn(i, previous.issues));
  const introduced: DeltaIssue[] = latest.issues.filter((i) => !issueHasMatchIn(i, previous.issues));

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
