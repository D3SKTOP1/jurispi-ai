import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileQuestion className="h-6 w-6" />
      </span>
      <div>
        <h1 className="text-lg font-semibold">Página não encontrada</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          O endereço não existe ou foi movido.
        </p>
      </div>
      <Button asChild variant="secondary">
        <Link href="/app/dashboard">Ir para o dashboard</Link>
      </Button>
    </div>
  );
}
