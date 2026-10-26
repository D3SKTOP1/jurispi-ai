import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { PortfolioImport } from "@/components/inpi/portfolio-import";

export const metadata = { title: "Importar carteira" };

export default async function ImportPage() {
  const { organizationId } = await getAppSession();
  const clients = await prisma.client.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Importar carteira do INPI</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Traga a carteira de um cliente direto da fonte oficial: informe o CNPJ/CPF ou o nome do
          titular, selecione as marcas e patentes e importe. Cada processo entra como caso e já
          fica em monitoramento — os dados completos são preenchidos ao sincronizar com o INPI.
          Não é preciso exportar nada de outra plataforma.
        </p>
      </div>
      <PortfolioImport clients={clients} />
    </div>
  );
}
