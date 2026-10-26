import { getAppSession } from "@/lib/session";
import { einpiCredentialService } from "@/lib/inpi/gru/einpi-credential-service";
import { gruService } from "@/lib/inpi/gru/gru-service";
import { EinpiCredentialForm } from "@/components/inpi/einpi-credential-form";
import { GruManager, type GruRow } from "@/components/inpi/gru-manager";

export const metadata = { title: "GRU / e-INPI" };

export default async function InpiGruPage() {
  const { organizationId } = await getAppSession();
  const status = await einpiCredentialService.status(organizationId);

  const connected = status.configured && status.lastStatus === "OK";
  const grus: GruRow[] = connected
    ? (await gruService.listGrus(organizationId)).map((g) => ({
        id: g.id,
        gruNumber: g.gruNumber,
        serviceCode: g.serviceCode,
        processNumber: g.processNumber,
        description: g.description,
        amountCents: g.amountCents,
        status: g.status,
        barcode: g.barcode,
        createdAt: g.createdAt.toISOString(),
      }))
    : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Conta INPI e GRU</h1>
        <p className="text-sm text-muted-foreground">
          {connected
            ? "Sua conta INPI está conectada. Emita e acompanhe GRUs direto do INPI."
            : "Conecte a conta e-INPI do escritório para emitir e consultar GRU. A autenticação é feita direto no INPI."}
        </p>
      </div>

      <EinpiCredentialForm
        initial={{
          configured: status.configured,
          loginMask: status.loginMask,
          lastVerifiedAt: status.lastVerifiedAt ? status.lastVerifiedAt.toISOString() : null,
          lastStatus: status.lastStatus,
        }}
      />

      {connected && <GruManager grus={grus} />}
    </div>
  );
}
