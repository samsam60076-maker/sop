import type { Product } from "@/lib/types";

export function parseTypedEntry(raw: string) {
  const text = raw.trim();
  if (!text) return { query: "", qty: null as number | null };
  const match = text.match(/^(.*?)(?:\s*[*xX×]\s*|\s+)(\d+)$/);
  if (match && match[1]?.trim()) {
    return { query: match[1].trim(), qty: Number(match[2]) };
  }
  return { query: text, qty: null as number | null };
}

export function matchProducts(
  products: Product[],
  query: string,
  options?: { activeOnly?: boolean; emptyAll?: boolean },
) {
  const list = options?.activeOnly
    ? products.filter((product) => product.active)
    : products;
  const q = query.trim().toLowerCase();
  if (!q) return options?.emptyAll ? list : [];

  return list
    .map((product) => {
      const name = product.name.toLowerCase();
      const sku = product.sku.toLowerCase();
      let score = 0;
      if (name === q || sku === q) score = 4;
      else if (name.startsWith(q) || sku.startsWith(q)) score = 3;
      else if (name.includes(q) || sku.includes(q)) score = 1;
      else return null;
      return { product, score };
    })
    .filter((row): row is { product: Product; score: number } => Boolean(row))
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, "zh-Hant"))
    .map((row) => row.product);
}

export function productFromTypedName(
  products: Product[],
  raw: string,
  options?: { activeOnly?: boolean },
) {
  const { query, qty } = parseTypedEntry(raw);
  if (!query) return { product: null, qty };
  const list = options?.activeOnly
    ? products.filter((product) => product.active)
    : products;
  const q = query.toLowerCase();
  const exact = list.find(
    (product) =>
      product.name.toLowerCase() === q || product.sku.toLowerCase() === q,
  );
  if (exact) return { product: exact, qty };
  const matches = matchProducts(list, query, options);
  if (matches.length === 1) return { product: matches[0], qty };
  const starts = list.filter((product) => product.name.toLowerCase().startsWith(q));
  if (starts.length === 1) return { product: starts[0], qty };
  return { product: null, qty };
}

export function resolveProduct(
  products: Product[],
  query: string,
  options?: { activeOnly?: boolean },
) {
  const matches = matchProducts(products, query, options);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  const exactName = matches.find(
    (product) => product.name.toLowerCase() === query.trim().toLowerCase(),
  );
  return exactName ?? matches[0];
}
