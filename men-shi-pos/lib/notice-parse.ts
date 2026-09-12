import { matchProducts } from "@/lib/lookup";
import type { Product } from "@/lib/types";

export type NoticeItem = {
  name: string;
  qty: number;
  unitPrice: number;
  productId: string | null;
  matchedName: string | null;
};

function clean(text: string) {
  return text.replace(/\u00a0/g, " ").replace(/[：﹕]/g, ":").trim();
}

function matchName(name: string, products: Product[]): Product | null {
  const q = name.trim();
  if (!q) return null;
  const exact = products.find((item) => item.name === q);
  if (exact) return exact;
  const hits = matchProducts(products, q);
  if (hits.length === 1) return hits[0];
  const start = hits.filter((item) => item.name.startsWith(q));
  if (start.length === 1) return start[0];
  return hits[0] ?? null;
}

function pushItem(
  items: NoticeItem[],
  products: Product[],
  name: string,
  qty: number,
  price: number,
) {
  const label = name.replace(/\s+/g, " ").trim();
  if (!label) return;
  const amount = Math.max(1, Math.round(qty) || 1);
  const unitPrice = Math.max(0, Math.round(price) || 0);
  const product = matchName(label, products);
  items.push({
    name: label,
    qty: amount,
    unitPrice: product && unitPrice === 0 ? product.price : unitPrice,
    productId: product?.id ?? null,
    matchedName: product?.name ?? null,
  });
}

/** 貼上「到貨商品 / 單價 / 數量」取貨訊息，拆成一列一列商品。 */
export function parseArrivalNotice(
  raw: string,
  products: Product[],
): NoticeItem[] {
  const text = clean(raw);
  if (!text) return [];
  const items: NoticeItem[] = [];

  const block = /到貨商品\s*:?\s*(.+?)[\s,，]*單價\s*:?\s*[\$＄]?\s*(\d+)[\s,，]*數量\s*:?\s*[+＋]?\s*(\d+)/gi;
  let found = false;
  for (const match of text.matchAll(block)) {
    found = true;
    pushItem(items, products, match[1], Number(match[3]), Number(match[2]));
  }
  if (found) return items;

  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  let name = "";
  let price = 0;
  for (const line of lines) {
    const named = line.match(/^到貨商品\s*:?\s*(.+)$/);
    if (named) {
      name = named[1].trim();
      price = 0;
      continue;
    }
    const priced = line.match(/^單價\s*:?\s*[\$＄]?\s*(\d+)/);
    if (priced) {
      price = Number(priced[1]);
      continue;
    }
    const qty = line.match(/^數量\s*:?\s*[+＋]?\s*(\d+)/);
    if (qty && name) {
      pushItem(items, products, name, Number(qty[1]), price);
      name = "";
      price = 0;
    }
  }
  if (items.length > 0) return items;

  const dotted =
    /[·・]\s*(.+?)\s*[×xX*]\s*(\d+)\s*[\$＄]?\s*(\d+)/g;
  for (const match of text.matchAll(dotted)) {
    pushItem(items, products, match[1], Number(match[2]), Number(match[3]));
  }
  return items;
}
