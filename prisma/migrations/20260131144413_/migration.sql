-- CreateTable
CREATE TABLE "annotation_task_reviewers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "annotation_task_reviewers_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "annotation_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "annotation_task_reviewers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AnnotationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "annotationId" TEXT NOT NULL,
    "annotatorId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 0,
    "isCorrect" BOOLEAN,
    "isFinished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "AnnotationResult_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "annotations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnnotationResult_annotatorId_fkey" FOREIGN KEY ("annotatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AnnotationResult" ("annotationId", "annotatorId", "completedAt", "createdAt", "id", "isCorrect", "isFinished", "updatedAt") SELECT "annotationId", "annotatorId", "completedAt", "createdAt", "id", "isCorrect", "isFinished", "updatedAt" FROM "AnnotationResult";
DROP TABLE "AnnotationResult";
ALTER TABLE "new_AnnotationResult" RENAME TO "AnnotationResult";
CREATE INDEX "AnnotationResult_annotatorId_isCorrect_idx" ON "AnnotationResult"("annotatorId", "isCorrect");
CREATE INDEX "AnnotationResult_annotationId_round_idx" ON "AnnotationResult"("annotationId", "round");
CREATE UNIQUE INDEX "AnnotationResult_annotationId_annotatorId_round_key" ON "AnnotationResult"("annotationId", "annotatorId", "round");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "annotation_task_reviewers_taskId_level_idx" ON "annotation_task_reviewers"("taskId", "level");

-- CreateIndex
CREATE INDEX "annotation_task_reviewers_userId_taskId_idx" ON "annotation_task_reviewers"("userId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "annotation_task_reviewers_taskId_userId_level_key" ON "annotation_task_reviewers"("taskId", "userId", "level");
