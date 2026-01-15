-- CreateTable
CREATE TABLE "_ClaimedAnnotationTasks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ClaimedAnnotationTasks_A_fkey" FOREIGN KEY ("A") REFERENCES "annotation_tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ClaimedAnnotationTasks_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_ClaimedAnnotationTasks_AB_unique" ON "_ClaimedAnnotationTasks"("A", "B");

-- CreateIndex
CREATE INDEX "_ClaimedAnnotationTasks_B_index" ON "_ClaimedAnnotationTasks"("B");
