-- CreateTable
CREATE TABLE "annotation_selections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pathIds" JSONB NOT NULL,
    "pathNames" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "annotationId" TEXT NOT NULL,
    CONSTRAINT "annotation_selections_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "annotations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
