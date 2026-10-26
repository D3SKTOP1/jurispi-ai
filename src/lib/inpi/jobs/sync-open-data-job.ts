import { OpenDataProvider } from "../providers/open-data-provider";
import { logSync } from "../inpi-source-registry";

/**
 * Sincroniza as fontes de dados abertos DE DEMONSTRAÇÃO (fixtures).
 * Usado apenas em desenvolvimento/seed — em produção a base é alimentada
 * pela RPI real (ver rpi-ingest.ts). Exige INPI_ENABLE_FIXTURES=true ou
 * `allowFixtures` explícito (caminho do seed).
 */
export async function syncOpenDataSources(options?: {
  allowFixtures?: boolean;
}): Promise<{
  trademarks: { importJobId: string; created: number; skipped: boolean };
  patents: { importJobId: string; created: number; skipped: boolean };
}> {
  const fixturesEnabled =
    options?.allowFixtures === true || process.env.INPI_ENABLE_FIXTURES === "true";
  if (!fixturesEnabled) {
    throw new Error(
      "Importação de demonstração desabilitada. A base é alimentada pela RPI oficial — use a atualização da base INPI."
    );
  }

  const provider = new OpenDataProvider();

  const trademarks = await provider.runImport({
    entityType: "TRADEMARK",
    fixtureFile: "dados-abertos-marcas.csv",
  });

  const patents = await provider.runImport({
    entityType: "PATENT",
    fixtureFile: "dados-abertos-patentes.csv",
  });

  await logSync({
    level: "INFO",
    message: `Sync de dados abertos concluído (marcas: ${trademarks.created}, patentes: ${patents.created}).`,
  });

  return { trademarks, patents };
}

/** Importa um arquivo público específico por URL (coleta controlada). */
export async function downloadInpiFile(
  url: string,
  entityType: "TRADEMARK" | "PATENT"
): Promise<{ importJobId: string; created: number; skipped: boolean }> {
  const provider = new OpenDataProvider();
  return provider.runImport({ entityType, fileUrl: url });
}
