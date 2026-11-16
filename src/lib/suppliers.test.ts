import { describe, expect, it } from "vitest";
import { emptySupplierForm, filterSuppliers, findSupplierDuplicates, supplierPayload, validateSupplier, type Supplier } from "./suppliers";

const base = emptySupplierForm();
const sup = (over: Partial<Supplier>): Supplier => ({
  ...({} as Supplier), id: "x", name: "Fornecedor", document: null, contact_name: null, email: null, phone: null, products_supplied: null, active: true, ...over,
});

describe("validação de fornecedores", () => {
  it("exige o nome", () => {
    expect(validateSupplier({ ...base, name: " " }).name).toBeDefined();
    expect(validateSupplier({ ...base, name: "Atacado SP" })).toEqual({});
  });
  it("recusa CNPJ/CPF inválido e telefone sem DDD", () => {
    expect(validateSupplier({ ...base, name: "A", document: "11.222.333/0001-80" }).document).toBe("CNPJ inválido.");
    expect(validateSupplier({ ...base, name: "A", document: "11.222.333/0001-81" }).document).toBeUndefined();
    expect(validateSupplier({ ...base, name: "A", phone: "9123-4567" }).phone).toBeDefined();
    expect(validateSupplier({ ...base, name: "A", email: "x@" }).email).toBe("E-mail inválido.");
  });
  it("envia só dígitos e campos vazios como nulos", () => {
    expect(supplierPayload({ ...base, name: " Atacado ", document: "11.222.333/0001-81", phone: "(11) 3333-4444", email: " A@B.COM " }))
      .toMatchObject({ name: "Atacado", document: "11222333000181", phone: "1133334444", email: "a@b.com", notes: null, active: true });
  });
});

describe("fornecedores repetidos e busca", () => {
  const list = [sup({ id: "a", name: "Atacadão Têxtil", document: "11222333000181", phone: "1133334444", products_supplied: "Camisetas" }), sup({ id: "b", name: "Outro", active: false })];
  it("bloqueia o mesmo CNPJ e avisa sobre o mesmo nome (sem acento)", () => {
    expect(findSupplierDuplicates(list, { ...base, name: "Novo", document: "11.222.333/0001-81" })[0]?.reason).toBe("documento");
    expect(findSupplierDuplicates(list, { ...base, name: "atacadao  textil" })[0]?.reason).toBe("nome");
    expect(findSupplierDuplicates(list, { ...base, name: "Atacadão Têxtil" }, "a")).toEqual([]);
  });
  it("busca por nome, produto fornecido ou parte do telefone, e filtra por situação", () => {
    expect(filterSuppliers(list, "camiseta").map((s) => s.id)).toEqual(["a"]);
    expect(filterSuppliers(list, "3333").map((s) => s.id)).toEqual(["a"]);
    expect(filterSuppliers(list, "", "inativos").map((s) => s.id)).toEqual(["b"]);
    expect(filterSuppliers(list, "", "ativos").map((s) => s.id)).toEqual(["a"]);
  });
});
