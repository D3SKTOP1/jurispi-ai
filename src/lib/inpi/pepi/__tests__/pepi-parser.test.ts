import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

import {
  parseResultMeta,
  parseTrademarkRows,
  parsePatentRows,
  parseTrademarkDetail,
  parsePatentDetail,
  extractClassCodes,
} from "../pepi-parser";

// Fixtures = HTML REAL capturado do pePI. Se o INPI mudar o layout, estes
// testes quebram — que é exatamente o sinal que queremos (o parser é a peça
// mais frágil, pois depende do HTML de um site sem API oficial).
const FIX = path.join(__dirname, "fixtures");
const load = (f: string) => readFileSync(path.join(FIX, f), "utf8");

describe("pePI parser — marcas", () => {
  it("lê a lista de resultados por nome (NATURA) com paginação", () => {
    const html = load("02-tm-by-name.html");
    const meta = parseResultMeta(html);
    expect(meta.totalCount).toBeGreaterThan(0);
    expect(meta.noResults).toBe(false);

    const rows = parseTrademarkRows(html);
    expect(rows.length).toBeGreaterThan(0);
    const first = rows[0];
    expect(first.codPedido).toMatch(/^\d+$/);
    expect(first.processNumber).toMatch(/\d/);
    expect(first.brandName.length).toBeGreaterThan(0);
  });

  it("lê o resultado por número de processo (822234610 = HYPERON)", () => {
    const rows = parseTrademarkRows(load("03-tm-by-proc.html"));
    expect(rows).toHaveLength(1);
    expect(rows[0].processNumber).toBe("822234610");
    expect(rows[0].brandName).toBe("HYPERON");
    expect(extractClassCodes(rows[0].classText)).toEqual(["05"]);
  });

  it("lê o detalhe completo da marca com classes e despachos", () => {
    const detail = parseTrademarkDetail(load("04-tm-detail.html"));
    expect(detail).not.toBeNull();
    expect(detail!.processNumber).toBe("822234610");
    expect(detail!.brandName).toBe("HYPERON");
    expect(detail!.status).toBe("Arquivado");
    expect(detail!.presentation).toBe("Nominativa");
    expect(detail!.holders.length).toBeGreaterThan(0);
    expect(detail!.depositDate).toBe("12/05/2000");
    expect(detail!.classes.length).toBeGreaterThan(0);
    expect(detail!.classes[0].code).toContain("05");
    // Despachos com descrição e complemento.
    expect(detail!.dispatches.length).toBeGreaterThanOrEqual(4);
    const d = detail!.dispatches[0];
    expect(d.rpiNumber).toMatch(/^\d+$/);
    expect(d.dispatchDescription).toBeTruthy();
  });

  it("detecta 'nenhum resultado' na busca por GRU inválido", () => {
    const meta = parseResultMeta(load("08-tm-by-gru.html"));
    expect(meta.noResults).toBe(true);
  });
});

describe("pePI parser — patentes", () => {
  it("lê a lista por título (colheitadeira)", () => {
    const html = load("06-pt-by-title.html");
    expect(parseResultMeta(html).totalCount).toBeGreaterThan(0);
    const rows = parsePatentRows(html);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].processNumber).toMatch(/BR/);
    expect(rows[0].title.length).toBeGreaterThan(0);
  });

  it("lê o detalhe da patente com campos INID", () => {
    const detail = parsePatentDetail(load("07-pt-detail.html"));
    expect(detail).not.toBeNull();
    expect(detail!.processNumber).toMatch(/BR/);
    expect(detail!.title!.length).toBeGreaterThan(0);
    expect(detail!.depositDate).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(detail!.ipcClasses.length).toBeGreaterThan(0);
    expect(detail!.applicants.length).toBeGreaterThan(0);
  });
});

describe("extractClassCodes", () => {
  it("extrai NCL e classe nacional", () => {
    expect(extractClassCodes("NCL(7) 05")).toEqual(["05"]);
    expect(extractClassCodes("21 : 99")).toEqual(["21"]);
    expect(extractClassCodes(null)).toEqual([]);
  });
});
