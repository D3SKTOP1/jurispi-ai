/**
 * Cria (ou atualiza a senha de) um usuário em uma organização existente.
 *
 * Uso: npx tsx scripts/create-user.ts <nome> <email> <senha> [org-slug]
 * Ex.: npx tsx scripts/create-user.ts "Validador" teste@demopi.com.br "SenhaForte!123" escritorio-demo-pi
 */
import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [name, email, password, orgSlug = "escritorio-demo-pi"] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Uso: npx tsx scripts/create-user.ts <nome> <email> <senha> [org-slug]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("A senha deve ter pelo menos 8 caracteres.");
    process.exit(1);
  }

  const organization = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!organization) {
    console.error(`Organização "${orgSlug}" não encontrada. Rode o seed antes.`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase().trim() },
    create: { name, email: email.toLowerCase().trim(), passwordHash },
    update: { name, passwordHash },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: organization.id, userId: user.id },
    },
    create: { organizationId: organization.id, userId: user.id, role: "MEMBER" },
    update: {},
  });

  console.log(`✅ Usuário pronto: ${user.email} (organização: ${organization.name})`);
}

main()
  .catch((error) => {
    console.error("❌ Erro:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
