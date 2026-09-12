import { matchProducts } from "@/lib/lookup";
import type { Product } from "@/lib/types";

export type NoticeItem = {
  name: string;
  qty: number;
  unitPrice: number;
  productId: string | null;
  matchedName: string | null;
};

function toHalfWidthDigits(text: string) {
  return text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30),
  );
}

function clean(text: string) {
  return toHalfWidthDigits(text)
    .replace(/\u00a0/g, " ")
    .replace(/[：﹕︰︓∶]/g, ":")
    .replace(/[★☆＊*✦✧✨●■]+/g, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NAME_RE =
  /(?:到貨商品|商品名稱|品名|arrival(?:\s+of)?\s+(?:goods|products?|merchandise)|incoming\s+(?:goods|products?))\s*:?\s*(.+)$/i;
const PRICE_RE =
  /(?:單價|金額|售價|價錢|unit\s*price|price)\s*[:,，,]?\s*[\$＄]?\s*(\d+)/i;
const QTY_RE =
  /(?:數量|qty|quantity)\s*[:,，,]?\s*[+＋]?\s*(\d+)/i;
const INLINE_RE =
  /(?:到貨商品|arrival(?:\s+of)?\s+(?:goods|products?|merchandise)|incoming\s+(?:goods|products?))\s*:?\s*(.+?)\s+(?:單價|unit\s*price|price)\s*[:,，,]?\s*[\$＄]?\s*(\d+)\s+(?:數量|qty|quantity)\s*[:,，,]?\s*[+＋]?\s*(\d+)/i;

function compact(text: string) {
  return text.replace(/[\s★☆＊*·・\-_/]/g, "").toLowerCase();
}

function charsInOrder(query: string, name: string) {
  let index = 0;
  for (const ch of name) {
    if (ch === query[index]) {
      index += 1;
      if (index === query.length) return true;
    }
  }
  return false;
}

function pickUnique(list: Product[], unitPrice: number): Product | null {
  if (list.length === 1) return list[0];
  if (list.length > 1 && unitPrice > 0) {
    const priced = list.filter((item) => item.price === unitPrice);
    if (priced.length === 1) return priced[0];
  }
  return null;
}

function matchName(
  name: string,
  products: Product[],
  unitPrice: number,
): Product | null {
  const q = name.trim();
  if (!q) return null;
  const exact = products.find((item) => item.name === q);
  if (exact) return exact;

  const qCompact = compact(q);
  const compactExact = products.filter((item) => compact(item.name) === qCompact);
  const uniqueCompact = pickUnique(compactExact, unitPrice);
  if (uniqueCompact) return uniqueCompact;

  const hits = matchProducts(products, q);
  const uniqueHit = pickUnique(hits, unitPrice);
  if (uniqueHit) return uniqueHit;
  const start = hits.filter((item) => item.name.startsWith(q));
  const uniqueStart = pickUnique(start, unitPrice);
  if (uniqueStart) return uniqueStart;

  // 「23蝦」對「23日蝦」：字依序出現，且名稱夠接近，才自動對。
  if (qCompact.length < 2) return null;
  const ordered = products.filter((item) => {
    const n = compact(item.name);
    if (!charsInOrder(qCompact, n)) return false;
    return qCompact.length / n.length >= 0.5;
  });
  return pickUnique(ordered, unitPrice);
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
  const product = matchName(label, products, unitPrice);
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
  const items: NoticeItem[] = [];
  const lines = raw.split(/\r?\n/).map(clean).filter(Boolean);
  let name = "";
  let price = 0;
  for (const line of lines) {
    const named = line.match(NAME_RE);
    if (named) {
      name = named[1].replace(/(?:單價|unit\s*price|price).*$/i, "").trim();
      price = 0;
      const inline = line.match(INLINE_RE);
      if (inline) {
        pushItem(items, products, inline[1], Number(inline[3]), Number(inline[2]));
        name = "";
        price = 0;
      }
      continue;
    }
    const priced = line.match(PRICE_RE);
    if (priced) {
      price = Number(priced[1]);
      continue;
    }
    const qty = line.match(QTY_RE);
    if (qty && name) {
      pushItem(items, products, name, Number(qty[1]), price);
      name = "";
      price = 0;
    }
  }
  if (items.length > 0) return items;

  const text = lines.join("\n");
  const block = new RegExp(INLINE_RE.source, "gi");
  for (const match of text.matchAll(block)) {
    pushItem(items, products, match[1], Number(match[3]), Number(match[2]));
  }
  if (items.length > 0) return items;

  const dotted = /[·・]\s*(.+?)\s*[×xX]\s*(\d+)\s*[\$＄]?\s*(\d+)/g;
  for (const match of text.matchAll(dotted)) {
    pushItem(items, products, match[1], Number(match[2]), Number(match[3]));
  }
  return items;
}
