# JurisPI AI

Plataforma SaaS de inteligência artificial para a esfera jurídica com foco em **propriedade industrial no Brasil**: marcas, patentes, processos administrativos no INPI, despachos, classificações Nice/IPC, desenhos industriais, programas de computador e legislação.

> ⚖️ **Importante:** a IA da plataforma é **assistiva**. Ela **não substitui** advogado, agente da propriedade industrial ou consulta oficial ao INPI. Todo conteúdo gerado deve ser revisado por profissional habilitado.

## Funcionalidades do MVP

- Autenticação com credenciais (Auth.js) e **multi-tenant por organização** — toda query é isolada por `organizationId`;
- Dashboard com visão geral da carteira (processos, alertas, prazos, documentos, conversas);
- Cadastro de **clientes**, **processos de PI**, **marcas** (classes Nice, apresentação, natureza, risco de colisão) e **patentes** (IPC, inventores, depositantes, datas);
- **Upload de documentos** (PDF/TXT/MD) com extração de texto, chunking e **embeddings em pgvector**;
- **Chat com IA usando RAG**: busca semântica nos documentos da organização (ou de um processo específico), com **respostas citando as fontes internas**;
- Geração assistida de **parecer preliminar de marca** e **análise preliminar de patente**, salvos como documentos editáveis;
- **Alertas** e **prazos** com varredura automática (prazos vencidos → alerta crítico);
- Histórico de conversas, documentos gerados e **logs de auditoria**;
- Estrutura de dados pronta para ingestão futura da **RPI** e dos **dados abertos do INPI** (`InpiProcess`, `InpiDispatch`, `RpiIssue`).

## Stack

| Camada | Tecnologias |
| --- | --- |
| Frontend | Next.js (App Router) · TypeScript · TailwindCSS v4 · shadcn/ui · React Hook Form · Zod · TanStack Query · Lucide |
| Backend | Next.js Route Handlers · Prisma ORM · PostgreSQL + **pgvector** · Redis + **BullMQ** (com fallback inline) · Auth.js (next-auth v5) |
| IA | Camada abstrata `AIProvider` (mock / Anthropic / OpenAI / Gemini) · `EmbeddingService` · `RagService` · `ChatService` · `DocumentGenerationService` · `TrademarkAnalysisService` · `PatentAnalysisService` · `CitationService` |
| Storage | Abstração `FileStorage` — local no MVP, pronta para S3 / R2 / MinIO |

## Como instalar

Pré-requisitos: **Node.js 20+**, **Docker** (para Postgres/Redis) e npm.

```bash
# 1. Instale as dependências
npm install

# 2. Suba PostgreSQL (com pgvector) e Redis
docker compose up -d
```

## Configuração do `.env`

Copie o exemplo e ajuste se necessário:

```bash
cp .env.example .env
```

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | Conexão Postgres. Com o docker-compose: `postgresql://jurispi:jurispi@localhost:5432/jurispi?schema=public` |
| `REDIS_URL` | Conexão Redis para BullMQ. **Deixe vazio** para processar jobs inline (sem worker) |
| `NEXTAUTH_SECRET` | Segredo do Auth.js (gere com `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | URL base da aplicação (`http://localhost:3000`) |
| `AI_PROVIDER` | `mock` (padrão, sem custo) · `anthropic` · `openai` · `gemini` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` | Chaves dos providers reais |
| `STORAGE_PROVIDER` | `local` (MVP) ou `s3` (estrutura pronta) |
| `S3_*` | Credenciais do storage S3/R2/MinIO (uso futuro) |

## Migrations

```bash
# Aplica a migration inicial (cria extensão vector, tabelas e índices)
npm run db:migrate

# Alternativa em desenvolvimento (gera novas migrations a partir do schema)
npm run db:migrate:dev
```

## Seed de demonstração

```bash
npm run db:seed
```

Cria a organização **“Escritório Demo PI”** com 2 usuários, 3 clientes, 3 marcas, 2 patentes, 5 documentos com chunks + embeddings, 2 conversas com citações, 3 alertas, 3 prazos e 2 documentos gerados.

**Login de demonstração:**

| Usuário | E-mail | Senha |
| --- | --- | --- |
| Ana Martins (ADMIN) | `ana@demopi.com.br` | `demo1234` |
| Bruno Costa (MEMBER) | `bruno@demopi.com.br` | `demo1234` |

## Como iniciar

```bash
# Servidor de desenvolvimento
npm run dev
# → http://localhost:3000

# (Opcional) Worker BullMQ — apenas se REDIS_URL estiver configurado
npm run worker
```

Sem `REDIS_URL`, o processamento de documentos e a varredura de prazos rodam **inline** no próprio servidor Next.js — suficiente para o MVP.

## Como funciona o RAG

1. **Upload** (`POST /api/documents/upload`): o arquivo é validado (tipo/tamanho), salvo via `FileStorage` e um job de processamento é enfileirado;
2. **Processamento** (`document-processing-job`): extração de texto (pdf-parse para PDF), normalização e **chunking** (~1.200 caracteres com sobreposição de 200, preservando parágrafos e páginas);
3. **Embeddings** (`embedding-job`): cada chunk recebe um vetor `vector(1536)` gravado no pgvector;
4. **Pergunta** (`POST /api/ai/chat`): o `RagService` gera o embedding da pergunta, busca os chunks mais próximos por **distância de cosseno** (`embedding <=> $query`), sempre filtrando por `organizationId` (e `caseId`, quando o chat é contextualizado a um processo);
5. **Resposta**: os chunks viram contexto do prompt (com o system prompt jurídico interno), o `AIProvider` gera a resposta e o `CitationService` persiste as **citações** (documento, chunk, trecho e página) vinculadas à mensagem;
6. **Formato de retorno**: `{ answer, citations: [{ documentId, chunkId, sourceTitle, quote, pageNumber? }] }`.

> No provider `mock`, os embeddings usam *hashed bag-of-words* determinístico — textos com palavras em comum ficam próximos no espaço vetorial, o que permite demonstrar o RAG sem chave de API.

## Como trocar o provider de IA

1. Defina `AI_PROVIDER` no `.env` (`anthropic`, `openai` ou `gemini`) e a respectiva chave de API;
2. A factory `getAIProvider()` em `src/lib/ai/ai-provider.ts` seleciona a implementação — todos os serviços consomem apenas a interface:

```ts
export interface AIProvider {
  generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
  generateEmbedding(input: GenerateEmbeddingInput): Promise<GenerateEmbeddingOutput>;
}
```

3. Para adicionar um provider novo (ex.: modelo local via Ollama), crie uma classe que implemente `AIProvider` e registre-a na factory.

Observações:
- **Anthropic**: texto real via API Messages; embeddings caem no hash local (a Anthropic não oferece API de embeddings) — combine com OpenAI/outro serviço de embeddings em produção;
- **OpenAI**: texto + embeddings reais (`text-embedding-3-small`, 1536 dims);
- **Gemini**: estrutura pronta, implementação pendente.

## Estrutura do projeto

```
prisma/               schema, migrations e seed
src/app/login         autenticação
src/app/app/*         páginas autenticadas (dashboard, clients, cases, trademarks,
                      patents, documents, ai-chat, generated-documents, alerts,
                      deadlines, settings)
src/app/api/*         Route Handlers (clients, cases, trademarks, patents,
                      documents, ai/chat, ai/generate/*, generated-documents,
                      alerts, deadlines)
src/lib/ai/*          AIProvider, RAG, chat, análises e prompts
src/lib/jobs/*        filas BullMQ, workers e jobs (documentos, embeddings, alertas)
src/lib/storage/*     abstração de storage de arquivos
src/components/*      UI (shadcn) e componentes de feature
```

## Segurança

- Todas as queries filtradas por `organizationId` (isolamento multi-tenant);
- Referências cruzadas validadas por guards (`assertClientInOrg`, `assertCaseInOrg`);
- Inputs validados com Zod em todos os endpoints;
- Upload restrito a PDF/TXT/MD, com limite de 20 MB e nomes sanitizados;
- Rate limit nos endpoints de IA;
- Erros retornam mensagens amigáveis — nunca stack trace;
- Ações relevantes registradas em `AuditLog`;
- Chaves de API usadas apenas no servidor.

## Integração com INPI

A plataforma mantém uma **base própria pesquisável** de dados públicos do INPI, atualizada periodicamente — as buscas dos usuários **nunca** consultam o INPI ao vivo.

### Dados globais × dados da organização

| Globais (compartilhados, nunca duplicados) | Tenant-specific (isolados por `organizationId`) |
| --- | --- |
| Marcas e patentes importadas (`InpiTrademark`, `InpiPatent`) | Clientes, processos internos, documentos enviados |
| Despachos públicos e edições da RPI (`RpiIssue/RpiSection/RpiDispatch`) | Processos monitorados (`MonitoredProcess`) |
| Staging auditável (`InpiSource`, `InpiImportJob`, `InpiRawFile`, `InpiRawRecord`) | Alertas, análises, pareceres, conversas, auditoria |

### Fluxo de ingestão

```
Fontes oficiais → download controlado → storage bruto + checksum (staging)
→ parsing (CSV/XML; PDF como fallback) → normalização (upsert por processNumber)
→ tabelas globais → índices (pg_trgm, FTS português, pgvector preparado)
→ serviços de busca → ferramentas da IA → telas, alertas e pareceres
```

- **Staging**: nenhum arquivo vai direto para as tabelas finais. Cada importação registra `InpiImportJob` → `InpiRawFile` (checksum SHA-256 impede reimportação) → `InpiRawRecord` (com `rawData` preservado para auditoria e reprocessamento).
- **Normalização**: nomes ganham forma minúscula/sem acentos (`normalizedName`), datas são convertidas com tolerância, classes/requerentes viram tabelas filhas. Upsert por `processNumber`; despachos deduplicados por `processNumber + rpiNumber + dispatchCode + dispatchText`.

### Busca de marcas e patentes

- **Marcas**: exata/normalizada, similaridade trigram (`pg_trgm` com índice GIN), radical, classe Nice, titular, nº de processo e status — mais `analyzeTrademarkRisk`, heurística determinística de risco (marca idêntica/similar, classe igual, status ativo, despachos contenciosos) com score, motivos e disclaimer.
- **Patentes**: nº de processo, título, depositante, inventor, IPC e **full-text search em português** (título + resumo, índice GIN). Busca semântica com pgvector fica preparada (`preparePatentSemanticSearch` + job `generateInpiEmbeddings`).

### Monitoramento da RPI

A RPI é a fonte principal de acompanhamento: cada edição sincronizada é parseada (XML/TXT; PDF é referência oficial), os despachos são cruzados com `MonitoredProcess` e **alertas são criados por organização** com RPI, seção, data, texto do despacho, fonte e link. `generateDispatchSummary` gera resumo assistivo por IA.

### Uso pela IA

O chat executa **ferramentas internas** (`src/lib/inpi/ai-tools`) antes de responder: perguntas com marcas, classes ou números de processo disparam `searchTrademarkSimilarityTool`, `analyzeTrademarkRiskTool`, `getRpiDispatchTool` etc., e o resultado (com fonte e data da última importação) entra no prompt como contexto verificável. O RAG segue responsável por documentos e textos longos — **dados estruturados (processo, status, titular, classe, despacho) nunca vêm do RAG**.

### Workers e sincronização manual

```bash
npm run worker:inpi        # workers BullMQ das 7 filas INPI (requer REDIS_URL)
npm run db:seed:inpi       # demonstração: pipeline completo sobre fixtures embutidos
```

Sem Redis, os jobs rodam inline em background. Na UI: **Base INPI → Visão geral** tem os botões “Sincronizar dados abertos” e “Descobrir novas edições” (RPI); cada edição tem seu botão de sync. Via API: `POST /api/inpi/sync/open-data` e `POST /api/inpi/rpi/sync`.

### Limitações e conduta

- Sem scraping autenticado, sem quebra de captcha, sem coleta de documentos restritos — documentos que exigem login/GRU devem ser enviados pelo usuário (upload do PDF oficial);
- A cobertura da base importada pode ser parcial: toda análise indica a fonte e a data da última importação e recomenda validação oficial no INPI;
- O MVP demonstra o pipeline com fixtures embutidos; os downloads oficiais são plugáveis nas fontes (`InpiSource.baseUrl`).

### API oficial futura (Portal de Serviços)

O `PortalProvider` (`src/lib/inpi/providers/portal-provider.ts`) implementa a mesma interface `InpiProvider` dos demais providers, hoje mockado. Quando a API oficial for publicada, basta implementar as chamadas HTTP nele — serviços, telas e tools da IA não mudam.

## Próximos passos recomendados

1. **Fontes oficiais ao vivo**: apontar `InpiSource.baseUrl` para os arquivos reais de dados abertos e implementar a descoberta de edições em revistas.inpi.gov.br;
2. **Embeddings de produção**: provider dedicado de embeddings (OpenAI/Voyage) + re-ranking;
3. **Exportação de documentos** gerados para PDF/DOCX;
4. **Permissões por papel** (ADMIN/MEMBER) e convites de usuários;
5. **Storage S3/R2** implementando o adaptador já estruturado;
6. **Rate limit distribuído** (Redis) e observabilidade (logs estruturados, tracing);
7. **Testes**: unitários para serviços de IA/chunking e e2e (Playwright) para os fluxos críticos;
8. **Monitoramento de marcas de terceiros** (colidência proativa sobre novas publicações da RPI).
