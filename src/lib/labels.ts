/**
 * Mapas de rótulos pt-BR e variantes de badge para os enums do domínio.
 */

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "gold";

export const caseTypeLabels: Record<string, string> = {
  TRADEMARK: "Marca",
  PATENT: "Patente",
  INDUSTRIAL_DESIGN: "Desenho industrial",
  SOFTWARE: "Programa de computador",
  OTHER: "Outro",
};

export const riskLabels: Record<string, string> = {
  LOW: "Baixo",
  MEDIUM: "Médio",
  HIGH: "Alto",
  UNKNOWN: "Indefinido",
};

export const riskVariants: Record<string, BadgeVariant> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "destructive",
  UNKNOWN: "secondary",
};

/**
 * Status predefinidos do ciclo de vida de um processo de PI no INPI.
 * O campo `Case.status` é uma string livre — além destes, o usuário pode
 * digitar um status personalizado no formulário. Use `caseStatusLabel()`
 * para exibir: cai para o valor cru quando for personalizado.
 */
export const caseStatusLabels: Record<string, string> = {
  EM_ANDAMENTO: "Em andamento",
  DEPOSITADO: "Depositado",
  AGUARDANDO_EXAME: "Aguardando exame",
  EM_ANALISE_PREVIA: "Em análise prévia",
  AGUARDANDO_EXAME_TECNICO: "Aguardando exame técnico",
  PUBLICADO: "Publicado (prazo de oposição)",
  EXIGENCIA: "Exigência",
  SOBRESTADO: "Sobrestado",
  DEFERIDO: "Deferido",
  INDEFERIDO: "Indeferido",
  CONCEDIDO: "Concedido / Registrado",
  EM_RECURSO: "Em recurso",
  ARQUIVADO: "Arquivado",
  EXTINTO: "Extinto",
};

/** Rótulo legível para um status: usa o mapa predefinido ou o próprio valor (personalizado). */
export function caseStatusLabel(status: string): string {
  return caseStatusLabels[status] ?? status;
}

export const documentStatusLabels: Record<string, string> = {
  UPLOADED: "Enviado",
  PROCESSING: "Processando",
  READY: "Pronto",
  ERROR: "Erro",
};

export const documentStatusVariants: Record<string, BadgeVariant> = {
  UPLOADED: "secondary",
  PROCESSING: "warning",
  READY: "success",
  ERROR: "destructive",
};

export const documentSourceLabels: Record<string, string> = {
  USER_UPLOAD: "Upload do usuário",
  INPI_OPEN_DATA: "Dados abertos INPI",
  RPI: "RPI",
  LAW: "Legislação",
  MANUAL: "Manual",
  INTERNAL: "Interno",
};

export const alertSeverityLabels: Record<string, string> = {
  INFO: "Informativo",
  WARNING: "Atenção",
  CRITICAL: "Crítico",
};

export const alertSeverityVariants: Record<string, BadgeVariant> = {
  INFO: "secondary",
  WARNING: "warning",
  CRITICAL: "destructive",
};

export const alertStatusLabels: Record<string, string> = {
  OPEN: "Aberto",
  RESOLVED: "Resolvido",
  DISMISSED: "Descartado",
};

export const deadlineStatusLabels: Record<string, string> = {
  PENDING: "Pendente",
  DONE: "Concluído",
  OVERDUE: "Vencido",
};

export const deadlineStatusVariants: Record<string, BadgeVariant> = {
  PENDING: "warning",
  DONE: "success",
  OVERDUE: "destructive",
};

export const generatedDocTypeLabels: Record<string, string> = {
  PRELIMINARY_OPINION: "Parecer preliminar de marca",
  PATENT_ANALYSIS: "Análise preliminar de patente",
  OFFICE_ACTION_RESPONSE: "Resposta à exigência",
  OPPOSITION_DRAFT: "Rascunho de oposição",
  APPEAL_DRAFT: "Rascunho de recurso",
  CLIENT_REPORT: "Relatório para cliente",
  EMAIL: "E-mail explicativo",
  OTHER: "Outro",
};

export const generatedDocStatusLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  REVIEWED: "Revisado",
  FINAL: "Final",
};

export const generatedDocStatusVariants: Record<string, BadgeVariant> = {
  DRAFT: "secondary",
  REVIEWED: "warning",
  FINAL: "success",
};
