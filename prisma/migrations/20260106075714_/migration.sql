/*
  Warnings:

  - You are about to drop the `annotation_subtasks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `annotationId` on the `annotation_selections` table. All the data in the column will be lost.
  - You are about to drop the column `annotatorId` on the `annotations` table. All the data in the column will be lost.
  - You are about to drop the column `subtaskId` on the `annotations` table. All the data in the column will be lost.
  - Added the required column `resultId` to the `annotation_selections` table without a default value. This is not possible if the table is not empty.
  - Added the required column `taskId` to the `annotations` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "annotation_subtasks";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "AnnotationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "annotationId" TEXT NOT NULL,
    "annotatorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "AnnotationResult_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "annotations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnnotationResult_annotatorId_fkey" FOREIGN KEY ("annotatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_annotation_selections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pathIds" JSONB NOT NULL,
    "pathNames" JSONB,
    "dimensionName" TEXT NOT NULL DEFAULT '默认分类',
    "dimensionIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resultId" TEXT NOT NULL,
    CONSTRAINT "annotation_selections_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "AnnotationResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_annotation_selections" ("createdAt", "dimensionIndex", "dimensionName", "id", "pathIds", "pathNames", "updatedAt") SELECT "createdAt", "dimensionIndex", "dimensionName", "id", "pathIds", "pathNames", "updatedAt" FROM "annotation_selections";
DROP TABLE "annotation_selections";
ALTER TABLE "new_annotation_selections" RENAME TO "annotation_selections";
CREATE TABLE "new_annotations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rowIndex" INTEGER NOT NULL,
    "rowData" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "taskId" TEXT NOT NULL,
    "requiredAnnotations" INTEGER NOT NULL DEFAULT 3,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "annotations_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "annotation_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_annotations" ("createdAt", "id", "rowData", "rowIndex", "status", "updatedAt") SELECT "createdAt", "id", "rowData", "rowIndex", "status", "updatedAt" FROM "annotations";
DROP TABLE "annotations";
ALTER TABLE "new_annotations" RENAME TO "annotations";
CREATE INDEX "annotations_taskId_status_idx" ON "annotations"("taskId", "status");
CREATE UNIQUE INDEX "annotations_taskId_rowIndex_key" ON "annotations"("taskId", "rowIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AnnotationResult_annotationId_annotatorId_key" ON "AnnotationResult"("annotationId", "annotatorId");
