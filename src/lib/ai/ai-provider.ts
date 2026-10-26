import crypto from "crypto";

import {
  EMBEDDING_DIMENSIONS,
  type GenerateEmbeddingInput,
  type GenerateEmbeddingOutput,
  type GenerateTextInput,
  type GenerateTextOutput,
} from "./types";

/**
 * Camada abstrata de provider de IA.
 * Implementações: mock (padrão para desenvolvimento), Anthropic (Claude),
 * OpenAI e Gemini (estrutura pronta).
 */
export interface AIProvider {
  generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
  generateEmbedding(input: GenerateEmbeddingInput): Promise<GenerateEmbeddingOutput>;
}

// ---------------------------------------------------------------------------
// Mock provider — desenvolvimento local, sem custo e sem chave de API.
// ---------------------------------------------------------------------------

/**
 * Embedding determinístico por "bag of words" com hashing.
 * Textos que compartilham palavras produzem vetores próximos, o que permite
 * demonstrar a busca semântica com pgvector sem chamar uma API real.
 */
export function hashedBagOfWordsEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const words = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);

  for (const word of words) {
    const digest = crypto.createHash("md5").update(word).digest();
    const index = digest.readUInt32BE(0) % EMBEDDING_DIMENSIONS;
    const sign = digest[4] % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  const norm = Math.sqrt(vector.reduce((acc, v) => acc + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

class MockAIProvider implements AIProvider {
  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const hasContext =
      input.prompt.includes("[Fonte 1]") &&
      !input.prompt.includes("Nenhum documento relevante foi recuperado");

    const sources = hasContext
      ? "As fontes internas recuperadas foram consideradas nesta resposta simulada (ver [Fonte 1] e seguintes)."
      : "Não foram recuperados documentos internos relevantes; portanto, não há base suficiente nos documentos da organização para afirmações específicas.";

    const text = `> Resposta gerada pelo provider MOCK (desenvolvimento). Configure AI_PROVIDER=anthropic ou openai no .env para respostas reais.

**Análise assistiva**

${sources}

Com base nas informações fornecidas, esta é uma análise preliminar de caráter assistivo sobre o tema consultado em propriedade industrial. Nenhum número de processo, status, despacho, prazo ou decisão foi verificado em fonte oficial nesta simulação.

**Pontos de atenção**
- Verifique os dados diretamente nas fontes oficiais do INPI (busca de marcas, patentes e acompanhamento de processos).
- Documentos internos citados devem ser revisados por um profissional habilitado.

**Próximos passos**
1. Revisar os documentos vinculados ao caso na plataforma.
2. Confirmar informações na base oficial do INPI.
3. Submeter a análise à revisão de advogado ou agente da propriedade industrial.

*Análise assistiva. Não substitui advogado, agente da propriedade industrial ou consulta oficial ao INPI.*`;

    return { text, model: "mock-provider" };
  }

  async generateEmbedding(input: GenerateEmbeddingInput): Promise<GenerateEmbeddingOutput> {
    return {
      embedding: hashedBagOfWordsEmbedding(input.text),
      model: "mock-hashed-bow",
      dimensions: EMBEDDING_DIMENSIONS,
    };
  }
}

// ---------------------------------------------------------------------------
// Anthropic (Claude) — texto real; embeddings caem no hash local,
// pois a Anthropic não oferece API de embeddings.
// ---------------------------------------------------------------------------

class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private model = "claude-sonnet-5";

  constructor() {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY não configurada no .env.");
    this.apiKey = key;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: input.maxTokens ?? 2048,
        temperature: input.temperature ?? 0.3,
        system: input.system,
        messages: [{ role: "user", content: input.prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Erro na API Anthropic (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
      model: string;
    };
    const text = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");
    return { text, model: data.model };
  }

  async generateEmbedding(input: GenerateEmbeddingInput): Promise<GenerateEmbeddingOutput> {
    // A Anthropic não oferece embeddings; usa hash local determinístico.
    return {
      embedding: hashedBagOfWordsEmbedding(input.text),
      model: "mock-hashed-bow",
      dimensions: EMBEDDING_DIMENSIONS,
    };
  }
}

// ---------------------------------------------------------------------------
// OpenAI — texto + embeddings reais.
// ---------------------------------------------------------------------------

class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private chatModel = "gpt-4o-mini";
  private embeddingModel = "text-embedding-3-small";

  constructor() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY não configurada no .env.");
    this.apiKey = key;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.chatModel,
        temperature: input.temperature ?? 0.3,
        max_tokens: input.maxTokens ?? 2048,
        messages: [
          ...(input.system ? [{ role: "system", content: input.system }] : []),
          { role: "user", content: input.prompt },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Erro na API OpenAI (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      model: string;
    };
    return { text: data.choices[0]?.message?.content ?? "", model: data.model };
  }

  async generateEmbedding(input: GenerateEmbeddingInput): Promise<GenerateEmbeddingOutput> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: input.text,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Erro na API OpenAI embeddings (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { data: Array<{ embedding: number[] }>; model: string };
    return {
      embedding: data.data[0].embedding,
      model: data.model,
      dimensions: EMBEDDING_DIMENSIONS,
    };
  }
}

// ---------------------------------------------------------------------------
// Gemini — estrutura pronta para implementação futura.
// ---------------------------------------------------------------------------

class GeminiProvider implements AIProvider {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY não configurada no .env.");
    }
  }

  async generateText(): Promise<GenerateTextOutput> {
    throw new Error("Provider Gemini ainda não implementado. Use mock, anthropic ou openai.");
  }

  async generateEmbedding(): Promise<GenerateEmbeddingOutput> {
    throw new Error("Provider Gemini ainda não implementado. Use mock, anthropic ou openai.");
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let providerInstance: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    const name = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
    switch (name) {
      case "anthropic":
      case "claude":
        providerInstance = new AnthropicProvider();
        break;
      case "openai":
        providerInstance = new OpenAIProvider();
        break;
      case "gemini":
        providerInstance = new GeminiProvider();
        break;
      default:
        providerInstance = new MockAIProvider();
    }
  }
  return providerInstance;
}
