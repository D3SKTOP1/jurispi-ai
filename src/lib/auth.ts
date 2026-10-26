import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credenciais",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
          include: {
            memberships: {
              include: { organization: true },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const membership = user.memberships[0];
        if (!membership) return null;

        // Registro de acesso (painel de administração): último login +
        // trilha de auditoria. Falha aqui não pode impedir o login.
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
          const { logAudit } = await import("@/lib/audit");
          await logAudit({
            organizationId: membership.organizationId,
            userId: user.id,
            action: "auth.login",
            entityType: "User",
            entityId: user.id,
            metadata: { email: user.email },
          });
        } catch (error) {
          console.error("[auth] falha ao registrar login:", error);
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          organizationId: membership.organizationId,
          organizationName: membership.organization.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
      }
      // Troca de organização ativa: só efetiva se o usuário for membro dela.
      if (trigger === "update") {
        const requested = (session as { organizationId?: string } | undefined)?.organizationId;
        const userId = token.id as string | undefined;
        if (requested && userId) {
          const membership = await prisma.organizationMember.findUnique({
            where: { organizationId_userId: { organizationId: requested, userId } },
            include: { organization: { select: { name: true } } },
          });
          if (membership) {
            token.organizationId = requested;
            token.organizationName = membership.organization.name;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as { id?: string; organizationId?: string; organizationName?: string };
      if (t.id) session.user.id = t.id;
      if (t.organizationId) session.organizationId = t.organizationId;
      if (t.organizationName) session.organizationName = t.organizationName;
      return session;
    },
  },
});

export interface AuthContext {
  userId: string;
  organizationId: string;
}

/**
 * Recupera o contexto autenticado (usuário + organização) ou lança 401.
 * Todas as queries de dados DEVEM ser filtradas pelo organizationId retornado aqui.
 */
export async function requireAuth(): Promise<AuthContext> {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) {
    const { ApiError } = await import("@/lib/api-utils");
    throw new ApiError(401, "Não autenticado.");
  }
  return { userId: session.user.id, organizationId: session.organizationId };
}

/**
 * Exige que o usuário tenha um dos papéis na organização atual. Use em
 * operações sensíveis (ex.: sincronização que afeta dados globais). Lança
 * 403 se o papel não bastar.
 */
export async function requireRole(
  roles: string[]
): Promise<AuthContext & { role: string }> {
  const ctx = await requireAuth();
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: ctx.organizationId, userId: ctx.userId } },
    select: { role: true },
  });
  if (!membership || !roles.includes(membership.role)) {
    const { ApiError } = await import("@/lib/api-utils");
    throw new ApiError(403, "Ação restrita a administradores da organização.");
  }
  return { ...ctx, role: membership.role };
}

/** Organizações às quais o usuário pertence (para o seletor de organização). */
export async function listUserOrganizations(userId: string) {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: { organization: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({ id: m.organization.id, name: m.organization.name, role: m.role }));
}
