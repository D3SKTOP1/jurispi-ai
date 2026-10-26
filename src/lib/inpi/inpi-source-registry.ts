import { prisma } from "@/lib/db";

/**
 * Registro das fontes oficiais conhecidas.
 * baseUrl aponta para o portal público; a coleta é controlada,
 * sem login, sem captcha e sem áreas restritas.
 */
export const DEFAULT_INPI_SOURCES = [
  {
    name: "Dados Abertos INPI",
    type: "OPEN_DATA",
    baseUrl: "https://dadosabertos.inpi.gov.br",
    description:
      "Arquivos públicos de marcas e patentes (CSV/XML) publicados pelo programa de dados abertos do INPI.",
  },
  {
    name: "Revista da Propriedade Industrial (RPI)",
    type: "RPI",
    baseUrl: "https://revistas.inpi.gov.br",
    description:
      "Edições semanais da RPI. XML/TXT para parsing estruturado; PDF como referência oficial e fallback.",
  },
  {
    name: "Busca pePI ao vivo (INPI)",
    type: "PORTAL",
    baseUrl: "https://busca.inpi.gov.br",
    description:
      "Consulta ao vivo à base pública do INPI (pePI), sessão anônima. Fonte oficial e completa (desde 2000); usada sob demanda com fallback para a base importada.",
  },
  {
    name: "Fixtures de demonstração",
    type: "MOCK",
    baseUrl: null,
    description:
      "Arquivos de exemplo embutidos na plataforma para demonstrar o pipeline completo de ingestão sem depender da rede.",
  },
] as const;

/** Garante que as fontes padrão existem (idempotente). */
export async function ensureDefaultSources() {
  for (const source of DEFAULT_INPI_SOURCES) {
    const existing = await prisma.inpiSource.findFirst({
      where: { type: source.type, name: source.name },
      select: { id: true },
    });
    if (!existing) {
      await prisma.inpiSource.create({
        data: {
          name: source.name,
          type: source.type,
          baseUrl: source.baseUrl,
          description: source.description,
        },
      });
    }
  }
  return prisma.inpiSource.findMany({ orderBy: { name: "asc" } });
}

export async function logSync(input: {
  jobId?: string | null;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.inpiSyncLog.create({
      data: {
        jobId: input.jobId ?? null,
        level: input.level,
        message: input.message,
        metadata: input.metadata as never,
      },
    });
  } catch (error) {
    console.error("[inpi] falha ao registrar log de sync:", error);
  }
}
