import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/** Sessão obrigatória em páginas do app: redireciona para /login se ausente. */
export async function getAppSession() {
  const session = await auth();
  if (!session?.user?.id || !session.organizationId) {
    redirect("/login");
  }
  return {
    userId: session.user.id,
    organizationId: session.organizationId,
    organizationName: session.organizationName,
    userName: session.user.name ?? "Usuário",
    userEmail: session.user.email ?? "",
  };
}
