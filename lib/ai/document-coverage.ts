// ---------------------------------------------------------------------------
// Shared document-coverage helper
// Used by both the reviewer prompt builder and the submission detail UI
// so coverage logic cannot drift between the two.
// ---------------------------------------------------------------------------

export type ArtifactForCoverage = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  documentLabel?: string | null;
};

export type LikelyCoveredDoc = {
  /** The narrower subdocument description implied by a confirmed bundle */
  docLabel: string;
  /** Which confirmed artifact labels imply this subdocument */
  impliedBy: string[];
};

export type DocumentCoverage = {
  /** Required documents matched by at least one labeled artifact */
  covered: string[];
  /** Subdocuments implied by a confirmed bundle label — likely present, not individually confirmed */
  likelyCovered: LikelyCoveredDoc[];
  /** Required documents with no direct label match and no bundle implication */
  uncovered: string[];
  /** Artifacts that carry a label */
  labeled: ArtifactForCoverage[];
  /** Artifacts without a label */
  unlabeled: ArtifactForCoverage[];
};

// ---------------------------------------------------------------------------
// Bundle → subdocument mapping
//
// Keys MUST exactly match a value in profile.requiredDocuments so the user
// can actually select them as documentLabel values.
// Values are representative strings for each narrower subdocument; they appear
// in the reviewer prompt so the model understands what is likely present.
//
// Rules:
//   - Exact-match only. No fuzzy matching.
//   - Profile-specific — do not create cross-profile reuse.
//   - When a subdocument string also appears in requiredDocuments, direct
//     attachment always wins (confirmed, not merely likely).
// ---------------------------------------------------------------------------

export const BUNDLE_IMPLIES: Record<string, string[]> = {
  // building-new-construction
  "Full architectural plan set (site, floor plans, elevations, sections)": [
    "Site plan drawn to scale showing property lines, setbacks, and structure footprint",
    "Floor plan with dimensions, room labels, and door/window schedule",
    "Building elevations for all sides",
    "Building sections",
  ],
  "Electrical, plumbing, and mechanical plans or deferred submittal letters": [
    "Electrical plan showing panel, circuit routing, and device locations",
    "Plumbing plan or isometric diagram",
    "Mechanical (HVAC) plan or equipment layout",
  ],
};

// ---------------------------------------------------------------------------
// computeCoverage
// ---------------------------------------------------------------------------

export function computeCoverage(
  requiredDocuments: string[],
  artifacts: ArtifactForCoverage[]
): DocumentCoverage {
  // Exact-match coverage
  const coveredLabels = new Set(
    requiredDocuments.filter((doc) =>
      artifacts.some((a) => a.documentLabel === doc)
    )
  );
  const covered = [...coveredLabels];

  // Bundle-implied coverage — collect all subdocs implied by confirmed bundle labels,
  // skipping any that are already directly covered.
  const likelyCoveredMap = new Map<string, string[]>(); // docLabel -> impliedBy[]
  for (const artifact of artifacts) {
    if (!artifact.documentLabel) continue;
    const implies = BUNDLE_IMPLIES[artifact.documentLabel] ?? [];
    for (const subdoc of implies) {
      if (!coveredLabels.has(subdoc)) {
        const existing = likelyCoveredMap.get(subdoc) ?? [];
        if (!existing.includes(artifact.documentLabel)) {
          likelyCoveredMap.set(subdoc, [...existing, artifact.documentLabel]);
        }
      }
    }
  }
  const likelyCovered: LikelyCoveredDoc[] = Array.from(likelyCoveredMap.entries()).map(
    ([docLabel, impliedBy]) => ({ docLabel, impliedBy })
  );

  // For required docs that also appear in BUNDLE_IMPLIES values, remove them
  // from uncovered (they are accounted for via likelyCovered).
  const likelyCoveredLabels = new Set(likelyCovered.map((lc) => lc.docLabel));
  const uncovered = requiredDocuments.filter(
    (doc) => !coveredLabels.has(doc) && !likelyCoveredLabels.has(doc)
  );

  const labeled = artifacts.filter((a) => !!a.documentLabel);
  const unlabeled = artifacts.filter((a) => !a.documentLabel);

  return { covered, likelyCovered, uncovered, labeled, unlabeled };
}
