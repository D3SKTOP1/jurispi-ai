-- Prazos automáticos a partir de despachos da RPI: origem, processo e metadados.

-- AlterTable
ALTER TABLE "Deadline" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Deadline" ADD COLUMN "processNumber" TEXT;
ALTER TABLE "Deadline" ADD COLUMN "metadata" JSONB;

-- CreateIndex
CREATE INDEX "Deadline_organizationId_source_idx" ON "Deadline"("organizationId", "source");
