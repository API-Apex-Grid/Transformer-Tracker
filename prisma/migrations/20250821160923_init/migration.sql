-- CreateTable
CREATE TABLE "Transformer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "region" TEXT NOT NULL,
    "transformerNumber" TEXT NOT NULL,
    "poleNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "sunnyImage" TEXT,
    "cloudyImage" TEXT,
    "windyImage" TEXT
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transformerNumber" TEXT NOT NULL,
    "inspectionNumber" TEXT NOT NULL,
    "inspectedDate" TEXT NOT NULL,
    "maintainanceDate" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "status" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Transformer_transformerNumber_poleNumber_key" ON "Transformer"("transformerNumber", "poleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_inspectionNumber_key" ON "Inspection"("inspectionNumber");
