import type { RetrievedChunk } from "./types";

/**
 * System prompt interno do assistente JurisPI AI.
 * Regras jurídicas e de segurança da IA — não alterar sem revisão.
 */
export const SYSTEM_PROMPT = `Você é um assistente especializado em propriedade industrial no Brasil. Você usa dados estruturados da plataforma, documentos enviados pelo usuário, dados públicos importados do INPI e publicações da RPI. Suas respostas são assistivas e não substituem advogado, agente da propriedade industrial ou consulta oficial ao INPI. Não invente dados, status, prazos, processos ou despachos. Quando não houver base suficiente, diga isso claramente. Sempre cite a origem dos dados usados, como Dados Abertos INPI, RPI, documento enviado pelo usuário ou base interna. Sempre indique a data da última importação ou publicação quando disponível. Sempre responda em português do Brasil, com linguagem clara, técnica e objetiva, e destaque próximos passos práticos.`;

export const ASSISTIVE_DISCLAIMER =
  "Análise assistiva gerada por IA. Não substitui advogado, agente da propriedade industrial ou consulta oficial ao INPI.";

export function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "Nenhum documento relevante foi recuperado da base de conhecimento.";
  }
  return chunks
    .map((chunk, i) => {
      const page = chunk.pageNumber ? `, página ${chunk.pageNumber}` : "";
      return `[Fonte ${i + 1}] "${chunk.documentTitle}"${page}\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}

export function buildRagPrompt(
  question: string,
  chunks: RetrievedChunk[],
  structuredContext?: string
): string {
  const structuredBlock = structuredContext
    ? `DADOS ESTRUTURADOS DO INPI (obtidos por ferramentas internas da plataforma — fonte primária para processo, status, titular, classe, data e despacho):

${structuredContext}

---

`
    : "";

  return `${structuredBlock}CONTEXTO RECUPERADO DOS DOCUMENTOS DA ORGANIZAÇÃO (RAG — use para interpretação de documentos, legislação e textos longos):

${formatContext(chunks)}

---

PERGUNTA DO USUÁRIO:
${question}

INSTRUÇÕES:
- Para número de processo, status, titular, classe, data e despacho, use EXCLUSIVAMENTE os dados estruturados do INPI acima (quando presentes) — nunca o RAG nem conhecimento geral.
- Responda com base apenas no contexto fornecido e em conhecimento geral sobre propriedade industrial no Brasil.
- Se não houver base suficiente, diga isso explicitamente.
- Cite as fontes: [Fonte N] para documentos; "Dados Abertos INPI" ou "RPI nº X" para dados estruturados, indicando a data da última importação/publicação quando disponível.
- Não invente número de processo, status, despacho, prazo ou decisão.
- Finalize com uma seção "Próximos passos" com recomendações práticas, incluindo validação oficial no INPI quando pertinente.
- Lembre o usuário de que a análise é assistiva quando fizer sentido.`;
}

export interface TrademarkPromptInput {
  brandName: string;
  niceClasses: string[];
  businessDescription?: string;
  similarTrademarks?: string;
  userNotes?: string;
}

export function buildTrademarkOpinionPrompt(
  input: TrademarkPromptInput,
  chunks: RetrievedChunk[]
): string {
  return `Gere um PARECER PRELIMINAR DE VIABILIDADE DE MARCA com base nos dados abaixo.

DADOS DA MARCA:
- Nome da marca: ${input.brandName}
- Classes de Nice: ${input.niceClasses.length ? input.niceClasses.join(", ") : "não informadas"}
- Descrição do negócio: ${input.businessDescription ?? "não informada"}
- Marcas similares encontradas: ${input.similarTrademarks ?? "nenhuma informada"}
- Observações do usuário: ${input.userNotes ?? "nenhuma"}

DOCUMENTOS DE APOIO RECUPERADOS:
${formatContext(chunks)}

ESTRUTURA OBRIGATÓRIA DO PARECER:
1. Resumo executivo
2. Dados analisados
3. Possíveis riscos (incluindo risco de colisão com marcas anteriores)
4. Pontos de atenção
5. Próximos passos recomendados
6. Limitações da análise
7. Aviso: esta análise é assistiva e não substitui advogado, agente da propriedade industrial ou consulta oficial ao INPI.

REGRAS:
- Não invente processos, registros ou decisões do INPI.
- Se não houver base suficiente para avaliar colisão, diga isso claramente.
- Cite as fontes internas usadas no formato [Fonte N], quando houver.`;
}

export interface PatentPromptInput {
  title: string;
  abstract?: string;
  keywords: string[];
  ipcClasses: string[];
  priorArt?: string;
}

export function buildPatentAnalysisPrompt(
  input: PatentPromptInput,
  chunks: RetrievedChunk[]
): string {
  return `Gere uma ANÁLISE TÉCNICA PRELIMINAR DE PATENTE com base nos dados abaixo.

DADOS DA INVENÇÃO:
- Título: ${input.title}
- Resumo: ${input.abstract ?? "não informado"}
- Palavras-chave: ${input.keywords.length ? input.keywords.join(", ") : "não informadas"}
- Classificação IPC: ${input.ipcClasses.length ? input.ipcClasses.join(", ") : "não informada"}
- Possíveis anterioridades indicadas: ${input.priorArt ?? "nenhuma informada"}

DOCUMENTOS RELACIONADOS RECUPERADOS:
${formatContext(chunks)}

ESTRUTURA OBRIGATÓRIA DA ANÁLISE:
1. Resumo técnico simplificado
2. Campo tecnológico
3. Possíveis anterioridades
4. Riscos
5. Pontos de novidade aparente
6. Próximos passos
7. Limitações da análise (incluindo que não substitui busca de anterioridade formal nem exame do INPI)

REGRAS:
- Não invente documentos de anterioridade, números de patente ou decisões.
- Se não houver base suficiente, diga isso claramente.
- Cite as fontes internas usadas no formato [Fonte N], quando houver.`;
}
