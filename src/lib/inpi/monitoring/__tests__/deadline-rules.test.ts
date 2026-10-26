import { describe, it, expect } from "vitest";

import { deadlineRuleForDispatch } from "../deadline-rules";

describe("deadlineRuleForDispatch", () => {
  it("exigência de marca → 60 dias (art. 159)", () => {
    const r = deadlineRuleForDispatch({
      dispatchText: "Cumpra a EXIGENCIA, observando o complemento.",
      entity: "TRADEMARK",
    });
    expect(r?.kind).toBe("EXIGENCIA");
    expect(r?.days).toBe(60);
  });

  it("exigência de patente → 90 dias", () => {
    const r = deadlineRuleForDispatch({
      dispatchText: "Cumpra a exigência técnica.",
      entity: "PATENT",
    });
    expect(r?.kind).toBe("EXIGENCIA");
    expect(r?.days).toBe(90);
  });

  it("indeferimento → recurso 60 dias (art. 212)", () => {
    const r = deadlineRuleForDispatch({ dispatchText: "Pedido INDEFERIDO.", entity: "TRADEMARK" });
    expect(r?.kind).toBe("RECURSO");
    expect(r?.days).toBe(60);
  });

  it("oposição → manifestação 60 dias", () => {
    const r = deadlineRuleForDispatch({
      dispatchText: "OPOSIÇÃO apresentada por terceiro.",
      entity: "TRADEMARK",
    });
    expect(r?.kind).toBe("MANIFESTACAO_OPOSICAO");
  });

  it("deferimento de marca → pagamento da concessão", () => {
    const r = deadlineRuleForDispatch({ dispatchText: "Pedido DEFERIDO.", entity: "TRADEMARK" });
    expect(r?.kind).toBe("PAGAMENTO_CONCESSAO");
  });

  it("nulidade → manifestação em PAN", () => {
    const r = deadlineRuleForDispatch({
      dispatchText: "Instaurado processo de NULIDADE.",
      entity: "TRADEMARK",
    });
    expect(r?.kind).toBe("MANIFESTACAO_NULIDADE");
  });

  it("arquivamento definitivo NÃO gera prazo", () => {
    const r = deadlineRuleForDispatch({
      dispatchText: "ARQUIVADO o pedido, encerrando a instância administrativa.",
      entity: "TRADEMARK",
    });
    expect(r).toBeNull();
  });

  it("mera notificação NÃO gera prazo", () => {
    const r = deadlineRuleForDispatch({
      dispatchText: "Notificação de publicação de pedido.",
      entity: "TRADEMARK",
    });
    expect(r).toBeNull();
  });
});
