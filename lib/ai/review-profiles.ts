import type { PermitType, ProjectType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

export type ReviewProfile = {
  id: string;
  displayName: string;
  reviewerGuidance: string;
  requiredDocuments: string[];
  focusAreas: string[];
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const PROFILES = {
  adu: {
    id: "building-adu",
    displayName: "ADU Building Permit",
    reviewerGuidance:
      "Verify compliance with state ADU preemption provisions: setback reductions, height allowances, and owner-occupancy rules where applicable. Check fire separation from the main dwelling, independent utility service capacity, and energy compliance. Attached or conversion ADUs have different requirements than detached new construction — note which type applies.",
    requiredDocuments: [
      "Dimensioned site plan showing property lines, setbacks, and both structures",
      "Floor plans with dimensions and room labels",
      "Elevations for all sides",
      "Energy compliance forms (Title 24 or local equivalent)",
      "Structural calculations or prescriptive compliance worksheet",
      "Electrical single-line diagram",
      "Utility service capacity documentation",
    ],
    focusAreas: [
      "Setback compliance",
      "Fire separation from main dwelling",
      "Utility service capacity",
      "Energy compliance",
      "Structural adequacy",
      "Egress and light/ventilation",
    ],
  },

  newConstruction: {
    id: "building-new-construction",
    displayName: "New Construction Building Permit",
    reviewerGuidance:
      "A full plan set is required. Verify soils report, foundation design, structural system, fire protection, egress, and energy compliance. Confirm all trades (electrical, plumbing, mechanical) are addressed in the submittal or covered by separate deferred permits.",
    requiredDocuments: [
      "Full architectural plan set (site, floor plans, elevations, sections)",
      "Structural drawings and calculations",
      "Soils or geotechnical report",
      "Energy compliance forms",
      "Grading and drainage plan",
      "Electrical, plumbing, and mechanical plans or deferred submittal letters",
    ],
    focusAreas: [
      "Setbacks and lot coverage",
      "Structural system",
      "Fire protection and egress",
      "Energy compliance",
      "Foundation design",
      "Utility connections",
    ],
  },

  remodel: {
    id: "building-remodel-addition",
    displayName: "Building Permit — Residential Remodel / Addition",
    reviewerGuidance:
      "Check whether structural elements are affected, egress meets current code, and that electrical and plumbing changes are captured in the submittal. For additions, verify the work does not create new non-conforming setback conditions. For kitchen and bath remodels, confirm GFCI, ventilation, and exhaust requirements.",
    requiredDocuments: [
      "Floor plan showing existing and proposed layout with dimensions",
      "Elevations (if exterior changes are involved)",
      "Structural notes or calculations for load-bearing changes",
      "Electrical plan (if panel or circuit changes)",
      "Plumbing diagram (if fixture or line changes)",
    ],
    focusAreas: [
      "Structural changes",
      "Egress compliance",
      "GFCI and arc-fault protection",
      "Ventilation",
      "Setback compliance (for additions)",
    ],
  },

  electrical: {
    id: "electrical",
    displayName: "Electrical Permit",
    reviewerGuidance:
      "Focus on load calculations, service panel capacity, circuit routing, grounding, and NEC compliance. Verify smoke and CO detector locations if the panel serves habitable space. Arc-fault and ground-fault protection requirements vary by circuit location — note any gaps.",
    requiredDocuments: [
      "Single-line electrical diagram",
      "Panel schedule with load calculations",
      "Electrical plan showing circuit routing and device locations",
    ],
    focusAreas: [
      "Load capacity",
      "Arc-fault protection",
      "Ground-fault protection",
      "Panel clearances",
      "Grounding and bonding",
    ],
  },

  plumbing: {
    id: "plumbing",
    displayName: "Plumbing Permit",
    reviewerGuidance:
      "Check DWV sizing, trap and vent configuration, cleanout accessibility, backflow prevention, and water heater installation compliance. Verify that all new fixtures appear on the riser diagram and that the system adequately serves them.",
    requiredDocuments: [
      "Isometric or riser diagram",
      "Fixture schedule",
      "Cleanout location plan",
      "Water heater installation details",
    ],
    focusAreas: [
      "Trap and vent configuration",
      "DWV pipe sizing",
      "Backflow prevention",
      "Water heater installation",
      "Cleanout access",
    ],
  },

  mechanical: {
    id: "mechanical",
    displayName: "Mechanical (HVAC) Permit",
    reviewerGuidance:
      "Verify equipment specifications, Manual J load calculations, duct routing and insulation, combustion air provisions, and clearance requirements. Energy compliance (duct leakage, equipment efficiency ratings) is commonly flagged — confirm it is addressed.",
    requiredDocuments: [
      "Equipment specification sheets",
      "Duct layout plan",
      "Manual J heating and cooling load calculation",
      "Combustion air calculation (if gas appliances)",
    ],
    focusAreas: [
      "Equipment sizing",
      "Duct insulation requirements",
      "Combustion air provisions",
      "Equipment clearances",
      "Energy compliance",
    ],
  },

  zoning: {
    id: "zoning",
    displayName: "Zoning / Land Use Application",
    reviewerGuidance:
      "Verify use classification, lot coverage, setbacks, FAR, height limits, and parking requirements. Check for overlay districts, design review triggers, or neighborhood notification requirements. Confirm the proposed use is permitted by-right or note the entitlement path required.",
    requiredDocuments: [
      "Dimensioned site plan showing property lines and setbacks",
      "Floor area and lot coverage calculations",
      "Parking plan",
      "Neighborhood notification forms (if required)",
      "Survey or legal description",
    ],
    focusAreas: [
      "Use classification",
      "Setback compliance",
      "FAR and height limits",
      "Parking requirements",
      "Overlay district compliance",
    ],
  },

  grading: {
    id: "grading",
    displayName: "Grading and Drainage Permit",
    reviewerGuidance:
      "Check cut and fill volumes, erosion control measures, drainage patterns and retention sizing, and geotechnical report requirements. Verify that downstream drainage capacity is addressed and that retaining walls above the permit-exempt height are covered by structural design.",
    requiredDocuments: [
      "Grading plan with existing and proposed contours",
      "Drainage plan with flow calculations",
      "Erosion and sediment control plan",
      "Geotechnical or soils report (if required)",
    ],
    focusAreas: [
      "Erosion and sediment control",
      "Drainage calculations",
      "Cut and fill limits",
      "Geotechnical compliance",
      "Retaining wall design",
    ],
  },

  generic: {
    id: "generic",
    displayName: "General Building Review",
    reviewerGuidance:
      "Apply general residential building code standards. Verify site, structural, life safety, and basic zoning compliance. Note any permit-type-specific requirements that the applicant should address.",
    requiredDocuments: [
      "Site plan showing property lines and structure locations",
      "Floor plans with dimensions",
      "Elevations",
      "Structural notes or calculations",
    ],
    focusAreas: [
      "Code compliance",
      "Structural adequacy",
      "Life safety and egress",
      "Zoning and setback compliance",
    ],
  },
} as const satisfies Record<string, ReviewProfile>;

// ---------------------------------------------------------------------------
// Selector — typed against actual Prisma enums so mismatches are caught at
// compile time rather than silently falling through to the generic profile.
// ---------------------------------------------------------------------------

export function selectProfile(
  permitType: PermitType,
  projectType: ProjectType
): ReviewProfile {
  switch (permitType) {
    case "ELECTRICAL":
      return PROFILES.electrical;
    case "PLUMBING":
      return PROFILES.plumbing;
    case "MECHANICAL":
      return PROFILES.mechanical;
    case "ZONING":
      return PROFILES.zoning;
    case "GRADING":
      return PROFILES.grading;
    case "BUILDING":
      switch (projectType) {
        case "ADU":
          return PROFILES.adu;
        case "NEW_CONSTRUCTION":
          return PROFILES.newConstruction;
        case "REMODEL":
        case "ADDITION":
          return PROFILES.remodel;
        default:
          return PROFILES.generic;
      }
  }
}
