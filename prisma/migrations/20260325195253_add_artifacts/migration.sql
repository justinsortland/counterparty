-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "artifacts_submissionId_idx" ON "artifacts"("submissionId");

-- CreateIndex
CREATE INDEX "artifacts_workspaceId_idx" ON "artifacts"("workspaceId");

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
