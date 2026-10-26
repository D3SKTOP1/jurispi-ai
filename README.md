# JurisPI AI

**Multi-tenant SaaS that brings AI to intellectual-property law in Brazil** — trademarks, patents and filings at INPI (the Brazilian patent and trademark office).

Lawyers upload their case documents, ask questions in plain language and get answers **grounded in their own files, with citations**. The platform also keeps a searchable mirror of INPI's public data, monitors the official gazette for changes on tracked cases and raises deadline alerts.

> The AI is assistive: it drafts and searches, a licensed professional reviews.

**Live demo:** https://jurispi-ai.vercel.app · *Portuguese docs: [README.pt-BR.md](README.pt-BR.md)*

---

## Highlights

- **RAG with citations** — PDF/TXT/MD upload → text extraction → paragraph-aware chunking (~1,200 chars, 200 overlap) → embeddings in **pgvector** → cosine search filtered by tenant → answer with `{ documentId, chunkId, quote, page }` citations.
- **Strict multi-tenancy** — every query is scoped by `organizationId`, cross-references are checked by guards (`assertClientInOrg`, `assertCaseInOrg`), every relevant action is written to an audit log.
- **Provider-agnostic AI layer** — one `AIProvider` interface with Anthropic, OpenAI and a deterministic mock (hashed bag-of-words embeddings), so the whole app runs and demos without an API key.
- **Public-data ingestion pipeline** — official sources → raw storage with SHA-256 checksum (no double imports) → CSV/XML parsing → normalization and upsert → global tables indexed with `pg_trgm`, Portuguese full-text search and pgvector.
- **Agentic chat** — before answering, the model calls internal tools (trademark similarity search, risk analysis, gazette lookups) instead of guessing.
- **Background jobs** — BullMQ queues for document processing, embeddings, deadline sweeps and data sync, with an inline fallback when Redis isn't configured.

## Architecture

```
Next.js (App Router, RSC) ──► Route Handlers ──► Services (RAG, Chat, Analysis)
        │                           │                     │
        │                           ▼                     ▼
        │                     Prisma ORM            AIProvider (Anthropic | OpenAI | mock)
        │                           │
        ▼                           ▼
   Auth.js (JWT)        PostgreSQL + pgvector + pg_trgm ◄── BullMQ workers ◄── Redis
                                    ▲
                                    └── INPI ingestion: download → staging → parse → normalize → upsert
```

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js · TypeScript · Tailwind CSS v4 · shadcn/ui · React Hook Form · Zod · TanStack Query |
| Backend | Next.js Route Handlers · Prisma · PostgreSQL + pgvector · Redis + BullMQ · Auth.js v5 |
| AI | Anthropic / OpenAI behind one interface · RAG · tool calling |
| Infra | Docker Compose (local) · Vercel |

## Run locally

```bash
npm install
docker compose up -d          # Postgres (pgvector) + Redis
cp .env.example .env          # AI_PROVIDER=mock works without any key
npm run db:migrate
npm run db:seed               # demo org with clients, cases, documents and chats
npm run dev                   # http://localhost:3000
```

Demo users are created by the seed (see `prisma/seed.ts`).

## Security notes

- Zod validation on every endpoint, uploads limited by type and size with sanitized names
- Rate limiting on AI endpoints, API keys only on the server
- Friendly error messages, never stack traces

---

Built by **Vitor Portela** — [LinkedIn](https://www.linkedin.com/in/mvitorportela/)
