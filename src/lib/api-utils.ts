import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodType } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Handler<T> = (req: NextRequest, ctx: T) => Promise<NextResponse | Response>;

/**
 * Envolve um Route Handler com tratamento padronizado de erros.
 * Nunca expõe stack trace ao cliente.
 */
export function withApi<T = unknown>(handler: Handler<T>): Handler<T> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: "Dados inválidos.",
            issues: error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
          { status: 400 }
        );
      }
      console.error("[api] erro não tratado:", error);
      return NextResponse.json(
        { error: "Erro interno. Tente novamente mais tarde." },
        { status: 500 }
      );
    }
  };
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "Corpo da requisição inválido (JSON esperado).");
  }
  return schema.parse(json);
}

export function notFound(entity = "Registro"): never {
  throw new ApiError(404, `${entity} não encontrado.`);
}
