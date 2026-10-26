import Link from "next/link";

export const metadata = { title: "Termos de Uso — JurisPI" };

/**
 * Termos de uso do MVP. Texto-base para operação experimental — antes de
 * captar clientes pagantes, revise com profissional jurídico.
 */
export default function TermosPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold">Termos de Uso</h1>
      <p className="mt-1 text-muted-foreground">Última atualização: 13/07/2026</p>

      <div className="mt-8 space-y-6">
        <section>
          <h2 className="mb-2 text-base font-semibold">1. O que é o JurisPI</h2>
          <p>
            O JurisPI é uma plataforma de apoio à gestão de propriedade industrial: busca e
            monitoramento de processos junto às bases públicas do INPI, organização de casos,
            prazos e documentos, e análises assistidas por inteligência artificial.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">2. Natureza assistiva — não é aconselhamento jurídico</h2>
          <p>
            Todo conteúdo produzido pela plataforma (buscas, análises de risco, prazos estimados,
            pareceres gerados por IA) é <strong>assistivo</strong> e não substitui a consulta
            oficial ao INPI, a contagem oficial de prazos publicados na Revista da Propriedade
            Industrial (RPI), nem o julgamento profissional de agente da propriedade industrial ou
            advogado. A responsabilidade pela conferência e pelas decisões permanece integralmente
            do usuário.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">3. Fontes de dados</h2>
          <p>
            As consultas usam as bases públicas do INPI (pePI, RPI, Dados Abertos). A
            disponibilidade e a exatidão desses sistemas são de responsabilidade do INPI; a
            plataforma pode ficar temporariamente indisponível ou desatualizada quando as fontes
            oficiais estiverem fora do ar ou mudarem de formato.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">4. Conta e credenciais</h2>
          <p>
            Você é responsável por manter a confidencialidade da sua senha. A credencial e-INPI
            que você conectar é usada exclusivamente para autenticar no INPI em nome do seu
            escritório (por exemplo, para emissão e consulta de GRU), fica armazenada cifrada e
            pode ser removida por você a qualquer momento.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">5. Uso aceitável</h2>
          <p>
            É vedado usar a plataforma para coleta massiva/automatizada contra os sistemas do
            INPI além do uso normal do produto, para atividade ilícita, ou para tentar acessar
            dados de outras organizações.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">6. Disponibilidade e alterações</h2>
          <p>
            O serviço é fornecido “como está”, em fase de acesso antecipado (MVP). Funcionalidades
            podem mudar, e podemos suspender o serviço para manutenção. Podemos atualizar estes
            termos; mudanças relevantes serão comunicadas no produto.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">7. Privacidade</h2>
          <p>
            O tratamento de dados pessoais é descrito na{" "}
            <Link href="/privacidade" className="text-primary underline-offset-2 hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">8. Contato</h2>
          <p>Dúvidas sobre estes termos: vitor@hyperon.com.br.</p>
        </section>
      </div>

      <p className="mt-10">
        <Link href="/login" className="text-primary underline-offset-2 hover:underline">
          ← Voltar ao login
        </Link>
      </p>
    </div>
  );
}
