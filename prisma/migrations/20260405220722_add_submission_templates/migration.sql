-- CreateTable
CREATE TABLE "submission_templates" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permitType" "PermitType" NOT NULL,
    "projectType" "ProjectType" NOT NULL,
    "address" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "scopeOfWork" TEXT NOT NULL,
    "reviewContext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "submission_templates_workspaceId_idx" ON "submission_templates"("workspaceId");

-- AddForeignKey
ALTER TABLE "submission_templates" ADD CONSTRAINT "submission_templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
