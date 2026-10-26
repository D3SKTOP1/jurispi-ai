"use client";

import { useEffect } from "react";

/**
 * Boundary de último recurso (erro no layout raiz). Precisa renderizar
 * <html>/<body> próprios e não depender de componentes do app.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4f6f7",
          color: "#10212a",
        }}
      >
        <div style={{ textAlign: "center", padding: 32, maxWidth: 480 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Algo deu errado</h1>
          <p style={{ fontSize: 14, color: "#45585f", marginBottom: 20 }}>
            Erro inesperado na aplicação. Seus dados não foram afetados.
            {error.digest ? ` Código: ${error.digest}.` : ""}
          </p>
          <button
            onClick={reset}
            style={{
              background: "#0d5c6b",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
