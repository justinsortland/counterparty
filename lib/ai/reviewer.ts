import Anthropic from "@anthropic-ai/sdk";
import type { IssueSeverity, PermitType, ProjectType, ReviewVerdict } from "@prisma/client";
import type { ReviewProfile } from "./review-profiles";

// ---------------------------------------------------------------------------
// Provenance constants — bump PROMPT_VERSION whenever the prompt changes
// ---------------------------------------------------------------------------

export const REVIEW_MODEL = process.env.REVIEW_MODEL ?? "claude-sonnet-4-6";
export const PROMPT_VERSION = "v2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArtifactMeta = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  documentLabel?: string | null;
};

export type ReviewInput = {
  title: string;
  address: string;
  jurisdiction: string;
  permitType: PermitType;
  projectType: ProjectType;
  scopeOfWork: string;
  reviewContext: string | null;
  artifacts: ArtifactMeta[];
  profile: ReviewProfile;
};

export type ParsedIssue = {
  severity: IssueSeverity;
  category: string;
  description: string;
  codeReference: string | null;
};

export type ReviewResult = {
  verdict: ReviewVerdict;
  summary: string;
  missingDocs: string[];
  issues: ParsedIssue[];
  rawPayload: object;
};

// ---------------------------------------------------------------------------
// Label maps (used in prompt — not for display)
// ---------------------------------------------------------------------------

const PERMIT_TYPE_LABELS: Record<PermitType, string> = {
  BUILDING: "building",
  ELECTRICAL: "electrical",
  PLUMBING: "plumbing",
  MECHANICAL: "mechanical (HVAC)",
  ZONING: "zoning / land use",
  GRADING: "grading / drainage",
};

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  REMODEL: "kitchen or bathroom remodel",
  ADDITION: "room addition",
  ADU: "accessory dwelling unit (ADU)",
  NEW_CONSTRUCTION: "new construction",
  DECK_PATIO: "deck or patio",
  FENCE_WALL: "fence or retaining wall",
  POOL: "pool or spa",
  DEMOLITION: "demolition",
  OTHER: "general construction project",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Validation sets
// ---------------------------------------------------------------------------

const VALID_VERDICTS = new Set<string>(["LIKELY_APPROVE", "CONDITIONAL", "LIKELY_REJECT"]);
const VALID_SEVERITIES = new Set<string>(["CRITICAL", "MAJOR", "MINOR"]);

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  jurisdiction: string,
  permitType: PermitType,
  profile: ReviewProfile
): string {
  return `You are an experienced residential building plan checker working for the ${jurisdiction} permitting department.

Your job is to review a ${PERMIT_TYPE_LABELS[permitType]} permit application and identify every issue a real plan checker would raise before approving it. Be thorough, realistic, and specific to the jurisdiction and permit type. Do not hedge — give direct, technical feedback a contractor or homeowner would receive at the permit counter.

Cite applicable code sections when you are confident (e.g. "CBC Section 1030.2", "IRC R302.1"). Only cite codes you know. Use null for codeReference if unsure — do not fabricate references.

Respond with a single JSON object only. No markdown. No prose before or after. Exactly this schema:

{
  "verdict": "LIKELY_APPROVE" | "CONDITIONAL" | "LIKELY_REJECT",
  "summary": "<1–3 sentence overall assessment>",
  "missingDocs": ["<document or item name>", ...],
  "issues": [
    {
      "severity": "CRITICAL" | "MAJOR" | "MINOR",
      "category": "<short label, e.g. Egress, Setback, Fire Separation>",
      "description": "<what the issue is and why it matters>",
      "codeReference": "<code section string or null>"
    }
  ]
}

Severity definitions:
- CRITICAL: causes automatic rejection; must be resolved before any approval
- MAJOR: requires revision or clarification letter; likely to delay approval
- MINOR: informational; may require acknowledgment but unlikely to block

Verdict logic (apply strictly):
- LIKELY_APPROVE: no CRITICAL or MAJOR issues
- CONDITIONAL: one or more MAJOR issues, no CRITICAL
- LIKELY_REJECT: one or more CRITICAL issues

REVIEW PROFILE: ${profile.displayName}
Focus areas: ${profile.focusAreas.join(" · ")}
${profile.reviewerGuidance}`;
}

function buildUserMessage(input: ReviewInput): string {
  const lines = [
    `PROJECT: ${input.title}`,
    `ADDRESS: ${input.address}`,
    `JURISDICTION: ${input.jurisdiction}`,
    `PERMIT TYPE: ${PERMIT_TYPE_LABELS[input.permitType]}`,
    `PROJECT TYPE: ${PROJECT_TYPE_LABELS[input.projectType]}`,
    ``,
    `SCOPE OF WORK:`,
    input.scopeOfWork,
  ];

  if (input.reviewContext) {
    lines.push(``, `ADDITIONAL CONTEXT FROM APPLICANT:`, input.reviewContext);
  }

  lines.push(``, `TYPICAL REQUIRED DOCUMENTS FOR THIS PERMIT TYPE:`);
  for (const doc of input.profile.requiredDocuments) {
    lines.push(`- ${doc}`);
  }

  lines.push(``);
  if (input.artifacts.length > 0) {
    lines.push(`ATTACHED DOCUMENTS:`);
    for (const a of input.artifacts) {
      const label = a.documentLabel ? ` [${a.documentLabel}]` : "";
      lines.push(`- ${a.fileName}${label} (${a.mimeType}, ${formatBytes(a.sizeBytes)})`);
    }
  } else {
    lines.push(`ATTACHED DOCUMENTS: None`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Parse and validate
// ---------------------------------------------------------------------------

function validateAndNormalize(raw: unknown): ReviewResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Review parsing failed: response is not an object");
  }

  const r = raw as Record<string, unknown>;

  if (!VALID_VERDICTS.has(r.verdict as string)) {
    throw new Error(`Review parsing failed: invalid verdict "${r.verdict}"`);
  }

  if (typeof r.summary !== "string" || !r.summary) {
    throw new Error("Review parsing failed: missing or empty summary");
  }

  const missingDocs = Array.isArray(r.missingDocs)
    ? r.missingDocs.filter((d): d is string => typeof d === "string")
    : [];

  const issues: ParsedIssue[] = Array.isArray(r.issues)
    ? r.issues
        .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
        .filter((i) => VALID_SEVERITIES.has(i.severity as string))
        .map((i) => ({
          severity: i.severity as IssueSeverity,
          category: typeof i.category === "string" && i.category ? i.category : "General",
          description: typeof i.description === "string" ? i.description : "",
          codeReference:
            typeof i.codeReference === "string" &&
            i.codeReference &&
            i.codeReference !== "null"
              ? i.codeReference
              : null,
        }))
    : [];

  return {
    verdict: r.verdict as ReviewVerdict,
    summary: r.summary,
    missingDocs,
    issues,
    rawPayload: raw as object,
  };
}

// ---------------------------------------------------------------------------
// Mock mode
// ---------------------------------------------------------------------------

export const MOCK_REVIEWER = process.env.MOCK_REVIEWER === "true";

const MOCK_RESULT: ReviewResult = {
  verdict: "LIKELY_REJECT",
  summary:
    "This application has critical deficiencies that will prevent approval in its current form. Several required documents are missing and the scope description lacks the technical detail needed for plan check.",
  missingDocs: [
    "Site plan drawn to scale showing property lines, setbacks, and structure footprint",
    "Floor plan with dimensions, room labels, and door/window schedule",
  ],
  issues: [
    {
      severity: "CRITICAL",
      category: "Setback Compliance",
      description:
        "The scope does not confirm compliance with required side and rear yard setbacks. Without a dimensioned site plan, the department cannot verify the structure meets zoning minimums.",
      codeReference: "CBC Section 1.8.1",
    },
    {
      severity: "MAJOR",
      category: "Structural Documentation",
      description:
        "No structural calculations or engineer's stamp provided. Any work affecting load-bearing elements requires wet-stamped drawings from a licensed structural engineer.",
      codeReference: "CBC Section 106.1.3",
    },
    {
      severity: "MINOR",
      category: "Energy Compliance",
      description:
        "Title 24 energy compliance forms are not referenced. If the scope includes changes to the building envelope, a CF1R and CF2R must be submitted.",
      codeReference: "Title 24 Part 6",
    },
  ],
  rawPayload: { mock: true, note: "MOCK_REVIEWER=true — Anthropic was not called" },
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runReview(input: ReviewInput): Promise<ReviewResult> {
  if (MOCK_REVIEWER) {
    console.log("[reviewer] mock mode enabled — skipping Anthropic call");
    console.log("[reviewer] mock result: verdict=%s issues=%d", MOCK_RESULT.verdict, MOCK_RESULT.issues.length);
    return MOCK_RESULT;
  }

  console.log("[reviewer] real mode — calling Anthropic, model:", REVIEW_MODEL);
  const client = new Anthropic();

  const response = await client.messages.create({
    model: REVIEW_MODEL,
    max_tokens: 2048,
    temperature: 0,
    system: buildSystemPrompt(input.jurisdiction, input.permitType, input.profile),
    messages: [{ role: "user", content: buildUserMessage(input) }],
  });

  const block = response.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Review parsing failed: unexpected content block type");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(block.text);
  } catch {
    throw new Error(
      `Review parsing failed: invalid JSON — ${block.text.slice(0, 200)}`
    );
  }

  console.log("[reviewer] Anthropic response parsed successfully");
  return validateAndNormalize(parsed);
}
