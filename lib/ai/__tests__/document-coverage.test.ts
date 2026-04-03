import { describe, it, expect } from "vitest";
import { computeCoverage, BUNDLE_IMPLIES } from "../document-coverage";

// Exact bundle keys and their first implied subdoc — sourced from BUNDLE_IMPLIES
// so tests remain coupled to the real mapping, not duplicated strings.
const FULL_PLAN_SET = "Full architectural plan set (site, floor plans, elevations, sections)";
const FULL_PLAN_SET_IMPLIED = BUNDLE_IMPLIES[FULL_PLAN_SET];

const TRADES_BUNDLE = "Electrical, plumbing, and mechanical plans or deferred submittal letters";
const TRADES_BUNDLE_IMPLIED = BUNDLE_IMPLIES[TRADES_BUNDLE];

function artifact(documentLabel: string | null = null) {
  return { fileName: "file.pdf", mimeType: "application/pdf", sizeBytes: 1024, documentLabel };
}

// ---------------------------------------------------------------------------

describe("computeCoverage — exact-match coverage", () => {
  it("puts a required doc in covered when an artifact carries its exact label", () => {
    const result = computeCoverage(
      ["Floor plans with dimensions and room labels"],
      [artifact("Floor plans with dimensions and room labels")]
    );
    expect(result.covered).toContain("Floor plans with dimensions and room labels");
    expect(result.uncovered).not.toContain("Floor plans with dimensions and room labels");
    expect(result.likelyCovered.map((lc) => lc.docLabel)).not.toContain(
      "Floor plans with dimensions and room labels"
    );
  });
});

describe("computeCoverage — bundle-implied coverage", () => {
  it("populates likelyCovered when a bundle label is attached", () => {
    const result = computeCoverage(
      [FULL_PLAN_SET, "Soils or geotechnical report"],
      [artifact(FULL_PLAN_SET)]
    );
    const likelyCoveredLabels = result.likelyCovered.map((lc) => lc.docLabel);
    for (const implied of FULL_PLAN_SET_IMPLIED) {
      expect(likelyCoveredLabels).toContain(implied);
    }
  });

  it("records the correct impliedBy source on each likelyCovered entry", () => {
    const result = computeCoverage([FULL_PLAN_SET], [artifact(FULL_PLAN_SET)]);
    for (const lc of result.likelyCovered) {
      expect(lc.impliedBy).toContain(FULL_PLAN_SET);
    }
  });

  it("one bundle implying multiple narrower docs produces one entry per implied doc", () => {
    const result = computeCoverage([TRADES_BUNDLE], [artifact(TRADES_BUNDLE)]);
    const likelyCoveredLabels = result.likelyCovered.map((lc) => lc.docLabel);
    for (const implied of TRADES_BUNDLE_IMPLIED) {
      expect(likelyCoveredLabels).toContain(implied);
    }
    expect(result.likelyCovered).toHaveLength(TRADES_BUNDLE_IMPLIED.length);
  });
});

describe("computeCoverage — truly uncovered docs", () => {
  it("leaves required docs in uncovered when no artifact matches and no bundle implies them", () => {
    const result = computeCoverage(
      ["Soils or geotechnical report", "Energy compliance forms"],
      [] // no artifacts
    );
    expect(result.uncovered).toContain("Soils or geotechnical report");
    expect(result.uncovered).toContain("Energy compliance forms");
    expect(result.covered).toHaveLength(0);
    expect(result.likelyCovered).toHaveLength(0);
  });

  it("does not flag a required doc as uncovered when a bundle implies it", () => {
    // Hypothetical: if a profile had FULL_PLAN_SET_IMPLIED[0] as a required doc
    const impliedDoc = FULL_PLAN_SET_IMPLIED[0];
    const result = computeCoverage(
      [FULL_PLAN_SET, impliedDoc],
      [artifact(FULL_PLAN_SET)]
    );
    expect(result.uncovered).not.toContain(impliedDoc);
    expect(result.likelyCovered.map((lc) => lc.docLabel)).toContain(impliedDoc);
  });
});

describe("computeCoverage — unlabeled attachments", () => {
  it("does not count an unlabeled artifact as coverage for any required doc", () => {
    const result = computeCoverage(
      ["Site plan showing property lines and structure locations"],
      [artifact(null)] // no label
    );
    expect(result.covered).toHaveLength(0);
    expect(result.likelyCovered).toHaveLength(0);
    expect(result.uncovered).toContain("Site plan showing property lines and structure locations");
  });

  it("puts unlabeled artifacts into the unlabeled list", () => {
    const a = artifact(null);
    const result = computeCoverage([], [a]);
    expect(result.unlabeled).toContain(a);
    expect(result.labeled).not.toContain(a);
  });
});

describe("computeCoverage — narrow doc directly attached stays confirmed", () => {
  it("a subdoc with its own direct label is covered, not merely likelyCovered", () => {
    const narrowDoc = FULL_PLAN_SET_IMPLIED[0]; // e.g. "Site plan drawn to scale..."
    const result = computeCoverage(
      [FULL_PLAN_SET, narrowDoc],
      [
        artifact(FULL_PLAN_SET),
        artifact(narrowDoc), // also directly labeled
      ]
    );
    expect(result.covered).toContain(narrowDoc);
    // Must NOT appear in likelyCovered since it is already confirmed
    expect(result.likelyCovered.map((lc) => lc.docLabel)).not.toContain(narrowDoc);
  });
});
