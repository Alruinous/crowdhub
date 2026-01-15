/*
  Warnings:

  - You are about to drop the column `requiredAnnotations` on the `annotations` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AnnotationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "annotationId" TEXT NOT NULL,
    "annotatorId" TEXT NOT NULL,
    "isCorrect" BOOLEAN,
    "isFinished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "AnnotationResult_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "annotations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnnotationResult_annotatorId_fkey" FOREIGN KEY ("annotatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AnnotationResult" ("annotationId", "annotatorId", "completedAt", "createdAt", "id", "isCorrect", "updatedAt") SELECT "annotationId", "annotatorId", "completedAt", "createdAt", "id", "isCorrect", "updatedAt" FROM "AnnotationResult";
DROP TABLE "AnnotationResult";
ALTER TABLE "new_AnnotationResult" RENAME TO "AnnotationResult";
CREATE INDEX "AnnotationResult_annotatorId_isCorrect_idx" ON "AnnotationResult"("annotatorId", "isCorrect");
CREATE UNIQUE INDEX "AnnotationResult_annotationId_annotatorId_key" ON "AnnotationResult"("annotationId", "annotatorId");
CREATE TABLE "new_annotations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rowIndex" INTEGER NOT NULL,
    "rowData" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "taskId" TEXT NOT NULL,
    "isfinished" BOOLEAN NOT NULL DEFAULT false,
    "requiredCount" INTEGER NOT NULL DEFAULT 3,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "publishedCount" INTEGER NOT NULL DEFAULT 0,
    "requirementVector" JSONB,
    "vectorLength" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "annotations_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "annotation_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_annotations" ("completedCount", "createdAt", "id", "requirementVector", "rowData", "rowIndex", "status", "taskId", "updatedAt", "vectorLength") SELECT "completedCount", "createdAt", "id", "requirementVector", "rowData", "rowIndex", "status", "taskId", "updatedAt", "vectorLength" FROM "annotations";
DROP TABLE "annotations";
ALTER TABLE "new_annotations" RENAME TO "annotations";
CREATE INDEX "annotations_taskId_status_idx" ON "annotations"("taskId", "status");
CREATE UNIQUE INDEX "annotations_taskId_rowIndex_key" ON "annotations"("taskId", "rowIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
