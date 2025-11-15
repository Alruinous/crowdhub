/*
  Warnings:

  - You are about to drop the column `labels` on the `annotations` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_annotations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rowIndex" INTEGER NOT NULL,
    "rowData" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "subtaskId" TEXT NOT NULL,
    "annotatorId" TEXT NOT NULL,
    CONSTRAINT "annotations_subtaskId_fkey" FOREIGN KEY ("subtaskId") REFERENCES "annotation_subtasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "annotations_annotatorId_fkey" FOREIGN KEY ("annotatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_annotations" ("annotatorId", "createdAt", "id", "rowData", "rowIndex", "status", "subtaskId", "updatedAt") SELECT "annotatorId", "createdAt", "id", "rowData", "rowIndex", "status", "subtaskId", "updatedAt" FROM "annotations";
DROP TABLE "annotations";
ALTER TABLE "new_annotations" RENAME TO "annotations";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
