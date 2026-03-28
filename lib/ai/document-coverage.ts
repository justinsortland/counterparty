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

export type DocumentCoverage = {
  /** Required documents matched by at least one labeled artifact */
  covered: string[];
  /** Required documents with no matching labeled artifact */
  uncovered: string[];
  /** Artifacts that carry a label */
  labeled: ArtifactForCoverage[];
  /** Artifacts without a label */
  unlabeled: ArtifactForCoverage[];
};

export function computeCoverage(
  requiredDocuments: string[],
  artifacts: ArtifactForCoverage[]
): DocumentCoverage {
  const covered = requiredDocuments.filter((doc) =>
    artifacts.some((a) => a.documentLabel === doc)
  );
  const uncovered = requiredDocuments.filter(
    (doc) => !artifacts.some((a) => a.documentLabel === doc)
  );
  const labeled = artifacts.filter((a) => !!a.documentLabel);
  const unlabeled = artifacts.filter((a) => !a.documentLabel);

  return { covered, uncovered, labeled, unlabeled };
}
