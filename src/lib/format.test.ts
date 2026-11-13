import { describe, expect, it } from "vitest";
import { decimalInput, parseDecimal } from "./format";

describe("leitura de valores digitados", () => {
  it("entende vírgula como separador decimal", () => {
    expect(parseDecimal("189,90")).toBe(189.9);
    expect(parseDecimal("1.234,56")).toBe(1234.56);
    expect(parseDecimal("R$ 1.234,56")).toBe(1234.56);
  });
  it("entende ponto de milhar sem vírgula", () => {
    expect(parseDecimal("1.234")).toBe(1234);
    expect(parseDecimal("12.5")).toBe(12.5);
  });
  it("recusa texto inválido e vazio", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
    expect(parseDecimal("1,2,3")).toBeNull();
  });
  it("mostra o valor salvo com vírgula para edição", () => {
    expect(decimalInput(1234.5)).toBe("1234,50");
    expect(decimalInput(null)).toBe("");
  });
});
