-- Tutorial de boas-vindas: contas novas nascem com onboardedAt nulo.
ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- Usuários existentes não devem ver o tutorial retroativamente.
UPDATE "User" SET "onboardedAt" = CURRENT_TIMESTAMP;
