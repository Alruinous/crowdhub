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
    "annotationId" TEXT NOT NULL,
    CONSTRAINT "annotation_selections_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "annotations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_annotation_selections" ("annotationId", "createdAt", "dimensionName", "id", "pathIds", "pathNames", "updatedAt") SELECT "annotationId", "createdAt", "dimensionName", "id", "pathIds", "pathNames", "updatedAt" FROM "annotation_selections";
DROP TABLE "annotation_selections";
ALTER TABLE "new_annotation_selections" RENAME TO "annotation_selections";
CREATE UNIQUE INDEX "annotation_selections_annotationId_dimensionName_key" ON "annotation_selections"("annotationId", "dimensionName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
