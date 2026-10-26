import Link from "next/link";

import { prisma } from "@/lib/db";
import { getAppSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";

export const metadata = { title: "Clientes" };

export default async function ClientsPage() {
  const { organizationId } = await getAppSession();

  const clients = await prisma.client.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { cases: true, documents: true } } },
  });

  return (
    <div>
      <PageHeader title="Clientes" description="Titulares e requerentes atendidos pela organização.">
        <ClientFormDialog />
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Nome</TableHead>
                <TableHead>CPF / CNPJ</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Processos</TableHead>
                <TableHead>Documentos</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-14" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhum cliente cadastrado. Crie o primeiro cliente para começar.
                  </TableCell>
                </TableRow>
              )}
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/app/clients/${client.id}`} className="hover:underline">
                      {client.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.documentNumber ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{client.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{client._count.cases}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{client._count.documents}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(client.createdAt)}
                  </TableCell>
                  <TableCell>
                    <ClientFormDialog client={client} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
