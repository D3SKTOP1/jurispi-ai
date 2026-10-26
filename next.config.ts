import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (pdfjs-dist) funciona melhor sem bundling no server.
  serverExternalPackages: ["pdf-parse"],
  // Fixtures de demonstração do INPI são lidos via fs em runtime —
  // precisam entrar no output tracing das rotas de sync (Vercel).
  outputFileTracingIncludes: {
    "/api/inpi/rpi/sync": ["./src/lib/inpi/fixtures/**"],
    "/api/inpi/sync/open-data": ["./src/lib/inpi/fixtures/**"],
  },
};

export default nextConfig;
