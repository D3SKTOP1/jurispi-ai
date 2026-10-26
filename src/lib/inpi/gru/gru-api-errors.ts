import "server-only";

import { ApiError } from "@/lib/api-utils";

import { GruAuthError, GruRejectedError, GruUnavailableError } from "./gru-client";
import { GruNoCredentialError } from "./gru-service";

/**
 * Converte erros do portal GRU em ApiError (mensagem amigável + status),
 * para as rotas não vazarem 500 genérico em falhas esperadas.
 */
export async function withGruApi<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (error) {
    if (error instanceof GruNoCredentialError) throw new ApiError(409, error.message);
    if (error instanceof GruAuthError)
      throw new ApiError(409, "Login e-INPI recusado. Reconecte a conta em INPI → GRU / e-INPI.");
    if (error instanceof GruRejectedError) throw new ApiError(422, error.message);
    if (error instanceof GruUnavailableError)
      throw new ApiError(503, "O portal do INPI não respondeu. Tente novamente em instantes.");
    throw error;
  }
}
