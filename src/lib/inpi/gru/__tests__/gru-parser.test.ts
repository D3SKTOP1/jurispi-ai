import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

import {
  cleanInpiMessages,
  mapGruStatus,
  parseFinalizadaHtml,
  parseMinhasGrusHtml,
  parseMoneyToCents,
} from "../gru-client";

// Fixtures = estrutura REAL das telas autenticadas do portal de GRU
// (meu.inpi.gov.br/pag), com dados de conta trocados por fictícios. Se o
// INPI mudar o layout, estes testes quebram — é o alarme que queremos.
const FIX = path.join(__dirname, "fixtures");
const load = (f: string) => readFileSync(path.join(FIX, f), "utf8");

describe("GRU — parseMinhasGrusHtml", () => {
  it("extrai as linhas da tabela de resultados", () => {
    const rows = parseMinhasGrusHtml(load("minhasgrus-result.html"));
    expect(rows).toHaveLength(2);

    expect(rows[0]).toMatchObject({
      gruNumber: "29400000000000001",
      status: "PENDING",
      statusText: "Aguardando pagamento",
      serviceCode: "389",
      amountCents: 44000,
      issuedAtText: "14/07/2026",
    });
    expect(rows[0].serviceLabel).toContain("Pedido de registro de marca");

    expect(rows[1]).toMatchObject({
      gruNumber: "29400000000000002",
      status: "PAID",
      serviceCode: "800",
      amountCents: 123456,
      issuedAtText: "02/06/2026",
    });
  });

  it("devolve vazio quando não há seção de resultado (nenhuma GRU)", () => {
    expect(parseMinhasGrusHtml("<html><body>sem resultado</body></html>")).toEqual([]);
  });
});

describe("GRU — parseFinalizadaHtml", () => {
  it("extrai número da GRU e código interno do boleto", () => {
    expect(parseFinalizadaHtml(load("finalizada.html"))).toEqual({
      gruNumber: "29400000000000001",
      boletoCode: "1390001",
    });
  });
});

describe("GRU — parseMoneyToCents", () => {
  it("aceita os formatos do portal", () => {
    expect(parseMoneyToCents("R$ 440.00")).toBe(44000);
    expect(parseMoneyToCents("440,00")).toBe(44000);
    expect(parseMoneyToCents("1.234,56")).toBe(123456);
    expect(parseMoneyToCents("R$ 1.234.56")).toBe(123456);
    expect(parseMoneyToCents("70")).toBe(7000);
    expect(parseMoneyToCents("")).toBeUndefined();
  });
});

describe("GRU — mapGruStatus", () => {
  it("normaliza as situações conhecidas", () => {
    expect(mapGruStatus("Aguardando pagamento")).toBe("PENDING");
    expect(mapGruStatus("Pagamento confirmado")).toBe("PAID");
    expect(mapGruStatus("Paga")).toBe("PAID");
    expect(mapGruStatus("Vencida")).toBe("EXPIRED");
    expect(mapGruStatus("Cancelada")).toBe("CANCELLED");
    expect(mapGruStatus("algo novo")).toBe("UNKNOWN");
  });
});

describe("GRU — cleanInpiMessages", () => {
  it("remove os '???' das mensagens do INPI", () => {
    expect(
      cleanInpiMessages([
        { message: "???Processo inválido???", category: "erro" },
        { message: "  ", category: "erro" },
      ])
    ).toBe("Processo inválido");
  });
});
