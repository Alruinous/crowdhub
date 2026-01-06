/*
  Warnings:

  - You are about to drop the `annotation_messages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `categoryId` on the `annotation_tasks` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "annotation_messages";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_annotation_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "points" INTEGER NOT NULL DEFAULT 0,
    "maxWorkers" INTEGER NOT NULL DEFAULT 1,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "publishCycle" INTEGER DEFAULT 1,
    "publishLimit" INTEGER DEFAULT 100,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "publisherId" TEXT NOT NULL,
    "dataFileId" TEXT,
    "labelFileId" TEXT,
    CONSTRAINT "annotation_tasks_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "annotation_tasks_dataFileId_fkey" FOREIGN KEY ("dataFileId") REFERENCES "data_files" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "annotation_tasks_labelFileId_fkey" FOREIGN KEY ("labelFileId") REFERENCES "label_files" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_annotation_tasks" ("approved", "completedAt", "createdAt", "dataFileId", "description", "id", "labelFileId", "maxWorkers", "points", "publishCycle", "publishLimit", "publisherId", "status", "title", "updatedAt") SELECT "approved", "completedAt", "createdAt", "dataFileId", "description", "id", "labelFileId", "maxWorkers", "points", "publishCycle", "publishLimit", "publisherId", "status", "title", "updatedAt" FROM "annotation_tasks";
DROP TABLE "annotation_tasks";
ALTER TABLE "new_annotation_tasks" RENAME TO "annotation_tasks";
CREATE UNIQUE INDEX "annotation_tasks_dataFileId_key" ON "annotation_tasks"("dataFileId");
CREATE UNIQUE INDEX "annotation_tasks_labelFileId_key" ON "annotation_tasks"("labelFileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
