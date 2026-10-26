-- Credencial e-INPI (cofre criptografado) e registro de GRUs, por organização.

-- CreateTable
CREATE TABLE "InpiEinpiCredential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "loginEncrypted" TEXT NOT NULL,
    "loginMask" TEXT NOT NULL,
    "senhaEncrypted" TEXT NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InpiEinpiCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InpiGru" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "credentialId" TEXT,
    "gruNumber" TEXT,
    "serviceCode" TEXT,
    "processNumber" TEXT,
    "description" TEXT,
    "amountCents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "pdfPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InpiGru_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InpiEinpiCredential_organizationId_key" ON "InpiEinpiCredential"("organizationId");

-- CreateIndex
CREATE INDEX "InpiGru_organizationId_idx" ON "InpiGru"("organizationId");

-- CreateIndex
CREATE INDEX "InpiGru_gruNumber_idx" ON "InpiGru"("gruNumber");

-- AddForeignKey
ALTER TABLE "InpiEinpiCredential" ADD CONSTRAINT "InpiEinpiCredential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InpiGru" ADD CONSTRAINT "InpiGru_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InpiGru" ADD CONSTRAINT "InpiGru_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "InpiEinpiCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
