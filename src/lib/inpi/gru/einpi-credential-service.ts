import "server-only";

import { prisma } from "@/lib/db";

import { encryptSecret, decryptSecret, maskLogin } from "./credential-vault";
import { GruAuthError, GruUnavailableError, GruSession } from "./gru-client";

export interface EinpiCredentialStatus {
  configured: boolean;
  loginMask: string | null;
  lastVerifiedAt: Date | null;
  lastStatus: string | null;
}

/**
 * Serviço da credencial e-INPI por organização. A senha nunca sai daqui
 * em claro (só é decifrada internamente para o cliente GRU). A UI recebe
 * apenas máscara + status.
 */
export class EinpiCredentialService {
  /** Salva/atualiza a credencial (cifrando login e senha). */
  async save(organizationId: string, login: string, senha: string): Promise<void> {
    const loginEncrypted = encryptSecret(login.trim());
    const senhaEncrypted = encryptSecret(senha);
    await prisma.inpiEinpiCredential.upsert({
      where: { organizationId },
      create: {
        organizationId,
        loginEncrypted,
        senhaEncrypted,
        loginMask: maskLogin(login),
      },
      update: {
        loginEncrypted,
        senhaEncrypted,
        loginMask: maskLogin(login),
        lastVerifiedAt: null,
        lastStatus: null,
      },
    });
  }

  /**
   * "Conectar conta INPI": salva a credencial e já autentica ao vivo no
   * INPI, devolvendo o status. Se o login for recusado (INVALID), a
   * credencial NÃO é mantida — evita deixar uma senha errada guardada.
   */
  async connect(
    organizationId: string,
    login: string,
    senha: string
  ): Promise<EinpiCredentialStatus> {
    await this.save(organizationId, login, senha);
    const status = await this.verify(organizationId);
    if (status.lastStatus === "INVALID") {
      await this.remove(organizationId);
      return { configured: false, loginMask: null, lastVerifiedAt: null, lastStatus: "INVALID" };
    }
    return status;
  }

  async remove(organizationId: string): Promise<void> {
    await prisma.inpiEinpiCredential.deleteMany({ where: { organizationId } });
  }

  async status(organizationId: string): Promise<EinpiCredentialStatus> {
    const row = await prisma.inpiEinpiCredential.findUnique({ where: { organizationId } });
    return {
      configured: Boolean(row),
      loginMask: row?.loginMask ?? null,
      lastVerifiedAt: row?.lastVerifiedAt ?? null,
      lastStatus: row?.lastStatus ?? null,
    };
  }

  /** Decifra a credencial para uso interno pelo cliente GRU. */
  async getDecrypted(organizationId: string): Promise<{ login: string; senha: string } | null> {
    const row = await prisma.inpiEinpiCredential.findUnique({ where: { organizationId } });
    if (!row) return null;
    return { login: decryptSecret(row.loginEncrypted), senha: decryptSecret(row.senhaEncrypted) };
  }

  /**
   * Testa o login e-INPI e grava o resultado. Não guarda nada da resposta
   * além do status (OK/INVALID/UNAVAILABLE).
   */
  async verify(organizationId: string): Promise<EinpiCredentialStatus> {
    const creds = await this.getDecrypted(organizationId);
    if (!creds) return this.status(organizationId);

    let status: string;
    try {
      const session = new GruSession();
      await session.login(creds.login, creds.senha);
      status = "OK";
    } catch (error) {
      if (error instanceof GruAuthError) status = "INVALID";
      else if (error instanceof GruUnavailableError) status = "UNAVAILABLE";
      else throw error;
    }

    await prisma.inpiEinpiCredential.update({
      where: { organizationId },
      data: { lastStatus: status, lastVerifiedAt: status === "OK" ? new Date() : undefined },
    });
    return this.status(organizationId);
  }
}

export const einpiCredentialService = new EinpiCredentialService();
