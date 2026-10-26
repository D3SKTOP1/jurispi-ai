-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- DropForeignKey
ALTER TABLE "InpiDispatch" DROP CONSTRAINT "InpiDispatch_inpiProcessId_fkey";

-- DropForeignKey
ALTER TABLE "InpiDispatch" DROP CONSTRAINT "InpiDispatch_rpiIssueId_fkey";

-- DropForeignKey
ALTER TABLE "InpiProcess" DROP CONSTRAINT "InpiProcess_caseId_fkey";

-- DropForeignKey
ALTER TABLE "InpiProcess" DROP CONSTRAINT "InpiProcess_organizationId_fkey";

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "RpiIssue" DROP COLUMN "processedAt",
DROP COLUMN "publicationDate",
ADD COLUMN     "publishedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DISCOVERED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "number" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "InpiDispatch";

-- DropTable
DROP TABLE "InpiProcess";

-- CreateTable
CREATE TABLE "InpiSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "baseUrl" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InpiSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InpiImportJob" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "checksum" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InpiImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InpiRawFile" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "originalUrl" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "checksum" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "rpiNumber" TEXT,
    "rpiDate" TIMESTAMP(3),
    "section" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InpiRawFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InpiRawRecord" (
    "id" TEXT NOT NULL,
    "rawFileId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "externalId" TEXT,
    "rawData" JSONB NOT NULL,
    "parsedText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InpiRawRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InpiTrademark" (
    "id" TEXT NOT NULL,
    "processNumber" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "holderName" TEXT,
    "holderDocument" TEXT,
    "presentation" TEXT,
    "nature" TEXT,
    "status" TEXT,
    "applicationDate" TIMESTAMP(3),
    "registrationDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3),
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InpiTrademark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InpiTrademarkClass" (
    "id" TEXT NOT NULL,
    "trademarkId" TEXT NOT NULL,
    "niceClass" TEXT NOT NULL,
    "specification" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InpiTrademarkClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InpiTrademarkApplicant" (
    "id" TEXT NOT NULL,
    "trademarkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InpiTrademarkApplicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InpiTrademarkDispatch" (
    "id" TEXT NOT NULL,
    "trademarkId" TEXT,
    "processNumber" TEXT NOT NULL,
    "rpiNumber" TEXT,
    "rpiDate" TIMESTAMP(3),
    "dispatchCode" TEXT,
    "dispatchText" TEXT NOT NULL,
    "section" TEXT,
    "sourceFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InpiTrademarkDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InpiPatent" (
    "id" TEXT NOT NULL,
    "processNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT,
    "abstractText" TEXT,
    "applicationDate" TIMESTAMP(3),
    "publicationDate" TIMESTAMP(3),
    "grantDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "status" TEXT,
    "source" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3),
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InpiPatent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InpiPatentIpcClass" (
    "id" TEXT NOT NULL,
    "patentId" TEXT NOT NULL,
    "ipcCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InpiPatentIpcClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InpiPatentApplicant" (
    "id" TEXT NOT NULL,
    "patentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InpiPatentApplicant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InpiPatentInventor" (
    "id" TEXT NOT NULL,
    "patentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InpiPatentInventor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InpiPatentDispatch" (
    "id" TEXT NOT NULL,
    "patentId" TEXT,
    "processNumber" TEXT NOT NULL,
    "rpiNumber" TEXT,
    "rpiDate" TIMESTAMP(3),
    "dispatchCode" TEXT,
    "dispatchText" TEXT NOT NULL,
    "section" TEXT,
    "sourceFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InpiPatentDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpiSection" (
    "id" TEXT NOT NULL,
    "rpiIssueId" TEXT NOT NULL,
    "sectionCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "xmlUrl" TEXT,
    "txtUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RpiSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpiDispatch" (
    "id" TEXT NOT NULL,
    "rpiSectionId" TEXT NOT NULL,
    "processNumber" TEXT NOT NULL,
    "dispatchCode" TEXT,
    "dispatchText" TEXT NOT NULL,
    "holderName" TEXT,
    "title" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RpiDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InpiSyncLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InpiSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoredProcess" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT,
    "caseId" TEXT,
    "processNumber" TEXT NOT NULL,
    "title" TEXT,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'INPI',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoredProcess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InpiImportJob_status_idx" ON "InpiImportJob"("status");

-- CreateIndex
CREATE INDEX "InpiImportJob_sourceType_entityType_idx" ON "InpiImportJob"("sourceType", "entityType");

-- CreateIndex
CREATE INDEX "InpiRawFile_importJobId_idx" ON "InpiRawFile"("importJobId");

-- CreateIndex
CREATE UNIQUE INDEX "InpiRawFile_checksum_key" ON "InpiRawFile"("checksum");

-- CreateIndex
CREATE INDEX "InpiRawRecord_rawFileId_status_idx" ON "InpiRawRecord"("rawFileId", "status");

-- CreateIndex
CREATE INDEX "InpiRawRecord_entityType_status_idx" ON "InpiRawRecord"("entityType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InpiTrademark_processNumber_key" ON "InpiTrademark"("processNumber");

-- CreateIndex
CREATE INDEX "InpiTrademark_normalizedName_idx" ON "InpiTrademark"("normalizedName");

-- CreateIndex
CREATE INDEX "InpiTrademark_holderName_idx" ON "InpiTrademark"("holderName");

-- CreateIndex
CREATE INDEX "InpiTrademark_status_idx" ON "InpiTrademark"("status");

-- CreateIndex
CREATE INDEX "InpiTrademarkClass_niceClass_idx" ON "InpiTrademarkClass"("niceClass");

-- CreateIndex
CREATE INDEX "InpiTrademarkClass_trademarkId_idx" ON "InpiTrademarkClass"("trademarkId");

-- CreateIndex
CREATE INDEX "InpiTrademarkApplicant_trademarkId_idx" ON "InpiTrademarkApplicant"("trademarkId");

-- CreateIndex
CREATE INDEX "InpiTrademarkDispatch_processNumber_idx" ON "InpiTrademarkDispatch"("processNumber");

-- CreateIndex
CREATE INDEX "InpiTrademarkDispatch_rpiNumber_idx" ON "InpiTrademarkDispatch"("rpiNumber");

-- CreateIndex
CREATE INDEX "InpiTrademarkDispatch_dispatchCode_idx" ON "InpiTrademarkDispatch"("dispatchCode");

-- CreateIndex
CREATE UNIQUE INDEX "InpiPatent_processNumber_key" ON "InpiPatent"("processNumber");

-- CreateIndex
CREATE INDEX "InpiPatent_title_idx" ON "InpiPatent"("title");

-- CreateIndex
CREATE INDEX "InpiPatent_status_idx" ON "InpiPatent"("status");

-- CreateIndex
CREATE INDEX "InpiPatentIpcClass_ipcCode_idx" ON "InpiPatentIpcClass"("ipcCode");

-- CreateIndex
CREATE INDEX "InpiPatentIpcClass_patentId_idx" ON "InpiPatentIpcClass"("patentId");

-- CreateIndex
CREATE INDEX "InpiPatentApplicant_patentId_idx" ON "InpiPatentApplicant"("patentId");

-- CreateIndex
CREATE INDEX "InpiPatentInventor_patentId_idx" ON "InpiPatentInventor"("patentId");

-- CreateIndex
CREATE INDEX "InpiPatentDispatch_processNumber_idx" ON "InpiPatentDispatch"("processNumber");

-- CreateIndex
CREATE INDEX "InpiPatentDispatch_rpiNumber_idx" ON "InpiPatentDispatch"("rpiNumber");

-- CreateIndex
CREATE INDEX "InpiPatentDispatch_dispatchCode_idx" ON "InpiPatentDispatch"("dispatchCode");

-- CreateIndex
CREATE INDEX "RpiSection_sectionCode_idx" ON "RpiSection"("sectionCode");

-- CreateIndex
CREATE INDEX "RpiSection_rpiIssueId_idx" ON "RpiSection"("rpiIssueId");

-- CreateIndex
CREATE INDEX "RpiDispatch_processNumber_idx" ON "RpiDispatch"("processNumber");

-- CreateIndex
CREATE INDEX "RpiDispatch_dispatchCode_idx" ON "RpiDispatch"("dispatchCode");

-- CreateIndex
CREATE INDEX "InpiSyncLog_jobId_idx" ON "InpiSyncLog"("jobId");

-- CreateIndex
CREATE INDEX "InpiSyncLog_level_idx" ON "InpiSyncLog"("level");

-- CreateIndex
CREATE INDEX "MonitoredProcess_organizationId_idx" ON "MonitoredProcess"("organizationId");

-- CreateIndex
CREATE INDEX "MonitoredProcess_processNumber_idx" ON "MonitoredProcess"("processNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoredProcess_organizationId_processNumber_key" ON "MonitoredProcess"("organizationId", "processNumber");

-- AddForeignKey
ALTER TABLE "InpiImportJob" ADD CONSTRAINT "InpiImportJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "InpiSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InpiRawFile" ADD CONSTRAINT "InpiRawFile_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "InpiImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InpiRawRecord" ADD CONSTRAINT "InpiRawRecord_rawFileId_fkey" FOREIGN KEY ("rawFileId") REFERENCES "InpiRawFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InpiTrademarkClass" ADD CONSTRAINT "InpiTrademarkClass_trademarkId_fkey" FOREIGN KEY ("trademarkId") REFERENCES "InpiTrademark"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InpiTrademarkApplicant" ADD CONSTRAINT "InpiTrademarkApplicant_trademarkId_fkey" FOREIGN KEY ("trademarkId") REFERENCES "InpiTrademark"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InpiTrademarkDispatch" ADD CONSTRAINT "InpiTrademarkDispatch_trademarkId_fkey" FOREIGN KEY ("trademarkId") REFERENCES "InpiTrademark"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InpiPatentIpcClass" ADD CONSTRAINT "InpiPatentIpcClass_patentId_fkey" FOREIGN KEY ("patentId") REFERENCES "InpiPatent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InpiPatentApplicant" ADD CONSTRAINT "InpiPatentApplicant_patentId_fkey" FOREIGN KEY ("patentId") REFERENCES "InpiPatent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InpiPatentInventor" ADD CONSTRAINT "InpiPatentInventor_patentId_fkey" FOREIGN KEY ("patentId") REFERENCES "InpiPatent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InpiPatentDispatch" ADD CONSTRAINT "InpiPatentDispatch_patentId_fkey" FOREIGN KEY ("patentId") REFERENCES "InpiPatent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpiSection" ADD CONSTRAINT "RpiSection_rpiIssueId_fkey" FOREIGN KEY ("rpiIssueId") REFERENCES "RpiIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpiDispatch" ADD CONSTRAINT "RpiDispatch_rpiSectionId_fkey" FOREIGN KEY ("rpiSectionId") REFERENCES "RpiSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoredProcess" ADD CONSTRAINT "MonitoredProcess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoredProcess" ADD CONSTRAINT "MonitoredProcess_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoredProcess" ADD CONSTRAINT "MonitoredProcess_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "IndustrialPropertyCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Índices de busca por similaridade (pg_trgm) para nomes de marcas e titulares
CREATE INDEX "InpiTrademark_normalizedName_trgm_idx" ON "InpiTrademark" USING gin ("normalizedName" gin_trgm_ops);
CREATE INDEX "InpiTrademark_holderName_trgm_idx" ON "InpiTrademark" USING gin ("holderName" gin_trgm_ops);

-- Índice full-text search (português) para títulos e resumos de patentes
CREATE INDEX "InpiPatent_fts_idx" ON "InpiPatent" USING gin (to_tsvector('portuguese', coalesce("title", '') || ' ' || coalesce("abstractText", '')));
