-- Último login com sucesso (exibido no painel de administração da plataforma).
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
