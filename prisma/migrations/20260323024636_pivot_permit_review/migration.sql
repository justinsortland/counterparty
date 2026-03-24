/*
  Warnings:

  - You are about to drop the `activity_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contacts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `counterparties` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `deals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tasks` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'REVIEWED', 'NEEDS_REVISION');

-- CreateEnum
CREATE TYPE "PermitType" AS ENUM ('BUILDING', 'ELECTRICAL', 'PLUMBING', 'MECHANICAL', 'ZONING', 'GRADING');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('REMODEL', 'ADDITION', 'ADU', 'NEW_CONSTRUCTION', 'DECK_PATIO', 'FENCE_WALL', 'POOL', 'DEMOLITION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewVerdict" AS ENUM ('LIKELY_APPROVE', 'CONDITIONAL', 'LIKELY_REJECT');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR');

-- DropForeignKey
ALTER TABLE "activity_logs" DROP CONSTRAINT "activity_logs_counterpartyId_fkey";

-- DropForeignKey
ALTER TABLE "activity_logs" DROP CONSTRAINT "activity_logs_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_counterpartyId_fkey";

-- DropForeignKey
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "counterparties" DROP CONSTRAINT "counterparties_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "deals" DROP CONSTRAINT "deals_counterpartyId_fkey";

-- DropForeignKey
ALTER TABLE "deals" DROP CONSTRAINT "deals_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "notes" DROP CONSTRAINT "notes_counterpartyId_fkey";

-- DropForeignKey
ALTER TABLE "notes" DROP CONSTRAINT "notes_dealId_fkey";

-- DropForeignKey
ALTER TABLE "notes" DROP CONSTRAINT "notes_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_counterpartyId_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_dealId_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_workspaceId_fkey";

-- DropTable
DROP TABLE "activity_logs";

-- DropTable
DROP TABLE "contacts";

-- DropTable
DROP TABLE "counterparties";

-- DropTable
DROP TABLE "deals";

-- DropTable
DROP TABLE "notes";

-- DropTable
DROP TABLE "tasks";

-- DropEnum
DROP TYPE "CounterpartyStatus";

-- DropEnum
DROP TYPE "CounterpartyType";

-- DropEnum
DROP TYPE "DealStage";

-- DropEnum
DROP TYPE "EntityType";

-- DropEnum
DROP TYPE "NoteType";

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "permitType" "PermitType" NOT NULL,
    "projectType" "ProjectType" NOT NULL,
    "scopeOfWork" TEXT NOT NULL,
    "reviewContext" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "snapshotTitle" TEXT NOT NULL,
    "snapshotScopeOfWork" TEXT NOT NULL,
    "snapshotJurisdiction" TEXT NOT NULL,
    "snapshotPermitType" "PermitType" NOT NULL,
    "snapshotProjectType" "ProjectType" NOT NULL,
    "snapshotReviewContext" TEXT,
    "snapshotArtifacts" TEXT[],
    "modelVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "verdict" "ReviewVerdict" NOT NULL,
    "summary" TEXT NOT NULL,
    "missingDocs" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_issues" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "codeReference" TEXT,

    CONSTRAINT "review_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "submissions_workspaceId_idx" ON "submissions"("workspaceId");

-- CreateIndex
CREATE INDEX "submissions_workspaceId_status_idx" ON "submissions"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "reviews_workspaceId_idx" ON "reviews"("workspaceId");

-- CreateIndex
CREATE INDEX "reviews_submissionId_idx" ON "reviews"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_submissionId_revisionNumber_key" ON "reviews"("submissionId", "revisionNumber");

-- CreateIndex
CREATE INDEX "review_issues_reviewId_idx" ON "review_issues"("reviewId");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_issues" ADD CONSTRAINT "review_issues_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
