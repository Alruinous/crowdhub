-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_annotations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rowIndex" INTEGER NOT NULL,
    "rowData" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "taskId" TEXT NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 2,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "publishedCount" INTEGER NOT NULL DEFAULT 0,
    "needToReview" BOOLEAN NOT NULL DEFAULT false,
    "requirementVector" JSONB,
    "vectorLength" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "annotations_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "annotation_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_annotations" ("completedCount", "createdAt", "id", "needToReview", "publishedCount", "requiredCount", "requirementVector", "rowData", "rowIndex", "status", "taskId", "updatedAt", "vectorLength") SELECT "completedCount", "createdAt", "id", "needToReview", "publishedCount", "requiredCount", "requirementVector", "rowData", "rowIndex", "status", "taskId", "updatedAt", "vectorLength" FROM "annotations";
DROP TABLE "annotations";
ALTER TABLE "new_annotations" RENAME TO "annotations";
CREATE INDEX "annotations_taskId_status_idx" ON "annotations"("taskId", "status");
CREATE UNIQUE INDEX "annotations_taskId_rowIndex_key" ON "annotations"("taskId", "rowIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
