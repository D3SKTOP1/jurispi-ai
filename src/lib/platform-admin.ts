/**
 * Admin da PLATAFORMA (superadmin) — diferente do papel ADMIN por
 * organização (RBAC). Vê dados de todos os escritórios (painel /app/admin).
 *
 * Liberado por e-mail: env PLATFORM_ADMIN_EMAILS (separados por vírgula).
 * Sem a env, vale o dono da conta Vercel/deploy.
 */
const DEFAULT_ADMINS = ["manoelvalencia25@gmail.com"];

export function platformAdminEmails(): string[] {
  const env = process.env.PLATFORM_ADMIN_EMAILS;
  const list = env
    ? env.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_ADMINS;
  return list;
}

export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return platformAdminEmails().includes(email.toLowerCase().trim());
}
