import Link from "next/link";

export const metadata = { title: "Política de Privacidade — JurisPI" };

/**
 * Política de privacidade do MVP (LGPD). Texto-base para operação
 * experimental — revise com profissional jurídico antes de escalar.
 */
export default function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed">
      <h1 className="text-2xl font-semibold">Política de Privacidade</h1>
      <p className="mt-1 text-muted-foreground">Última atualização: 13/07/2026</p>

      <div className="mt-8 space-y-6">
        <section>
          <h2 className="mb-2 text-base font-semibold">1. Quais dados tratamos</h2>
          <ul className="list-inside list-disc space-y-1.5">
            <li>
              <strong>Dados de conta:</strong> nome, e-mail e senha (armazenada apenas como hash
              bcrypt — nunca em texto claro).
            </li>
            <li>
              <strong>Dados do escritório:</strong> clientes, casos, documentos, prazos e alertas
              que você cadastra, isolados por organização (multi-tenant).
            </li>
            <li>
              <strong>Credencial e-INPI (opcional):</strong> login e senha da conta e-INPI do
              escritório, armazenados <strong>cifrados (AES-256-GCM)</strong> e usados
              exclusivamente para autenticar no INPI em seu nome (ex.: GRU). Você pode removê-la a
              qualquer momento em INPI → GRU / e-INPI.
            </li>
            <li>
              <strong>Dados públicos do INPI:</strong> resultados de busca e despachos de
              processos, provenientes das bases públicas (pePI, RPI, Dados Abertos).
            </li>
            <li>
              <strong>Registros de auditoria:</strong> ações relevantes na plataforma (quem fez o
              quê e quando), para segurança e rastreabilidade.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">2. Para que usamos</h2>
          <p>
            Exclusivamente para operar o serviço: autenticação, buscas e monitoramento no INPI,
            geração de prazos e alertas (inclusive por e-mail), análises assistidas por IA e
            suporte. Não vendemos nem compartilhamos dados pessoais com terceiros para fins de
            marketing.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">3. Operadores e infraestrutura</h2>
          <p>
            Usamos provedores de infraestrutura para operar o serviço: hospedagem (Vercel), banco
            de dados (Neon/PostgreSQL), envio de e-mail transacional e provedores de IA para as
            análises assistidas (trechos dos textos analisados são enviados ao provedor de IA para
            gerar a resposta). Esses operadores tratam dados em nosso nome e sob contrato.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">4. Seus direitos (LGPD)</h2>
          <p>
            Você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados, bem
            como revogar consentimentos, pelo contato abaixo. A exclusão da organização remove os
            dados do escritório, incluindo a credencial e-INPI cifrada.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">5. Retenção e segurança</h2>
          <p>
            Mantemos os dados enquanto a conta existir. Senhas com hash bcrypt; credenciais e-INPI
            cifradas com chave dedicada; acesso ao banco restrito; registros de auditoria das
            ações sensíveis. Nenhum sistema é 100% seguro — incidentes relevantes serão
            comunicados conforme a LGPD.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">6. Controlador e contato</h2>
          <p>
            Controlador: operação experimental JurisPI. Contato para assuntos de privacidade:
            vitor@hyperon.com.br.
          </p>
        </section>
      </div>

      <p className="mt-10 flex gap-4">
        <Link href="/termos" className="text-primary underline-offset-2 hover:underline">
          Termos de Uso
        </Link>
        <Link href="/login" className="text-primary underline-offset-2 hover:underline">
          ← Voltar ao login
        </Link>
      </p>
    </div>
  );
}
