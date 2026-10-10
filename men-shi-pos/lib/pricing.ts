import type {
  ComboPart,
  MixDeal,
  PriceTier,
  Product,
  SaleItem,
} from "@/lib/types";

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

export function mixDealOf(product: Product): MixDeal | null {
  const raw = product.mixDeal;
  if (!raw) return null;
  const group = raw.group.trim();
  const qty = Math.round(raw.qty);
  const total = Math.round(raw.total);
  if (!group || qty < 2 || !Number.isFinite(total) || total < 0) return null;
  return { group, qty, total };
}

export function mixDealKey(deal: MixDeal) {
  return `${deal.group}::${deal.qty}::${deal.total}`;
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

export function priceCartLines(
  lines: {
    id: string;
    product: Product;
    qty: number;
    unitPrice: number;
    priceReason?: string;
  }[],
  staffBuy: boolean,
): { id: string; amount: number; mixHint?: string }[] {
  const byId = new Map<string, { amount: number; mixHint?: string }>();
  const groups = new Map<
    string,
    {
      deal: MixDeal;
      members: { id: string; qty: number; price: number }[];
    }
  >();

  for (const line of lines) {
    const locked =
      staffBuy ||
      Boolean(line.priceReason) ||
      isCombo(line.product) ||
      line.unitPrice !== line.product.price;
    const deal = locked ? null : mixDealOf(line.product);
    if (!deal) {
      const amount =
        staffBuy || line.priceReason || isCombo(line.product)
          ? line.unitPrice * line.qty
          : dealTotal(line.product, line.qty);
      byId.set(line.id, { amount });
      continue;
    }
    const key = mixDealKey(deal);
    const bucket = groups.get(key) ?? { deal, members: [] };
    bucket.members.push({
      id: line.id,
      qty: line.qty,
      price: line.product.price,
    });
    groups.set(key, bucket);
  }

  for (const { deal, members } of groups.values()) {
    const units: { id: string; price: number }[] = [];
    for (const member of members) {
      for (let i = 0; i < member.qty; i += 1) units.push(member);
    }
    const packs = Math.floor(units.length / deal.qty);
    const covered = packs * deal.qty;
    const shares = allocateAmounts(
      units.slice(0, covered).map((unit) => unit.price),
      packs * deal.total,
    );
    const totals = new Map<string, number>();
    units.forEach((unit, index) => {
      const add =
        index < covered ? (shares[index] ?? 0) : unit.price;
      totals.set(unit.id, (totals.get(unit.id) ?? 0) + add);
    });
    const hint = packs > 0 ? `任選${deal.qty}個${deal.total}` : undefined;
    for (const member of members) {
      byId.set(member.id, {
        amount: totals.get(member.id) ?? 0,
        mixHint: hint,
      });
    }
  }

  return lines.map((line) => ({
    id: line.id,
    amount: byId.get(line.id)?.amount ?? 0,
    mixHint: byId.get(line.id)?.mixHint,
  }));
}
