/**
 * Demo seed script for Counterparty.
 *
 * Prerequisites:
 *   Log in to the app at least once so your workspace is bootstrapped,
 *   then run:  npm run db:seed
 *
 * To target a specific account:
 *   DEMO_EMAIL=you@example.com npm run db:seed
 *   DEMO_WORKSPACE_ID=<id> npm run db:seed
 *
 * Without either env var the script falls back to the first workspace in the
 * database (original behavior, safe for single-workspace setups).
 *
 * Idempotent: if all 5 demo submissions and 3 demo templates already exist in
 * the target workspace, the script prints "Demo data already seeded" and exits.
 * If only partial demo data exists (e.g. from an interrupted previous run),
 * the script cleans up those records and re-seeds the full dataset.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ---------------------------------------------------------------------------
// Known demo record identifiers — used for idempotency and safe cleanup
// ---------------------------------------------------------------------------

const DEMO_SUBMISSION_TITLES = [
  "1847 Castro St ADU",
  "Noe Valley Kitchen Remodel",
  "Mission Electrical Panel Upgrade",
  "Glen Park New Single-Family",
  "Sunset Plumbing Remodel",
] as const;

const DEMO_TEMPLATE_NAMES = [
  "Standard ADU – San Francisco",
  "Kitchen / Bath Remodel – Bay Area",
  "Electrical Panel Upgrade",
] as const;

// ---------------------------------------------------------------------------
// Safe cleanup — only deletes records that match known demo identifiers
// ---------------------------------------------------------------------------

async function cleanPartialDemoData(workspaceId: string): Promise<void> {
  const demoSubmissions = await db.submission.findMany({
    where: { workspaceId, title: { in: [...DEMO_SUBMISSION_TITLES] } },
    select: { id: true, reviews: { select: { id: true } } },
  });

  const submissionIds = demoSubmissions.map((s) => s.id);
  const reviewIds = demoSubmissions.flatMap((s) => s.reviews.map((r) => r.id));

  if (reviewIds.length > 0) {
    await db.reviewIssue.deleteMany({ where: { reviewId: { in: reviewIds } } });
    await db.review.deleteMany({ where: { id: { in: reviewIds } } });
  }
  if (submissionIds.length > 0) {
    await db.artifact.deleteMany({ where: { submissionId: { in: submissionIds } } });
    await db.submission.deleteMany({ where: { id: { in: submissionIds } } });
  }

  await db.submissionTemplate.deleteMany({
    where: { workspaceId, name: { in: [...DEMO_TEMPLATE_NAMES] } },
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // -------------------------------------------------------------------------
  // Discover the target workspace
  // Priority: DEMO_WORKSPACE_ID > DEMO_EMAIL > first workspace (fallback)
  // -------------------------------------------------------------------------
  const envWorkspaceId = process.env.DEMO_WORKSPACE_ID?.trim();
  const envEmail = process.env.DEMO_EMAIL?.trim();

  let workspaceId: string;
  let targetLabel: string;

  if (envWorkspaceId) {
    const workspace = await db.workspace.findUnique({
      where: { id: envWorkspaceId },
      select: { id: true },
    });
    if (!workspace) {
      console.error(`No workspace found with id "${envWorkspaceId}".`);
      process.exit(1);
    }
    workspaceId = workspace.id;
    targetLabel = `workspace ${workspaceId}`;
  } else if (envEmail) {
    const user = await db.user.findUnique({
      where: { email: envEmail },
      select: { id: true },
    });
    if (!user) {
      console.error(
        `No user found with email "${envEmail}". Log in to the app first, then re-run.`
      );
      process.exit(1);
    }
    const member = await db.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    if (!member) {
      console.error(
        `User "${envEmail}" exists but has no workspace. Log in to the app first, then re-run.`
      );
      process.exit(1);
    }
    workspaceId = member.workspaceId;
    targetLabel = `${envEmail} (workspace ${workspaceId})`;
  } else {
    const member = await db.workspaceMember.findFirst({
      select: { workspaceId: true },
    });
    if (!member) {
      console.error(
        "No workspace found. Log in to the app first, then run this seed."
      );
      process.exit(1);
    }
    workspaceId = member.workspaceId;
    targetLabel = `workspace ${workspaceId} (first found)`;
  }

  // -------------------------------------------------------------------------
  // Idempotency check — skip only if the full demo dataset is present
  // -------------------------------------------------------------------------
  const existingSubmissionCount = await db.submission.count({
    where: { workspaceId, title: { in: [...DEMO_SUBMISSION_TITLES] } },
  });
  const existingTemplateCount = await db.submissionTemplate.count({
    where: { workspaceId, name: { in: [...DEMO_TEMPLATE_NAMES] } },
  });

  const fullySeeded =
    existingSubmissionCount === DEMO_SUBMISSION_TITLES.length &&
    existingTemplateCount === DEMO_TEMPLATE_NAMES.length;

  if (fullySeeded) {
    console.log(`Demo data already seeded for ${targetLabel} — skipping.`);
    return;
  }

  if (existingSubmissionCount > 0 || existingTemplateCount > 0) {
    console.log(
      `Partial demo data found for ${targetLabel} — cleaning up before reseeding...`
    );
    await cleanPartialDemoData(workspaceId);
  }

  console.log(`Seeding demo data into ${targetLabel}...`);

  // -------------------------------------------------------------------------
  // Insert everything in a single transaction so partial failures can't
  // leave the DB in a state where the idempotency check fires prematurely.
  // -------------------------------------------------------------------------
  await db.$transaction(
    async (tx) => {
      // -----------------------------------------------------------------------
      // 1. 1847 Castro St ADU — NEEDS_REVISION, 2 reviews, 3 labeled artifacts
      // -----------------------------------------------------------------------

      const aduArtifactDefs = [
        {
          fileName: "Site Plan – Castro ADU.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2_201_472,
          storagePath: "demo/1847-castro/site-plan.pdf",
          documentLabel:
            "Dimensioned site plan showing property lines, setbacks, and both structures",
        },
        {
          fileName: "Floor Plans – Castro ADU.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1_887_436,
          storagePath: "demo/1847-castro/floor-plans.pdf",
          documentLabel: "Floor plans with dimensions and room labels",
        },
        {
          fileName: "Elevations – Castro ADU.pdf",
          mimeType: "application/pdf",
          sizeBytes: 945_152,
          storagePath: "demo/1847-castro/elevations.pdf",
          documentLabel: "Elevations for all sides",
        },
      ];

      const aduSnapshotArtifacts = aduArtifactDefs.map((a) =>
        JSON.stringify({
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          documentLabel: a.documentLabel,
        })
      );

      const adu = await tx.submission.create({
        data: {
          workspaceId,
          title: "1847 Castro St ADU",
          address: "1847 Castro St, San Francisco, CA 94131",
          jurisdiction: "San Francisco, CA",
          permitType: "BUILDING",
          projectType: "ADU",
          scopeOfWork:
            "Construction of a 600 sq ft detached ADU in the rear yard of an existing single-family residence. New construction on a concrete slab foundation with prefabricated wall panels. Includes kitchen, bathroom, living area, and one bedroom. Separate electrical and water service connections.",
          reviewContext:
            "Prior over-the-counter review flagged the rear setback; applicant believes new measurement resolves the issue. Please confirm.",
          status: "NEEDS_REVISION",
          createdAt: new Date("2026-06-01T09:00:00Z"),
        },
      });

      for (const a of aduArtifactDefs) {
        await tx.artifact.create({
          data: {
            workspaceId,
            submissionId: adu.id,
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            storagePath: a.storagePath,
            documentLabel: a.documentLabel,
            createdAt: new Date("2026-06-01T09:30:00Z"),
          },
        });
      }

      // Rev 1 — LIKELY_REJECT
      const aduRev1 = await tx.review.create({
        data: {
          workspaceId,
          submissionId: adu.id,
          revisionNumber: 1,
          snapshotTitle: adu.title,
          snapshotScopeOfWork: adu.scopeOfWork,
          snapshotJurisdiction: adu.jurisdiction,
          snapshotPermitType: "BUILDING",
          snapshotProjectType: "ADU",
          snapshotReviewContext: adu.reviewContext,
          snapshotArtifacts: aduSnapshotArtifacts,
          modelVersion: "claude-sonnet-4-6",
          promptVersion: "v5",
          verdict: "LIKELY_REJECT",
          summary:
            "The submittal has significant compliance issues that prevent approval at this time. The rear setback remains non-conforming at 3 ft, below the required 4 ft minimum under SF Planning Code Section 136. Required energy compliance documentation and utility service capacity verification are also absent. A redesign addressing the setback and a complete resubmittal including all required documents will be necessary.",
          missingDocs: [
            "Energy compliance forms (Title 24 or local equivalent)",
            "Utility service capacity documentation",
          ],
          rawPayload: {
            verdict: "LIKELY_REJECT",
            summary:
              "The submittal has significant compliance issues that prevent approval at this time.",
            missing_docs: [
              "Energy compliance forms (Title 24 or local equivalent)",
              "Utility service capacity documentation",
            ],
            issues: [
              {
                severity: "CRITICAL",
                category: "Setbacks",
                description:
                  "Rear setback is 3 ft; minimum required is 4 ft per SF Planning Code Section 136.",
                code_reference: "SF Planning Code § 136",
              },
              {
                severity: "MAJOR",
                category: "Energy Compliance",
                description:
                  "Title 24 energy compliance forms are not included in the submittal.",
                code_reference: "California Energy Code Title 24",
              },
              {
                severity: "MAJOR",
                category: "Utility Service",
                description:
                  "Documentation of water and sewer service capacity to serve the ADU has not been provided.",
                code_reference: null,
              },
              {
                severity: "MINOR",
                category: "Elevations",
                description:
                  "South elevation drawing is not labeled with compass direction.",
                code_reference: null,
              },
            ],
          },
          createdAt: new Date("2026-06-02T14:00:00Z"),
        },
      });

      await tx.reviewIssue.createMany({
        data: [
          {
            reviewId: aduRev1.id,
            severity: "CRITICAL",
            category: "Setbacks",
            description:
              "Rear setback is 3 ft; minimum required is 4 ft per SF Planning Code Section 136. Project must be redesigned or a variance obtained before approval.",
            codeReference: "SF Planning Code § 136",
          },
          {
            reviewId: aduRev1.id,
            severity: "MAJOR",
            category: "Energy Compliance",
            description:
              "Title 24 energy compliance forms are not included in the submittal. Required for all new construction in California.",
            codeReference: "California Energy Code Title 24",
          },
          {
            reviewId: aduRev1.id,
            severity: "MAJOR",
            category: "Utility Service",
            description:
              "Documentation of water and sewer service capacity to serve the ADU has not been provided. SF Public Works requires this prior to permit approval.",
            codeReference: null,
          },
          {
            reviewId: aduRev1.id,
            severity: "MINOR",
            category: "Elevations",
            description:
              "South elevation drawing is not labeled with compass direction per department standards.",
            codeReference: null,
          },
        ],
      });

      // Rev 2 — CONDITIONAL (setback and energy resolved; utility still missing)
      const aduRev2 = await tx.review.create({
        data: {
          workspaceId,
          submissionId: adu.id,
          revisionNumber: 2,
          snapshotTitle: adu.title,
          snapshotScopeOfWork: adu.scopeOfWork,
          snapshotJurisdiction: adu.jurisdiction,
          snapshotPermitType: "BUILDING",
          snapshotProjectType: "ADU",
          snapshotReviewContext: adu.reviewContext,
          snapshotArtifacts: aduSnapshotArtifacts,
          modelVersion: "claude-sonnet-4-6",
          promptVersion: "v5",
          verdict: "CONDITIONAL",
          summary:
            "The resubmittal resolves the critical rear setback issue; the revised site plan confirms the structure is now set back 4.5 ft, meeting the minimum requirement. Energy compliance documentation has been added and is adequate. One outstanding item remains: utility service capacity documentation for water and sewer expansion has not been provided. The south elevation label is also still missing. Approval can proceed once the utility documentation is submitted.",
          missingDocs: ["Utility service capacity documentation"],
          rawPayload: {
            verdict: "CONDITIONAL",
            summary:
              "The resubmittal resolves the critical rear setback issue. One outstanding item remains.",
            missing_docs: ["Utility service capacity documentation"],
            issues: [
              {
                severity: "MAJOR",
                category: "Utility Service",
                description:
                  "Capacity documentation for water and sewer service expansion still not provided.",
                code_reference: null,
              },
              {
                severity: "MINOR",
                category: "Elevations",
                description: "South elevation remains unlabeled.",
                code_reference: null,
              },
            ],
          },
          createdAt: new Date("2026-06-10T11:30:00Z"),
        },
      });

      await tx.reviewIssue.createMany({
        data: [
          {
            reviewId: aduRev2.id,
            severity: "MAJOR",
            category: "Utility Service",
            description:
              "Capacity documentation for water and sewer service expansion still not provided. Required before final permit issuance.",
            codeReference: null,
          },
          {
            reviewId: aduRev2.id,
            severity: "MINOR",
            category: "Elevations",
            description:
              "South elevation remains unlabeled. Please add compass direction label per department standards.",
            codeReference: null,
          },
        ],
      });

      // -----------------------------------------------------------------------
      // 2. Noe Valley Kitchen Remodel — REVIEWED, 1 review, 2 labeled artifacts
      // -----------------------------------------------------------------------

      const remodelArtifactDefs = [
        {
          fileName: "Floor Plan – Noe Valley Remodel.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1_245_184,
          storagePath: "demo/noe-valley/floor-plan.pdf",
          documentLabel:
            "Floor plan showing existing and proposed layout with dimensions",
        },
        {
          fileName: "Electrical Plan – Noe Valley.pdf",
          mimeType: "application/pdf",
          sizeBytes: 718_848,
          storagePath: "demo/noe-valley/electrical-plan.pdf",
          documentLabel: "Electrical plan (if panel or circuit changes)",
        },
      ];

      const remodelSnapshotArtifacts = remodelArtifactDefs.map((a) =>
        JSON.stringify({
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          documentLabel: a.documentLabel,
        })
      );

      const remodel = await tx.submission.create({
        data: {
          workspaceId,
          title: "Noe Valley Kitchen Remodel",
          address: "412 Sanchez St, San Francisco, CA 94114",
          jurisdiction: "San Francisco, CA",
          permitType: "BUILDING",
          projectType: "REMODEL",
          scopeOfWork:
            "Full kitchen remodel including removal of non-load-bearing wall between kitchen and dining room, relocation of sink and dishwasher, new cabinetry and countertops, subpanel addition for 40A range circuit, and new exhaust fan vented to exterior.",
          reviewContext: null,
          status: "REVIEWED",
          createdAt: new Date("2026-05-15T10:00:00Z"),
        },
      });

      for (const a of remodelArtifactDefs) {
        await tx.artifact.create({
          data: {
            workspaceId,
            submissionId: remodel.id,
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            storagePath: a.storagePath,
            documentLabel: a.documentLabel,
            createdAt: new Date("2026-05-15T10:30:00Z"),
          },
        });
      }

      const remodelRev1 = await tx.review.create({
        data: {
          workspaceId,
          submissionId: remodel.id,
          revisionNumber: 1,
          snapshotTitle: remodel.title,
          snapshotScopeOfWork: remodel.scopeOfWork,
          snapshotJurisdiction: remodel.jurisdiction,
          snapshotPermitType: "BUILDING",
          snapshotProjectType: "REMODEL",
          snapshotReviewContext: null,
          snapshotArtifacts: remodelSnapshotArtifacts,
          modelVersion: "claude-sonnet-4-6",
          promptVersion: "v5",
          verdict: "LIKELY_APPROVE",
          summary:
            "The submittal is complete and well-documented. The floor plan clearly identifies the non-load-bearing wall to be removed and the new kitchen layout with dimensions. The electrical plan shows the subpanel addition and range circuit. One minor item: the exhaust fan CFM rating is not specified on the plan; this should be noted on the permit card but does not require resubmittal. The project is recommended for approval.",
          missingDocs: [],
          rawPayload: {
            verdict: "LIKELY_APPROVE",
            summary:
              "The submittal is complete and well-documented. Recommended for approval.",
            missing_docs: [],
            issues: [
              {
                severity: "MINOR",
                category: "Ventilation",
                description: "Exhaust fan CFM rating not specified on plan.",
                code_reference: "CPC § 402.5",
              },
            ],
          },
          createdAt: new Date("2026-05-16T15:00:00Z"),
        },
      });

      await tx.reviewIssue.create({
        data: {
          reviewId: remodelRev1.id,
          severity: "MINOR",
          category: "Ventilation",
          description:
            "Exhaust fan CFM rating is not specified on the plan. Required per CPC Section 402.5 to confirm exhaust adequacy for the kitchen volume.",
          codeReference: "CPC § 402.5",
        },
      });

      // -----------------------------------------------------------------------
      // 3. Mission Electrical Panel Upgrade — NEEDS_REVISION, 1 review, 2 labeled artifacts
      // -----------------------------------------------------------------------

      const electricalArtifactDefs = [
        {
          fileName: "Single-Line Diagram – Mission.pdf",
          mimeType: "application/pdf",
          sizeBytes: 512_000,
          storagePath: "demo/mission-electrical/single-line.pdf",
          documentLabel: "Single-line electrical diagram",
        },
        {
          fileName: "Panel Schedule – Mission.pdf",
          mimeType: "application/pdf",
          sizeBytes: 307_200,
          storagePath: "demo/mission-electrical/panel-schedule.pdf",
          documentLabel: "Panel schedule with load calculations",
        },
      ];

      const electricalSnapshotArtifacts = electricalArtifactDefs.map((a) =>
        JSON.stringify({
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          documentLabel: a.documentLabel,
        })
      );

      const electrical = await tx.submission.create({
        data: {
          workspaceId,
          title: "Mission Electrical Panel Upgrade",
          address: "2851 22nd St, San Francisco, CA 94110",
          jurisdiction: "San Francisco, CA",
          permitType: "ELECTRICAL",
          projectType: "OTHER",
          scopeOfWork:
            "Upgrade existing 100A service to 200A to support EV charging installation and future kitchen remodel. Replace main panel and meter base. Service entrance conductor replacement included. All work to NEC 2023 standards.",
          reviewContext: null,
          status: "NEEDS_REVISION",
          createdAt: new Date("2026-06-12T08:00:00Z"),
        },
      });

      for (const a of electricalArtifactDefs) {
        await tx.artifact.create({
          data: {
            workspaceId,
            submissionId: electrical.id,
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            storagePath: a.storagePath,
            documentLabel: a.documentLabel,
            createdAt: new Date("2026-06-12T08:30:00Z"),
          },
        });
      }

      const electricalRev1 = await tx.review.create({
        data: {
          workspaceId,
          submissionId: electrical.id,
          revisionNumber: 1,
          snapshotTitle: electrical.title,
          snapshotScopeOfWork: electrical.scopeOfWork,
          snapshotJurisdiction: electrical.jurisdiction,
          snapshotPermitType: "ELECTRICAL",
          snapshotProjectType: "OTHER",
          snapshotReviewContext: null,
          snapshotArtifacts: electricalSnapshotArtifacts,
          modelVersion: "claude-sonnet-4-6",
          promptVersion: "v5",
          verdict: "CONDITIONAL",
          summary:
            "The single-line diagram and panel schedule are present but incomplete. Load calculations show the upgraded 200A service at 97% capacity; documentation confirming the utility service entrance conductor rating has not been included. AFCI protection is not shown for bedroom circuits as required by NEC 210.12. The ground rod location is also absent from the plan. Resubmittal addressing these items is required.",
          missingDocs: ["Panel schedule with load calculations"],
          rawPayload: {
            verdict: "CONDITIONAL",
            summary:
              "The submittal is incomplete. Resubmittal addressing the noted items is required.",
            missing_docs: ["Panel schedule with load calculations"],
            issues: [
              {
                severity: "MAJOR",
                category: "Panel Schedule",
                description:
                  "Load calculations show service at 97% capacity; service entrance conductor rating documentation not included.",
                code_reference: "NEC 230.42",
              },
              {
                severity: "MAJOR",
                category: "AFCI Protection",
                description:
                  "Arc-fault circuit-interrupter protection not shown for bedroom circuits.",
                code_reference: "NEC 210.12",
              },
              {
                severity: "MINOR",
                category: "Grounding",
                description:
                  "Ground rod location not indicated on the electrical plan.",
                code_reference: "NEC 250.52",
              },
            ],
          },
          createdAt: new Date("2026-06-13T10:00:00Z"),
        },
      });

      await tx.reviewIssue.createMany({
        data: [
          {
            reviewId: electricalRev1.id,
            severity: "MAJOR",
            category: "Panel Schedule",
            description:
              "Load calculations show service at 97% capacity after upgrade. Documentation confirming the utility service entrance conductor is rated for the new 200A panel is required.",
            codeReference: "NEC 230.42",
          },
          {
            reviewId: electricalRev1.id,
            severity: "MAJOR",
            category: "AFCI Protection",
            description:
              "Arc-fault circuit-interrupter protection is not shown for bedroom circuits as required under NEC 210.12.",
            codeReference: "NEC 210.12",
          },
          {
            reviewId: electricalRev1.id,
            severity: "MINOR",
            category: "Grounding",
            description:
              "Ground rod location is not indicated on the electrical plan. Required per NEC 250.52.",
            codeReference: "NEC 250.52",
          },
        ],
      });

      // -----------------------------------------------------------------------
      // 4. Glen Park New Single-Family — DRAFT, 0 reviews, 1 unlabeled artifact
      // -----------------------------------------------------------------------

      const glenPark = await tx.submission.create({
        data: {
          workspaceId,
          title: "Glen Park New Single-Family",
          address: "68 Brompton Ave, San Francisco, CA 94131",
          jurisdiction: "San Francisco, CA",
          permitType: "BUILDING",
          projectType: "NEW_CONSTRUCTION",
          scopeOfWork:
            "New construction of a 3,200 sq ft single-family residence on a vacant lot. Three stories, wood frame, attached two-car garage. Full plan set including architectural, structural, and MEP. Soils investigation complete.",
          reviewContext: null,
          status: "DRAFT",
          createdAt: new Date("2026-06-20T11:00:00Z"),
        },
      });

      await tx.artifact.create({
        data: {
          workspaceId,
          submissionId: glenPark.id,
          fileName: "Site Plan – Glen Park.pdf",
          mimeType: "application/pdf",
          sizeBytes: 3_354_624,
          storagePath: "demo/glen-park/site-plan.pdf",
          documentLabel: null,
          createdAt: new Date("2026-06-20T11:15:00Z"),
        },
      });

      // -----------------------------------------------------------------------
      // 5. Sunset Plumbing Remodel — DRAFT, 0 reviews, 0 artifacts
      // -----------------------------------------------------------------------

      await tx.submission.create({
        data: {
          workspaceId,
          title: "Sunset Plumbing Remodel",
          address: "1423 43rd Ave, San Francisco, CA 94122",
          jurisdiction: "San Francisco, CA",
          permitType: "PLUMBING",
          projectType: "REMODEL",
          scopeOfWork:
            "Bathroom remodel in master suite: relocate shower and toilet, add second sink, replace water heater with tankless unit vented to exterior. DWV rerouting required through crawl space.",
          reviewContext: null,
          status: "DRAFT",
          createdAt: new Date("2026-06-25T14:00:00Z"),
        },
      });

      // -----------------------------------------------------------------------
      // Templates
      // -----------------------------------------------------------------------

      await tx.submissionTemplate.createMany({
        data: [
          {
            workspaceId,
            name: "Standard ADU – San Francisco",
            permitType: "BUILDING",
            projectType: "ADU",
            address: "",
            jurisdiction: "San Francisco, CA",
            scopeOfWork:
              "Construction of a [size] sq ft detached ADU in the rear yard of an existing single-family residence. New construction on a concrete slab foundation. Includes kitchen, bathroom, living area, and one bedroom. Separate electrical and water service connections.",
            reviewContext:
              "Confirm setback compliance under SF Planning Code Section 136. Verify state ADU preemption provisions apply.",
          },
          {
            workspaceId,
            name: "Kitchen / Bath Remodel – Bay Area",
            permitType: "BUILDING",
            projectType: "REMODEL",
            address: "",
            jurisdiction: "San Francisco, CA",
            scopeOfWork:
              "Kitchen/bathroom remodel: [describe scope]. Includes removal of [load-bearing/non-load-bearing] wall, new cabinetry and fixtures, electrical and plumbing updates as required.",
            reviewContext: null,
          },
          {
            workspaceId,
            name: "Electrical Panel Upgrade",
            permitType: "ELECTRICAL",
            projectType: "OTHER",
            address: "",
            jurisdiction: "San Francisco, CA",
            scopeOfWork:
              "Upgrade existing [100A/200A] service to [200A/400A] to support [EV charging / remodel / addition]. Replace main panel and meter base. All work to NEC 2023 standards.",
            reviewContext: null,
          },
        ],
      });
    },
    { timeout: 30_000 }
  );

  console.log(`Demo data seeded successfully into ${targetLabel}.`);
  console.log(
    "  5 submissions, 8 artifacts, 4 reviews, 10 review issues, 3 templates"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
