/*
  Warnings:

  - You are about to drop the column `dimensionName` on the `annotation_selections` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "label_files" ADD COLUMN "dimensionNames" JSONB;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_annotation_selections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pathIds" JSONB NOT NULL,
    "pathNames" JSONB,
    "dimensionIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resultId" TEXT NOT NULL,
    CONSTRAINT "annotation_selections_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "AnnotationResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_annotation_selections" ("createdAt", "dimensionIndex", "id", "pathIds", "pathNames", "resultId", "updatedAt") SELECT "createdAt", "dimensionIndex", "id", "pathIds", "pathNames", "resultId", "updatedAt" FROM "annotation_selections";
DROP TABLE "annotation_selections";
ALTER TABLE "new_annotation_selections" RENAME TO "annotation_selections";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
