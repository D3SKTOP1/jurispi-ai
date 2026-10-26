import { XMLParser } from "fast-xml-parser";

import type { ParsedRpiFile, ParsedRpiDispatchRecord } from "../types";

/**
 * Parser XML para edições da RPI e arquivos estruturados do INPI.
 * O formato de referência aceito:
 *
 * <rpi numero="2799" data="2026-07-07">
 *   <secao codigo="MARCAS" nome="Marcas">
 *     <despacho processo="912345678" codigo="IPAS033" titular="..." titulo="...">
 *       texto do despacho
 *     </despacho>
 *   </secao>
 * </rpi>
 *
 * O parser é tolerante a variações de nome de tag (despacho/dispatch/publicacao).
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

// Tipagem frouxa proposital: XML público pode variar de estrutura.
/* eslint-disable @typescript-eslint/no-explicit-any */

export function parseXml(buffer: Buffer): unknown {
  return parser.parse(buffer.toString("utf-8"));
}

export function parseRpiXml(buffer: Buffer): ParsedRpiFile[] {
  const doc = parser.parse(buffer.toString("utf-8")) as any;
  const rpi = doc?.rpi ?? doc?.revista ?? doc?.RPI;
  if (!rpi) {
    throw new Error("XML de RPI em formato não reconhecido (tag raiz <rpi> ausente).");
  }

  const rpiNumber = String(rpi["@_numero"] ?? rpi["@_number"] ?? "").trim();
  const publishedAt = String(rpi["@_data"] ?? rpi["@_date"] ?? "").trim() || undefined;
  if (!rpiNumber) {
    throw new Error("XML de RPI sem número da edição.");
  }

  const sections = asArray<any>(rpi.secao ?? rpi.section ?? rpi.SECAO);
  const files: ParsedRpiFile[] = [];

  for (const section of sections) {
    const sectionCode = String(section["@_codigo"] ?? section["@_code"] ?? "GERAL").trim();
    const sectionName = String(section["@_nome"] ?? section["@_name"] ?? sectionCode).trim();

    const rawDispatches = asArray<any>(
      section.despacho ?? section.dispatch ?? section.publicacao ?? []
    );

    const dispatches: ParsedRpiDispatchRecord[] = [];
    for (const d of rawDispatches) {
      const processNumber = String(d["@_processo"] ?? d["@_process"] ?? "").trim();
      const text = typeof d === "string" ? d : String(d["#text"] ?? d["@_texto"] ?? "").trim();
      if (!processNumber || !text) continue;
      dispatches.push({
        processNumber,
        dispatchCode: String(d["@_codigo"] ?? d["@_code"] ?? "").trim() || undefined,
        dispatchText: text,
        holderName: String(d["@_titular"] ?? d["@_holder"] ?? "").trim() || undefined,
        title: String(d["@_titulo"] ?? d["@_title"] ?? "").trim() || undefined,
        entityKind: sectionCode.toUpperCase().includes("PATENT") ? "PATENT" : "TRADEMARK",
      });
    }

    files.push({ rpiNumber, publishedAt, sectionCode, sectionName, dispatches });
  }

  return files;
}
