import { describe, it, expect } from "vitest";
import type { DeltaIssue } from "../review-delta";
import { computeDelta } from "../review-delta";

function delta(latestDocs: string[], previousDocs: string[]) {
  return computeDelta(
    { issues: [], missingDocs: latestDocs },
    { issues: [], missingDocs: previousDocs },
  );
}

function issueDelta(latestIssues: DeltaIssue[], previousIssues: DeltaIssue[]) {
  return computeDelta(
    { issues: latestIssues, missingDocs: [] },
    { issues: previousIssues, missingDocs: [] },
  );
}

function issue(overrides: Partial<DeltaIssue> = {}): DeltaIssue {
  return {
    severity: "MAJOR",
    category: "Structural Documentation",
    description: "No structural calculations provided for load-bearing elements.",
    codeReference: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe("computeDelta — energy compliance family (regression)", () => {
  it("treats two energy-compliance phrasings as the same family — no false resolved/added", () => {
    // Exact strings from the reported bug
    const r = delta(
      ["Energy compliance forms (e.g., Title 24 or REScheck/COMcheck depending on occupancy)"],
      ["Energy compliance forms (e.g., Title 24 or REScheck)"],
    );
    expect(r.docsResolved).toHaveLength(0);
    expect(r.docsAdded).toHaveLength(0);
    expect(r.hasChanges).toBe(false);
  });

  it("uses the longer string as the representative when the family persists", () => {
    const longer = "Energy compliance forms (e.g., Title 24 or REScheck/COMcheck depending on occupancy)";
    const shorter = "Energy compliance forms (e.g., Title 24 or REScheck)";
    // If energy compliance is in both reviews, neither docsResolved nor docsAdded fires
    const r = delta([longer], [shorter]);
    expect(r.docsResolved).toHaveLength(0);
    expect(r.docsAdded).toHaveLength(0);
  });

  it("still surfaces energy compliance as resolved when it disappears from latest", () => {
    const r = delta(
      [], // no longer missing
      ["Energy compliance forms (e.g., Title 24 or REScheck)"],
    );
    expect(r.docsResolved).toHaveLength(1);
    expect(r.docsAdded).toHaveLength(0);
  });

  it("still surfaces energy compliance as added when it first appears in latest", () => {
    const r = delta(
      ["Energy compliance forms (e.g., Title 24 or REScheck/COMcheck depending on occupancy)"],
      [],
    );
    expect(r.docsResolved).toHaveLength(0);
    expect(r.docsAdded).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Issue delta — two-tier matching
// ---------------------------------------------------------------------------

describe("computeDelta — issue Tier 1: code reference + category", () => {
  it("matches when code references are identical after normalization (same wording)", () => {
    const prev = issue({ codeReference: "CBC Section 106.1.3" });
    const latest = issue({ codeReference: "CBC Section 106.1.3" });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("collapses code reference formatting variants via normalizeCodeReference", () => {
    // "CBC Section 106.1.3" and "CBC 106.1.3" normalize to the same string
    const prev = issue({ codeReference: "CBC Section 106.1.3" });
    const latest = issue({ codeReference: "CBC 106.1.3", description: "Structural calcs required per CBC 106.1.3." });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("matches across severity change when code reference agrees (Tier 1 ignores severity)", () => {
    const prev = issue({ severity: "MAJOR", codeReference: "CBC Section 106.1.3" });
    const latest = issue({ severity: "CRITICAL", codeReference: "CBC Section 106.1.3" });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });
});

describe("computeDelta — issue Tier 2: category + description core", () => {
  it("matches when description is the same and code references are both null", () => {
    const prev = issue({ codeReference: null });
    const latest = issue({ codeReference: null });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("matches when descriptions share an 80-char prefix (trailing detail added)", () => {
    const base = "No structural calculations provided for load-bearing elements.";
    const prev = issue({ description: base, codeReference: null });
    const latest = issue({
      description: base + " Engineer stamp and wet-signed drawings required per CBC.",
      codeReference: null,
    });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("matches when latest has no code reference but previous has one (Tier 2 fires, no conflict)", () => {
    const prev = issue({ codeReference: "CBC Section 106.1.3" });
    const latest = issue({ codeReference: null });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("matches across severity change when no code refs are present", () => {
    const prev = issue({ severity: "MAJOR", codeReference: null });
    const latest = issue({ severity: "CRITICAL", codeReference: null });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
  });
});

describe("computeDelta — Tier 2 guard: unclassified issues with cross-body refs do not merge", () => {
  // The guard only fires for issues whose category AND description do not match any
  // CATEGORY_FAMILIES pattern (i.e. the topic key is the exact normalized category string).
  // Use a category that intentionally avoids all family keywords.

  it("does NOT merge unclassified issues with genuinely different descriptions and cross-body code refs", () => {
    // Fire-separation (IBC 420.2) vs egress-corridor-width (CBC 708.1): different
    // requirements, different descriptions, different code bodies — must not collapse.
    const prev = issue({
      category: "Fire Separation",
      codeReference: "IBC Section 420.2",
      description:
        "Occupancy separation between Group A-2 assembly and Group S-2 storage lacks the required two-hour fire-resistive construction.",
    });
    const latest = issue({
      category: "Fire Separation",
      codeReference: "CBC Section 708.1",
      description:
        "Exit corridor width is insufficient for the occupant load; minimum 44-inch clear width is required at all points.",
    });
    const r = issueDelta([latest], [prev]);
    expect(r.resolved).toHaveLength(1);
    expect(r.introduced).toHaveLength(1);
    expect(r.persisted).toHaveLength(0);
  });
});

describe("computeDelta — true positives preserved", () => {
  it("genuinely resolved issue (present in previous, absent in latest) shows as resolved", () => {
    const r = issueDelta(
      [],
      [issue({ description: "No egress window provided.", codeReference: "IRC R310.1" })],
    );
    expect(r.resolved).toHaveLength(1);
    expect(r.introduced).toHaveLength(0);
  });

  it("genuinely new issue (absent in previous, present in latest) shows as introduced", () => {
    const r = issueDelta(
      [issue({ description: "No egress window provided.", codeReference: "IRC R310.1" })],
      [],
    );
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(1);
  });

  it("two distinct issues in the same category are not merged when descriptions differ", () => {
    // Genuinely different egress issues — unrelated token sets → overlap < k
    const egress1 = issue({ category: "Egress", description: "Bedroom window sill height does not meet minimum requirements per IRC R310.2.1.", codeReference: null });
    const egress2 = issue({ category: "Egress", description: "The garage exit path is blocked and does not provide a clear egress route to the exterior.", codeReference: null });
    const r = issueDelta([egress1], [egress2]);
    expect(r.resolved).toHaveLength(1);
    expect(r.introduced).toHaveLength(1);
    expect(r.persisted).toHaveLength(0);
  });
});

describe("computeDelta — existing family patterns unaffected", () => {
  it("site plan variants still collapse", () => {
    const r = delta(
      ["Site plan showing property lines, setbacks, and structure locations"],
      ["Site plan drawn to scale showing property lines and setbacks"],
    );
    expect(r.docsResolved).toHaveLength(0);
    expect(r.docsAdded).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Category-family matching — regression from real submission
// Each test covers one failed pair: same issue, category label drifted between
// reviewer calls. Descriptions are identical here so the focus is on the
// category-family gate; token-overlap is exercised separately below.
// ---------------------------------------------------------------------------

describe("computeDelta — category-family matching (regression)", () => {
  it("matches 'Structural Documentation' to 'Structural' via family key", () => {
    const prev = issue({ category: "Structural Documentation", codeReference: "IBC 1603.1" });
    const latest = issue({ category: "Structural", codeReference: null });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("matches 'Geotechnical' to 'Foundation / Geotechnical' via family key", () => {
    const prev = issue({ category: "Geotechnical", codeReference: "IBC 1803.1" });
    const latest = issue({ category: "Foundation / Geotechnical", codeReference: null });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("matches 'MEP Documentation' to 'MEP Systems' via family key", () => {
    const prev = issue({ category: "MEP Documentation", codeReference: "IBC 107.3.4" });
    const latest = issue({ category: "MEP Systems", codeReference: null });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("matches 'Construction Type and Occupancy' to 'Occupancy and Construction Type' via family key", () => {
    const prev = issue({ category: "Construction Type and Occupancy", codeReference: "IBC 107.2.1" });
    const latest = issue({ category: "Occupancy and Construction Type", codeReference: null });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("matches 'Scope of Work' to 'Application Completeness' via family key", () => {
    const prev = issue({ category: "Scope of Work", codeReference: null });
    const latest = issue({ category: "Application Completeness", codeReference: null });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("matches 'Jurisdiction and Project Identity' to 'Application Completeness' via family key", () => {
    const prev = issue({ category: "Jurisdiction and Project Identity", codeReference: null });
    const latest = issue({ category: "Application Completeness", codeReference: null });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Token-overlap matching — description paraphrase
// ---------------------------------------------------------------------------

describe("computeDelta — Tier 2 token overlap", () => {
  it("matches same-category issues whose descriptions are paraphrased (word-order change)", () => {
    // Simulates Plan Set Sufficiency: same topic, positional prefix diverges early
    const prev = issue({
      category: "Plan Set Sufficiency",
      codeReference: "IBC 107.2",
      description: "The architectural plan set is confirmed attached but lacks stamped structural drawings.",
    });
    const latest = issue({
      category: "Plan Set Sufficiency",
      codeReference: null,
      description: "The attached architectural plan set is incomplete; stamped structural drawings are missing.",
    });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("punctuation attached to tokens does not prevent matching ('set,' matches 'set')", () => {
    // Regression: descriptions with trailing commas/periods in tokens were producing
    // fewer than k=4 shared tokens even when descriptions were clearly the same topic.
    const prev = issue({
      category: "Architectural Plan Set — Sufficiency Uncertain",
      codeReference: "IBC 107.2",
      description:
        "While a full architectural plan set is confirmed attached, the scope of work is undefined, making it impossible to verify plan sufficiency.",
    });
    const latest = issue({
      category: "Site Plan Sufficiency",
      codeReference: "IBC Section 107.2.5",
      description:
        "While a site plan is implied by the attached architectural plan set, its adequacy cannot be confirmed without a defined scope.",
    });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("does NOT merge two distinct 'Application Completeness' issues whose descriptions differ", () => {
    const ac1 = issue({
      category: "Application Completeness",
      codeReference: null,
      description: "The project scope does not specify the total floor area or square footage of the proposed addition.",
    });
    const ac2 = issue({
      category: "Application Completeness",
      codeReference: null,
      description: "The jurisdiction permit number and parcel identification are absent from the application cover sheet.",
    });
    const r = issueDelta([ac1], [ac2]);
    expect(r.resolved).toHaveLength(1);
    expect(r.introduced).toHaveLength(1);
    expect(r.persisted).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Category-family expansion — compound category names (regression)
// Real data: Rev1 uses verbose "Base — Qualifier" names; Rev2 uses short names.
// Each test uses the exact category strings observed in the failing submission.
// ---------------------------------------------------------------------------

describe("computeDelta — category-family expansion: compound names (regression)", () => {
  it("matches 'Energy Compliance — Missing Forms' to 'Energy Compliance' (Tier 1 via same IECC ref)", () => {
    const prev = issue({ category: "Energy Compliance — Missing Forms", codeReference: "IECC R103.2" });
    const latest = issue({ category: "Energy Compliance", codeReference: "IECC Section R103.2" });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("matches 'Grading and Drainage — Missing Plan' to 'Grading and Drainage' (Tier 2 via same IBC body)", () => {
    const prev = issue({ category: "Grading and Drainage — Missing Plan", codeReference: "IBC 1804.4" });
    const latest = issue({ category: "Grading and Drainage", codeReference: "IBC Section 107.2.5" });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("matches 'Trades — Missing Electrical…' to 'Mechanical / Electrical / Plumbing' (Tier 1 via same IBC ref)", () => {
    const prev = issue({
      category: "Trades — Missing Electrical, Plumbing, and Mechanical Plans or Deferred Submittal Letters",
      codeReference: "IBC 107.3.4",
    });
    const latest = issue({ category: "Mechanical / Electrical / Plumbing", codeReference: "IBC Section 107.3.4" });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("matches 'Architectural Plan Set — Sufficiency Uncertain' to 'Site Plan Sufficiency' (Tier 2 via plan-set family + token overlap)", () => {
    const prev = issue({
      category: "Architectural Plan Set — Sufficiency Uncertain",
      codeReference: "IBC 107.2",
      description:
        "While a full architectural plan set is confirmed attached, the scope of work is undefined, making it impossible to verify plan sufficiency.",
    });
    const latest = issue({
      category: "Site Plan Sufficiency",
      codeReference: "IBC Section 107.2.5",
      description:
        "While a site plan is implied by the attached architectural plan set, its adequacy cannot be confirmed without a defined scope.",
    });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("does NOT merge a single-trade category into the mep family (only 1 of mechanical/electrical/plumbing)", () => {
    // "Electrical Panel Location" contains only "electrical" — 1/3, no "mep" or "trades"
    // — must not be grouped with the broad MEP/trades family.
    const prev = issue({ category: "Electrical Panel Location", codeReference: null });
    const latest = issue({ category: "Mechanical / Electrical / Plumbing", codeReference: null });
    const r = issueDelta([latest], [prev]);
    expect(r.resolved).toHaveLength(1);
    expect(r.introduced).toHaveLength(1);
    expect(r.persisted).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tier 2 guard relaxed to code-body level
// ---------------------------------------------------------------------------

describe("computeDelta — Tier 2 guard at code-body level", () => {
  it("matches when both sides cite different subsections of the same code body (IBC 1603.1 vs IBC 107.2.1)", () => {
    // Simulates Structural Documentation: model cited IBC 1603.1 in Rev1, IBC 107.2.1 in Rev2.
    // Old guard blocked Tier 2; new guard passes because both bodies are "ibc".
    const prev = issue({ codeReference: "IBC 1603.1" });
    const latest = issue({ codeReference: "IBC Section 107.2.1" });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// issueTopicKey — description fallback for category classification
// ---------------------------------------------------------------------------

describe("computeDelta — issueTopicKey: description fallback (regression)", () => {
  it("matches 'Missing Soils Report' to 'Foundation / Geotechnical' via description keywords", () => {
    // "Missing Soils Report" has no 'geotechnical'/'foundation' in the category name.
    // The description contains both keywords so issueTopicKey classifies it correctly.
    const prev = issue({
      category: "Missing Soils Report",
      codeReference: "IBC 1803.2",
      description:
        "No geotechnical or soils report has been submitted. A soils investigation is required for new construction to establish allowable bearing capacity and foundation design parameters.",
    });
    const latest = issue({
      category: "Foundation / Geotechnical",
      codeReference: "CBC Section 1803.1",
      description:
        "No soils or geotechnical report has been submitted. New construction requires a geotechnical investigation to establish allowable bearing capacity and foundation design parameters.",
    });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("matches 'Grading and Drainage' IBC→CBC via classified topic (guard disabled)", () => {
    // Same category name, only the code body changed between reviews.
    // Both sides are classified (grading-drainage family) so the guard is disabled.
    const prev = issue({
      category: "Grading and Drainage",
      codeReference: "IBC 1804.4",
      description:
        "No grading or drainage plan has been submitted. New construction requires a grading plan showing existing and proposed grades, drainage patterns, and stormwater management.",
    });
    const latest = issue({
      category: "Grading and Drainage",
      codeReference: "CBC Section 107.2.5",
      description:
        "No grading and drainage plan has been submitted. New construction must demonstrate positive drainage away from the structure and compliance with local stormwater requirements.",
    });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("matches 'No Documents Submitted' to 'Missing Documents' via missing-docs family", () => {
    // Both are broad document-absence summaries. Without the missing-docs family entry,
    // the description fallback misclassifies them into different families (structural vs
    // plan-set) because their descriptions mention different incidental keywords.
    const prev = issue({
      category: "No Documents Submitted",
      codeReference: null,
      description:
        "No documents have been confirmed as attached to this application. New construction permits require a full set of architectural, structural, civil/grading, and MEP plans before review can proceed.",
    });
    const latest = issue({
      category: "Missing Documents",
      codeReference: null,
      description:
        "No documents have been confirmed as attached to this application. A new construction permit requires a full plan set including architectural drawings, structural calculations, energy compliance forms, and civil/grading plans.",
    });
    const r = issueDelta([latest], [prev]);
    expect(r.persisted).toHaveLength(1);
    expect(r.resolved).toHaveLength(0);
    expect(r.introduced).toHaveLength(0);
  });

  it("does NOT classify 'Missing Structural Documents' as missing-docs family", () => {
    // "Missing Structural Documents" contains "structural" and matches the structural
    // family first, before the missing-docs pattern can fire. It must NOT be merged
    // with a broad "No Documents Submitted" issue.
    const prev = issue({
      category: "No Documents Submitted",
      codeReference: null,
      description:
        "No documents have been confirmed as attached to this application. New construction permits require a full set of plans.",
    });
    const latest = issue({
      category: "Missing Structural Documents",
      codeReference: "CBC Section 1604.3",
      description:
        "Structural calculations and engineered drawings have not been submitted. Load-path analysis is required before approval.",
    });
    const r = issueDelta([latest], [prev]);
    expect(r.resolved).toHaveLength(1);
    expect(r.introduced).toHaveLength(1);
    expect(r.persisted).toHaveLength(0);
  });

  it("does NOT merge two classified issues in the same family when descriptions are genuinely different", () => {
    // Both structural issues, same IBC→CBC drift — but one is about missing drawings
    // and the other is about a specific load-path deficiency. Descriptions share
    // fewer than k=4 significant tokens, so they must stay separate.
    const prev = issue({
      category: "Structural",
      codeReference: "IBC Section 1604.3",
      description:
        "Load-bearing wall at the second floor was removed without an adequate replacement beam. The floor framing above is unsupported and the load path is interrupted.",
    });
    const latest = issue({
      category: "Structural",
      codeReference: "CBC Section 107.2.1",
      description:
        "No structural drawings or calculations have been submitted. Engineered documents demonstrating gravity and lateral compliance are required before the permit can be issued.",
    });
    const r = issueDelta([latest], [prev]);
    expect(r.resolved).toHaveLength(1);
    expect(r.introduced).toHaveLength(1);
    expect(r.persisted).toHaveLength(0);
  });
});
