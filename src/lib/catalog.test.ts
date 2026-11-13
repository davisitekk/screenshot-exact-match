import { describe, expect, it } from "vitest";
import { buildCategoryTree, categoryDeleteBlocker, categoryFilterIds, categoryPath, filterProducts, marginPercent, stockLevel, type Category } from "./catalog";

const cat = (id: string, name: string, parent_id: string | null = null): Category => ({
  id, name, parent_id, active: true, description: null, created_at: "2026-11-13T00:00:00Z",
});
const cats = [cat("t", "Tênis"), cat("n", "Nike", "t"), cat("a", "Adidas", "t"), cat("j", "Jaquetas")];

describe("categorias e subcategorias", () => {
  it("agrupa subcategorias dentro da categoria principal", () => {
    const tree = buildCategoryTree(cats);
    expect(tree.map((c) => c.name)).toEqual(["Jaquetas", "Tênis"]);
    expect(tree[1]!.children.map((c) => c.name)).toEqual(["Adidas", "Nike"]);
  });

  it("mostra o caminho Categoria › Subcategoria", () => {
    expect(categoryPath(cats, "n")).toBe("Tênis › Nike");
    expect(categoryPath(cats, "j")).toBe("Jaquetas");
    expect(categoryPath(cats, null)).toBe("Sem categoria");
  });

  it("filtrar por categoria principal inclui os produtos das subcategorias", () => {
    expect([...categoryFilterIds(cats, "t")].sort()).toEqual(["a", "n", "t"]);
    expect([...categoryFilterIds(cats, "n")]).toEqual(["n"]);
  });
});

describe("margem", () => {
  it("calcula a margem sobre o preço de venda", () => {
    expect(marginPercent(200, 120)).toBe(40);
  });
  it("não calcula margem sem custo informado", () => {
    expect(marginPercent(499.9, 0)).toBeNull();
  });
});

describe("estoque e filtros de produtos", () => {
  const prod = (over: Partial<import("./catalog").Product>): import("./catalog").Product => ({
    id: "x", code: "P1", name: "Produto", description: null, category_id: null, brand: null, barcode: null, sku: null,
    image_url: null, cost: 0, price: 0, margin: null, stock_qty: 10, min_stock: 2, supplier_id: null, weight_kg: null,
    height_cm: null, width_cm: null, length_cm: null, variations: null, active: true,
    created_at: "2026-11-13T00:00:00Z", updated_at: "2026-11-13T00:00:00Z", ...over,
  });

  it("classifica o estoque como o painel: zero = sem estoque, até o mínimo = baixo", () => {
    expect(stockLevel(prod({ stock_qty: 0 }))).toBe("sem");
    expect(stockLevel(prod({ stock_qty: 2, min_stock: 2 }))).toBe("baixo");
    expect(stockLevel(prod({ stock_qty: 3, min_stock: 2 }))).toBe("ok");
  });

  it("mostra só produtos ativos por padrão", () => {
    const list = [prod({ id: "a" }), prod({ id: "b", active: false })];
    expect(filterProducts(list, cats, {}).map((p) => p.id)).toEqual(["a"]);
    expect(filterProducts(list, cats, { status: "inativos" }).map((p) => p.id)).toEqual(["b"]);
  });

  it("pesquisa por nome sem acento, código e SKU", () => {
    const list = [prod({ id: "a", name: "Tênis Air", code: "P10" }), prod({ id: "b", name: "Boné", sku: "BN-01" })];
    expect(filterProducts(list, cats, { q: "tenis" }).map((p) => p.id)).toEqual(["a"]);
    expect(filterProducts(list, cats, { q: "bn-01" }).map((p) => p.id)).toEqual(["b"]);
    expect(filterProducts(list, cats, { q: "p10" }).map((p) => p.id)).toEqual(["a"]);
  });

  it("filtrar pela categoria principal traz os produtos das subcategorias", () => {
    const list = [prod({ id: "a", category_id: "n" }), prod({ id: "b", category_id: "j" })];
    expect(filterProducts(list, cats, { category: "t" }).map((p) => p.id)).toEqual(["a"]);
  });
});

describe("exclusão de categorias", () => {
  it("bloqueia categoria com subcategorias", () => {
    expect(categoryDeleteBlocker(cats, [], "t")).toMatch(/subcategorias/);
  });
  it("bloqueia categoria com produtos", () => {
    expect(categoryDeleteBlocker(cats, [{ category_id: "n" }], "n")).toMatch(/1 produto/);
  });
  it("permite excluir categoria vazia", () => {
    expect(categoryDeleteBlocker(cats, [{ category_id: "n" }], "j")).toBeNull();
  });
});
