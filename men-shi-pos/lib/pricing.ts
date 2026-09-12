import type { ComboPart, PriceTier, Product, SaleItem } from "@/lib/types";

export function comboPartsOf(product: Product): ComboPart[] {
  return (product.comboParts ?? []).filter(
    (part) => Boolean(part.productId) && part.qty > 0,
  );
}

export function priceTiersOf(product: Product): PriceTier[] {
  return (product.priceTiers ?? []).filter(
    (tier) => tier.qty >= 2 && Number.isFinite(tier.total) && tier.total >= 0,
  );
}

export function isCombo(product: Product): boolean {
  return comboPartsOf(product).length > 0;
}

export function lineAmount(item: {
  qty: number;
  unitPrice: number;
  lineTotal?: number;
}): number {
  if (item.lineTotal != null && Number.isFinite(item.lineTotal)) {
    return item.lineTotal;
  }
  return item.qty * item.unitPrice;
}

export function sellableQty(product: Product, catalog: Product[]): number {
  const parts = comboPartsOf(product);
  if (parts.length === 0) return Math.max(0, product.stock);
  let min = Number.POSITIVE_INFINITY;
  for (const part of parts) {
    const item = catalog.find((row) => row.id === part.productId);
    if (!item || part.qty <= 0) return 0;
    min = Math.min(min, Math.floor(item.stock / part.qty));
  }
  return Number.isFinite(min) ? Math.max(0, min) : 0;
}

export function comboCost(product: Product, catalog: Product[]): number {
  return comboPartsOf(product).reduce((sum, part) => {
    const item = catalog.find((row) => row.id === part.productId);
    return sum + (item?.cost ?? 0) * part.qty;
  }, 0);
}

export function comboListTotal(product: Product, catalog: Product[]): number {
  return comboPartsOf(product).reduce((sum, part) => {
    const item = catalog.find((row) => row.id === part.productId);
    return sum + (item?.price ?? 0) * part.qty;
  }, 0);
}

export function dealTotal(product: Product, qty: number): number {
  const n = Math.max(0, Math.round(qty) || 0);
  if (n <= 0) return 0;
  const tiers = [...priceTiersOf(product)].sort(
    (left, right) => right.qty - left.qty || left.total - right.total,
  );
  let left = n;
  let total = 0;
  for (const tier of tiers) {
    const packs = Math.floor(left / tier.qty);
    if (packs > 0) {
      total += packs * Math.round(tier.total);
      left -= packs * tier.qty;
    }
  }
  return total + left * product.price;
}

export function allocateAmounts(weights: number[], total: number): number[] {
  if (weights.length === 0) return [];
  const money = Math.round(total);
  const sum = weights.reduce((acc, value) => acc + Math.max(0, value), 0);
  if (sum <= 0) {
    const even = Math.floor(money / weights.length);
    const out = weights.map(() => even);
    out[out.length - 1] += money - even * weights.length;
    return out;
  }
  const raw = weights.map((value) => (money * Math.max(0, value)) / sum);
  const floors = raw.map((value) => Math.floor(value));
  let remainder = money - floors.reduce((acc, value) => acc + value, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((left, right) => right.frac - left.frac);
  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    floors[order[cursor % order.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return floors;
}

export function expandComboLines(
  combo: Product,
  comboQty: number,
  setPrice: number,
  catalog: Product[],
): {
  product: Product;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  note: string;
}[] {
  const parts = comboPartsOf(combo);
  const qty = Math.max(1, Math.round(comboQty) || 1);
  const weights = parts.map((part) => {
    const item = catalog.find((row) => row.id === part.productId);
    return (item?.price ?? 0) * part.qty;
  });
  const amounts = allocateAmounts(weights, setPrice * qty);
  return parts.map((part, index) => {
    const item = catalog.find((row) => row.id === part.productId);
    if (!item) {
      throw new Error(`${combo.name} 缺少套組商品`);
    }
    const partQty = part.qty * qty;
    const lineTotal = amounts[index] ?? 0;
    const unitPrice = partQty > 0 ? Math.round(lineTotal / partQty) : 0;
    return {
      product: item,
      qty: partQty,
      unitPrice,
      lineTotal,
      note: combo.name,
    };
  });
}

export function saleItemsTotal(items: SaleItem[]): number {
  return items.reduce((sum, item) => sum + lineAmount(item), 0);
}
