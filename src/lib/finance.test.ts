import { describe, expect, it } from "vitest";
import { computeProfit, groupSeries, productMargin } from "./finance";
import { isValidCPF, isValidCNPJ, date, addDaysISO } from "./format";

describe("profit rules", () => {
  const base = { gross: 1000, discounts: 50, returns: 100, payment_fees: 30, marketplace_fees: 20, cogs: 400, shipping_costs: 40, valid_total: 850, valid_count: 5 };

  it("sale total is never profit: deducts discounts, returns, fees, product cost and shipping", () => {
    const p = computeProfit(base);
    expect(p.netRevenue).toBe(800);
    expect(p.grossProfit).toBe(360);
  });

  it("net profit also deducts operating expenses", () => {
    expect(computeProfit({ ...base, opex: 160 }).netProfit).toBe(200);
  });

  it("average ticket is valid sales total divided by valid orders", () => {
    expect(computeProfit(base).ticket).toBe(170);
  });

  it("product margin is (price - cost) / price", () => {
    expect(productMargin(40, 100)).toBe(60);
    expect(productMargin(10, 0)).toBe(0);
  });
});

describe("grouping", () => {
  it("groups daily rows by month", () => {
    const g = groupSeries([{ d: "2026-01-05", total: 10 }, { d: "2026-01-20", total: 5 }, { d: "2026-02-01", total: 1 }], "mes", ["total"]);
    expect(g).toEqual([{ d: "2026-01", total: 15 }, { d: "2026-02", total: 1 }]);
  });
});

describe("brazilian formats", () => {
  it("shows dates as DD/MM/AAAA", () => {
    expect(date("2026-11-03")).toBe("03/11/2026");
  });
  it("validates CPF and CNPJ check digits", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("529.982.247-24")).toBe(false);
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    expect(isValidCNPJ("11.222.333/0001-80")).toBe(false);
  });
  it("adds days across month boundaries", () => {
    expect(addDaysISO("2026-01-30", 3)).toBe("2026-02-02");
  });
});
