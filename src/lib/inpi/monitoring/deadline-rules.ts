/**
 * Regras de prazo a partir de despachos da RPI.
 *
 * Traduz um despacho publicado (texto + código) no prazo legal que ele
 * inicia, para gerar um Deadline automático. É ASSISTIVO: o prazo é uma
 * ESTIMATIVA a partir da data de publicação na RPI e do fundamento legal;
 * a contagem oficial deve ser sempre conferida na própria RPI. Por isso só
 * cobrimos atos de prazo bem estabelecido e uniforme.
 *
 * Os prazos são majoritariamente de 60 dias (marcas, LPI). A exigência
 * técnica de PATENTE é de 90 dias — tratada quando o contexto é de patente.
 */

export interface DeadlineRule {
  /** Chave estável do tipo de prazo (para dedupe/relatórios). */
  kind: string;
  /** Título legível do prazo. */
  label: string;
  /** Dias corridos a partir da data de publicação na RPI. */
  days: number;
  /** Fundamento legal citado na descrição. */
  basis: string;
}

/** Marca vs patente muda o prazo de exigência (60 × 90 dias). */
export type DispatchEntity = "TRADEMARK" | "PATENT" | "UNKNOWN";

/**
 * Retorna a regra de prazo para um despacho, ou null quando o despacho não
 * inicia prazo acionável (ex.: arquivamento definitivo, mera anotação).
 * A ordem importa: casos mais específicos primeiro.
 */
export function deadlineRuleForDispatch(input: {
  dispatchText: string;
  dispatchCode?: string | null;
  entity?: DispatchEntity;
}): DeadlineRule | null {
  const text = (input.dispatchText ?? "").normalize("NFC");
  const entity = input.entity ?? "UNKNOWN";

  // Indeferimento → prazo de recurso (60 dias, art. 212 LPI).
  if (/\bindefer/i.test(text) || /negad[oa]\s+provimento/i.test(text)) {
    return {
      kind: "RECURSO",
      label: "Recurso contra indeferimento",
      days: 60,
      basis: "art. 212 da LPI (60 dias)",
    };
  }

  // Exigência → prazo de cumprimento. Marca/geral 60 dias; patente 90 dias.
  if (/\bexig[êe]ncia/i.test(text)) {
    const isPatent = entity === "PATENT";
    return {
      kind: "EXIGENCIA",
      label: "Cumprimento de exigência",
      days: isPatent ? 90 : 60,
      basis: isPatent
        ? "art. 34–36 da LPI (90 dias — exigência técnica de patente)"
        : "art. 159 da LPI (60 dias)",
    };
  }

  // Oposição apresentada / manifestação sobre oposição (60 dias).
  if (/\boposi[cç][aã]o/i.test(text)) {
    return {
      kind: "MANIFESTACAO_OPOSICAO",
      label: "Manifestação sobre oposição",
      days: 60,
      basis: "art. 158, §1º da LPI (60 dias)",
    };
  }

  // Instauração de nulidade / caducidade → manifestação (60 dias).
  if (/\bnulidade\b/i.test(text) || /\bcaducidade\b/i.test(text)) {
    return {
      kind: "MANIFESTACAO_NULIDADE",
      label: "Manifestação em processo administrativo",
      days: 60,
      basis: "art. 168 da LPI (60 dias)",
    };
  }

  // Deferimento de marca → pagamento da concessão (60 dias, art. 162 LPI).
  if (/\bdeferi(d[oa]|mento)\b/i.test(text) && entity !== "PATENT") {
    return {
      kind: "PAGAMENTO_CONCESSAO",
      label: "Pagamento da concessão do registro",
      days: 60,
      basis: "art. 162 da LPI (60 dias, prorrogável +30)",
    };
  }

  return null;
}

/** Aviso padrão anexado a todo prazo gerado automaticamente. */
export const AUTO_DEADLINE_DISCLAIMER =
  "Prazo ESTIMADO automaticamente a partir da data de publicação na RPI e do fundamento legal. " +
  "Confirme sempre a contagem oficial na própria RPI — a plataforma auxilia, não substitui a conferência do agente.";
