import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "JurisPI AI — Seu escritório de PI, organizado. Direto do INPI.";

/** Imagem de compartilhamento (WhatsApp/LinkedIn/redes) da landing. */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background:
            "radial-gradient(80% 80% at 50% 0%, hsl(219,55%,18%) 0%, hsl(222,45%,7%) 70%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "rgba(255,255,255,0.08)",
              border: "2px solid hsl(41,55%,52%)",
              fontSize: 34,
            }}
          >
            ⚖️
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>
            JurisPI&nbsp;
            <span style={{ color: "hsl(41,55%,55%)" }}>AI</span>
          </div>
        </div>

        <div
          style={{
            marginTop: 48,
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.15,
            maxWidth: 980,
            display: "flex",
            flexWrap: "wrap",
          }}
        >
          Seu escritório de PI, organizado.
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 68,
            fontWeight: 700,
            color: "hsl(41,55%,55%)",
            display: "flex",
          }}
        >
          Direto do INPI.
        </div>

        <div
          style={{
            marginTop: 40,
            fontSize: 28,
            color: "rgb(170,180,200)",
            display: "flex",
          }}
        >
          Busca, monitoramento, prazos e GRU — criado pelo advogado Marcos Figueiredo Portela.
        </div>
      </div>
    ),
    size
  );
}
