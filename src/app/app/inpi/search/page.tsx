import { getAppSession } from "@/lib/session";
import { InpiSearchForm } from "@/components/inpi/inpi-search-form";

export const metadata = { title: "Busca INPI" };

export default async function InpiSearchPage() {
  await getAppSession();

  return (
    <div className="space-y-4">
      <InpiSearchForm />
      <p className="text-xs text-muted-foreground">
        A busca vai <span className="font-medium">direto ao INPI</span> (pePI, busca.inpi.gov.br) —
        dados oficiais do momento, inclusive processos recém-depositados. Se o INPI estiver
        instável, a plataforma cai automaticamente na base importada como rede de segurança
        (indicado nos resultados). Você pode desmarcar “ao vivo” para buscar só na base local. Em
        nenhum caso substitui a busca oficial ou parecer de agente da propriedade industrial.
      </p>
    </div>
  );
}
