import { describe, expect, it } from "vitest";
import { buildCategoryTree, categoryFilterIds, categoryPath, marginPercent, type Category } from "./catalog";

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
