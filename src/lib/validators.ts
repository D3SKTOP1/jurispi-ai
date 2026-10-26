import { z } from "zod";

/** Converte string vazia em undefined antes de validar. */
const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const optionalString = z.preprocess(emptyToUndef, z.string().max(2000).optional());
const optionalEmail = z.preprocess(emptyToUndef, z.email("E-mail inválido.").optional());
const optionalDate = z.preprocess(emptyToUndef, z.coerce.date().optional());

/** Aceita array de strings ou string separada por vírgula. */
const stringList = z.preprocess((v) => {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string")
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}, z.array(z.string().max(200)));

export const riskLevelEnum = z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]);
export const caseTypeEnum = z.enum(["TRADEMARK", "PATENT", "INDUSTRIAL_DESIGN", "SOFTWARE", "OTHER"]);

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export const clientCreateSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório.").max(300),
  documentNumber: optionalString,
  email: optionalEmail,
  phone: optionalString,
  notes: optionalString,
});

export const clientUpdateSchema = clientCreateSchema.partial();

// ---------------------------------------------------------------------------
// Processos de PI
// ---------------------------------------------------------------------------

export const caseCreateSchema = z.object({
  clientId: optionalString,
  type: caseTypeEnum,
  title: z.string().min(1, "Título é obrigatório.").max(300),
  processNumber: optionalString,
  status: z.preprocess(emptyToUndef, z.string().max(120).optional()),
  riskLevel: riskLevelEnum.optional(),
  summary: optionalString,
  nextStep: optionalString,
});

export const caseUpdateSchema = caseCreateSchema.partial();

// ---------------------------------------------------------------------------
// Marcas
// ---------------------------------------------------------------------------

export const trademarkCreateSchema = z.object({
  clientId: optionalString,
  title: optionalString,
  processNumber: optionalString,
  status: optionalString,
  riskLevel: riskLevelEnum.optional(),
  brandName: z.string().min(1, "Nome da marca é obrigatório.").max(300),
  niceClasses: stringList,
  presentationType: optionalString,
  nature: optionalString,
  holderName: optionalString,
  applicationDate: optionalDate,
  currentStatus: optionalString,
  collisionRisk: riskLevelEnum.optional(),
});

export const trademarkUpdateSchema = trademarkCreateSchema.partial().extend({
  aiAnalysis: optionalString.optional(),
});

// ---------------------------------------------------------------------------
// Patentes
// ---------------------------------------------------------------------------

export const patentCreateSchema = z.object({
  clientId: optionalString,
  processNumber: optionalString,
  status: optionalString,
  riskLevel: riskLevelEnum.optional(),
  title: z.string().min(1, "Título é obrigatório.").max(500),
  abstract: z.preprocess(emptyToUndef, z.string().max(10_000).optional()),
  ipcClasses: stringList,
  inventors: stringList,
  applicants: stringList,
  filingDate: optionalDate,
  publicationDate: optionalDate,
  grantDate: optionalDate,
  expirationDate: optionalDate,
  currentStatus: optionalString,
});

export const patentUpdateSchema = patentCreateSchema.partial().extend({
  aiAnalysis: optionalString.optional(),
});

// ---------------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------------

export const documentSourceTypeEnum = z.enum([
  "USER_UPLOAD",
  "INPI_OPEN_DATA",
  "RPI",
  "LAW",
  "MANUAL",
  "INTERNAL",
]);

export const documentUploadMetaSchema = z.object({
  title: optionalString,
  clientId: optionalString,
  caseId: optionalString,
  sourceType: documentSourceTypeEnum.optional(),
});

// ---------------------------------------------------------------------------
// IA
// ---------------------------------------------------------------------------

export const chatRequestSchema = z.object({
  conversationId: optionalString,
  caseId: optionalString,
  message: z.string().min(1, "Mensagem é obrigatória.").max(8_000),
});

export const trademarkOpinionRequestSchema = z.object({
  caseId: optionalString,
  brandName: z.string().min(1, "Nome da marca é obrigatório.").max(300),
  niceClasses: stringList,
  businessDescription: z.preprocess(emptyToUndef, z.string().max(5_000).optional()),
  similarTrademarks: z.preprocess(emptyToUndef, z.string().max(5_000).optional()),
  userNotes: z.preprocess(emptyToUndef, z.string().max(5_000).optional()),
});

export const patentAnalysisRequestSchema = z.object({
  caseId: optionalString,
  title: z.string().min(1, "Título é obrigatório.").max(500),
  abstract: z.preprocess(emptyToUndef, z.string().max(10_000).optional()),
  keywords: stringList,
  ipcClasses: stringList,
  priorArt: z.preprocess(emptyToUndef, z.string().max(5_000).optional()),
});

// ---------------------------------------------------------------------------
// Documentos gerados
// ---------------------------------------------------------------------------

export const generatedDocumentUpdateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "REVIEWED", "FINAL"]).optional(),
});

// ---------------------------------------------------------------------------
// Alertas e prazos
// ---------------------------------------------------------------------------

export const alertCreateSchema = z.object({
  caseId: optionalString,
  title: z.string().min(1, "Título é obrigatório.").max(300),
  description: optionalString,
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
  dueDate: optionalDate,
});

export const alertUpdateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: optionalString,
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
  status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]).optional(),
  dueDate: optionalDate,
});

export const deadlineCreateSchema = z.object({
  caseId: optionalString,
  title: z.string().min(1, "Título é obrigatório.").max(300),
  description: optionalString,
  dueDate: z.coerce.date({ error: "Data do prazo é obrigatória." }),
});

export const deadlineUpdateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: optionalString,
  dueDate: optionalDate,
  status: z.enum(["PENDING", "DONE", "OVERDUE"]).optional(),
});

// ---------------------------------------------------------------------------
// Registro de conta de teste
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  name: z.string().min(2, "Informe seu nome.").max(120),
  email: z.email("E-mail inválido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(100),
  organizationName: z
    .string()
    .min(2, "Informe o nome do escritório ou empresa.")
    .max(160),
});

// ---------------------------------------------------------------------------
// Integração INPI
// ---------------------------------------------------------------------------

export const monitoredProcessCreateSchema = z.object({
  processNumber: z.string().min(4, "Número de processo inválido.").max(30),
  type: z.enum(["TRADEMARK", "PATENT"]),
  title: optionalString,
  clientId: optionalString,
  caseId: optionalString,
});

export const monitoredProcessUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  title: optionalString,
});

export const trademarkRiskRequestSchema = z.object({
  brandName: z.string().min(1, "Nome da marca é obrigatório.").max(300),
  niceClasses: stringList,
});

export const rpiSyncRequestSchema = z.object({
  rpiNumber: z.preprocess(emptyToUndef, z.string().max(20).optional()),
});

export const einpiCredentialSchema = z.object({
  login: z.string().min(3, "Login e-INPI é obrigatório.").max(120),
  senha: z.string().min(1, "Senha e-INPI é obrigatória.").max(200),
});

/** Campo opcional do assistente de GRU ("" → undefined). */
const gruField = z.preprocess(emptyToUndef, z.string().max(60).optional());

export const gruEmissionSchema = z.object({
  diretoria: z.string().min(1, "Escolha o tipo de serviço.").max(10),
  serviceCode: z.string().min(1, "Escolha o serviço.").max(10),
  processNumber: z.preprocess(emptyToUndef, z.string().max(30).optional()),
  totalDe: gruField,
  natureza: gruField,
  apresentacao: gruField,
  peticionamento: gruField,
  objetoPeticao: gruField,
  revista: gruField,
  peticaoVinculada: gruField,
  valorMonetario: gruField,
  guiaAnterior: gruField,
  copiaOficial: gruField,
  description: z.preprocess(emptyToUndef, z.string().max(500).optional()),
});

export const gruConsultSchema = z.object({
  gruNumber: z
    .string()
    .min(5, "Número de GRU inválido.")
    .max(20)
    .regex(/^\d+$/, "O número da GRU tem apenas dígitos."),
});

export const gruSyncSchema = z.object({
  /** Dias para trás na pesquisa por data (padrão 90). */
  days: z.number().int().min(1).max(730).optional(),
});

/** Pedido de demonstração vindo da landing page pública. */
export const leadSchema = z.object({
  name: z.string().min(2, "Informe seu nome.").max(120),
  email: z.email("E-mail inválido.").max(200),
  phone: z.preprocess(emptyToUndef, z.string().max(30).optional()),
  firmName: z.preprocess(emptyToUndef, z.string().max(160).optional()),
  message: z.preprocess(emptyToUndef, z.string().max(1000).optional()),
  consent: z.literal(true, "É preciso aceitar a Política de Privacidade."),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email("E-mail inválido.").max(200),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(10, "Token inválido.").max(200),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres.").max(200),
});

export const portfolioSearchSchema = z.object({
  query: z.string().min(3, "Informe CNPJ, CPF ou nome do titular.").max(200),
});

export const portfolioHolderSchema = z.object({
  query: z.string().min(3).max(200),
  pos: z.number().int().min(0).max(9999),
});

export const portfolioImportSchema = z.object({
  clientId: z.preprocess(emptyToUndef, z.string().optional()),
  items: z
    .array(
      z.object({
        processNumber: z.string().min(4).max(40),
        type: z.enum(["TRADEMARK", "PATENT"]),
        title: z.string().max(300).optional().default(""),
        niceClasses: z.array(z.string().max(6)).optional(),
        holderName: z.string().max(300).nullish(),
      })
    )
    .min(1, "Selecione ao menos um processo.")
    .max(500),
});
