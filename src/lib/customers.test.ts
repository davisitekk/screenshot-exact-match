import { describe, expect, it } from "vitest";
import { customerPayload, emptyCustomerForm, filterCustomers, findPossibleDuplicates, validateCustomer, type Customer } from "./customers";

const base = emptyCustomerForm();
const cust = (over: Partial<Customer>): Customer => ({ ...({} as Customer), id: "x", name: "Fulano", document: null, email: null, phone: null, whatsapp: null, city: null, ...over });

describe("validação de clientes", () => {
  it("exige o nome", () => {
    expect(validateCustomer({ ...base, name: "  " }).name).toBeDefined();
    expect(validateCustomer({ ...base, name: "Ana" })).toEqual({});
  });
  it("recusa CPF/CNPJ inválido ou com tamanho errado", () => {
    expect(validateCustomer({ ...base, name: "Ana", document: "529.982.247-24" }).document).toBe("CPF inválido.");
    expect(validateCustomer({ ...base, name: "Ana", document: "11.222.333/0001-80" }).document).toBe("CNPJ inválido.");
    expect(validateCustomer({ ...base, name: "Ana", document: "12345" }).document).toBe("CPF tem 11 dígitos e CNPJ 14.");
    expect(validateCustomer({ ...base, name: "Ana", document: "529.982.247-25" }).document).toBeUndefined();
  });
  it("exige DDD no telefone e 8 dígitos no CEP", () => {
    expect(validateCustomer({ ...base, name: "Ana", whatsapp: "91234-5678" }).whatsapp).toBeDefined();
    expect(validateCustomer({ ...base, name: "Ana", whatsapp: "(11) 91234-5678" }).whatsapp).toBeUndefined();
    expect(validateCustomer({ ...base, name: "Ana", zip: "0131" }).zip).toBeDefined();
    expect(validateCustomer({ ...base, name: "Ana", zip: "01310-100" }).zip).toBeUndefined();
  });
  it("recusa nascimento no futuro", () => {
    expect(validateCustomer({ ...base, name: "Ana", birth_date: "2026-11-17" }, "2026-11-16").birth_date).toBeDefined();
    expect(validateCustomer({ ...base, name: "Ana", birth_date: "1990-05-01" }, "2026-11-16").birth_date).toBeUndefined();
  });
  it("envia só dígitos e campos vazios como nulos", () => {
    const p = customerPayload({ ...base, name: " Ana ", document: "529.982.247-25", email: " ANA@X.COM ", city: " " });
    expect(p).toMatchObject({ name: "Ana", document: "52998224725", email: "ana@x.com", city: null, phone: null });
  });
});

describe("clientes repetidos", () => {
  const list = [cust({ id: "a", name: "João Silva", document: "52998224725", email: "joao@x.com", whatsapp: "11912345678" })];
  it("detecta mesmo CPF, e-mail, telefone ou nome (sem acento)", () => {
    expect(findPossibleDuplicates(list, { ...base, name: "Outro", document: "529.982.247-25" })[0]?.reason).toBe("documento");
    expect(findPossibleDuplicates(list, { ...base, name: "Outro", email: "JOAO@x.com" })[0]?.reason).toBe("e-mail");
    expect(findPossibleDuplicates(list, { ...base, name: "Outro", phone: "(11) 91234-5678" })[0]?.reason).toBe("telefone");
    expect(findPossibleDuplicates(list, { ...base, name: "joao  silva" })[0]?.reason).toBe("nome");
  });
  it("ignora o próprio cliente ao editar", () => {
    expect(findPossibleDuplicates(list, { ...base, name: "João Silva", document: "52998224725" }, "a")).toEqual([]);
  });
});

describe("busca de clientes", () => {
  const list = [cust({ id: "a", name: "Mário", document: "52998224725", city: "Santos" }), cust({ id: "b", name: "Ana", phone: "1133334444" })];
  it("busca sem acento, por cidade e por dígitos do documento ou telefone", () => {
    expect(filterCustomers(list, "mario").map((c) => c.id)).toEqual(["a"]);
    expect(filterCustomers(list, "santos").map((c) => c.id)).toEqual(["a"]);
    expect(filterCustomers(list, "529.982").map((c) => c.id)).toEqual(["a"]);
    expect(filterCustomers(list, "3333").map((c) => c.id)).toEqual(["b"]);
    expect(filterCustomers(list, "")).toHaveLength(2);
  });
});
