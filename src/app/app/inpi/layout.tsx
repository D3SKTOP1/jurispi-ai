import { InpiNav } from "@/components/inpi/inpi-nav";

export default function InpiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Base INPI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados públicos importados do INPI e da RPI — compartilhados pela plataforma, com
          monitoramento e alertas por organização.
        </p>
      </div>
      <InpiNav />
      {children}
    </div>
  );
}
