import { describe, it, expect } from "vitest";
import { computeDelta } from "../review-delta";

function delta(
  latestDocs: string[],
  previousDocs: string[],
) {
  return computeDelta(
    { issues: [], missingDocs: latestDocs },
    { issues: [], missingDocs: previousDocs },
  );
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
