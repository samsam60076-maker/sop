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
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[：﹕︰︓∶]/g, ":")
    .replace(/[★☆＊*✦✧✨●■]+/g, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NAME_RE =
  /(?:到貨商品|到货商品|商品名稱|商品名称|品名|arrived?\s+(?:goods|products?|merchandise)|arrival(?:\s+of)?\s+(?:goods|products?|merchandise)|incoming\s+(?:goods|products?)|goods\s+(?:arrived|received)|product(?:s)?\s*name)\s*:?\s*(.*)$/i;
const PRICE_RE =
  /(?:單價|单价|金額|金额|售價|售价|價錢|价钱|unit\s*price|price)\s*[:,，,]?\s*[\$＄]?\s*(\d+)/i;
const QTY_RE =
  /(?:數量|数量|qty|quantity)\s*[:,，,]?\s*[+＋]?\s*(\d+)/i;
const INLINE_RE =
  /(?:到貨商品|到货商品|arrival(?:\s+of)?\s+(?:goods|products?|merchandise)|incoming\s+(?:goods|products?))\s*:?\s*(.+?)\s+(?:單價|单价|unit\s*price|price)\s*[:,，,]?\s*[\$＄]?\s*(\d+)\s+(?:數量|数量|qty|quantity)\s*[:,，,]?\s*[+＋]?\s*(\d+)/i;

function isQtyLabel(line: string) {
  return /(?:數量|数量|qty|quantity)/i.test(line);
}

function isPriceLabel(line: string) {
  return /(?:單價|单价|金額|金额|售價|售价|價錢|价钱|unit\s*price)/i.test(line);
}

function nameFromLine(line: string) {
  const named = line.match(NAME_RE);
  const fromLabel = named?.[1]?.replace(/(?:單價|单价|unit\s*price|price).*$/i, "").trim();
  if (fromLabel) return fromLabel;
  if (isQtyLabel(line) || isPriceLabel(line)) return "";
  const stripped = line
    .replace(/^(?:到貨商品|到货商品|商品名稱|商品名称|品名)\s*:?\s*/i, "")
    .trim();
  const cjkStart = stripped.search(/[\u4e00-\u9fff]/);
  const cjk = (stripped.match(/[\u4e00-\u9fff]/g) || []).length;
  if (cjk >= 2) {
    return (cjkStart > 0 ? stripped.slice(cjkStart) : stripped).trim();
  }
  if (stripped.length >= 4 && /[a-z]/i.test(stripped)) return stripped;
  return "";
}

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

  if (qCompact.length >= 2) {
    const contained = products.filter((item) =>
      compact(item.name).includes(qCompact),
    );
    const uniqueContained = pickUnique(contained, unitPrice);
    if (uniqueContained) return uniqueContained;
    if (contained.length > 1) {
      const ended = contained.filter((item) =>
        compact(item.name).endsWith(qCompact),
      );
      if (ended.length === 1) return ended[0];
      const tight = contained.filter(
        (item) => qCompact.length / compact(item.name).length >= 0.5,
      );
      const uniqueTight = pickUnique(tight, unitPrice);
      if (uniqueTight) return uniqueTight;
      if (ended.length > 0) return ended[0];
    }
  }

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

  for (let index = 0; index < lines.length; index += 1) {
    const qty = lines[index].match(QTY_RE);
    if (!qty) continue;
    let foundName = "";
    let foundPrice = 0;
    for (let back = index - 1; back >= 0; back -= 1) {
      if (QTY_RE.test(lines[back]) && foundName) break;
      const priced = lines[back].match(PRICE_RE);
      if (priced && foundPrice === 0) {
        foundPrice = Number(priced[1]);
        continue;
      }
      const label = nameFromLine(lines[back]);
      if (label) {
        foundName = label;
        break;
      }
    }
    if (foundName) {
      pushItem(items, products, foundName, Number(qty[1]), foundPrice);
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

const PACK_UNIT =
  "(?:包|盒|袋|組|份|顆|個|瓶|杯|箱|串|隻|尾|條)";

function parsePackedUnitLines(raw: string, products: Product[]): NoticeItem[] {
  const items: NoticeItem[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const spaced = toHalfWidthDigits(line).replace(/[＋]/g, "+").trim();
    if (!spaced) continue;
    const packed = spaced.replace(/\s+/g, "");
    const withUnit = packed.match(new RegExp(`^(.+?)(\\d+)${PACK_UNIT}$`));
    const noUnit = packed.match(/^(.+?)(\d+)$/);
    const hit = withUnit ?? (noUnit && /[\u4e00-\u9fff]/.test(noUnit[1]) ? noUnit : null);
    if (!hit) continue;
    const name = hit[1].trim();
    const qty = Number(hit[2]);
    if (!name || !Number.isFinite(qty) || qty <= 0) continue;
    pushItem(items, products, name, qty, 0);
  }
  return items;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCatalogPurchase(raw: string, products: Product[]): NoticeItem[] {
  const catalog = [...products].sort((a, b) => b.name.length - a.name.length);
  let text = toHalfWidthDigits(raw).replace(/[＋]/g, "+");
  const items: NoticeItem[] = [];
  for (const product of catalog) {
    const namedStar = new RegExp(
      `${escapeRegExp(product.name)}\\s*[*xX×]\\s*(\\d+)(?:\\s*[\\$＄]?\\s*(\\d+))?`,
      "gi",
    );
    text = text.replace(namedStar, (_all, qty: string, price?: string) => {
      pushItem(items, products, product.name, Number(qty), Number(price || 0));
      return " ";
    });
    const namedQty = new RegExp(
      `${escapeRegExp(product.name)}\\s+(\\d+)(?:\\s+[\\$＄]?\\s*(\\d+))?`,
      "gi",
    );
    text = text.replace(namedQty, (_all, qty: string, price?: string) => {
      pushItem(items, products, product.name, Number(qty), Number(price || 0));
      return " ";
    });
  }
  const leftover = text
    .split(/[,，、\n;；]+/)
    .map((part) => clean(part))
    .filter(Boolean);
  for (const part of leftover) {
    if (/^(品名|商品|數量|数量|單價|单价|批價|售價|合計|備註)/.test(part) && part.length < 12) {
      continue;
    }
    if (/^\d+$/.test(part) || part.length < 2) continue;
    const star = part.match(/^(.+?)\s+(\d+)$/);
    const label = star ? star[1] : part;
    const qty = star ? Number(star[2]) : 1;
    const probe: NoticeItem[] = [];
    pushItem(probe, products, label, qty, 0);
    if (probe[0]?.productId) items.push(probe[0]);
  }
  return items;
}

/** 貼上進貨文字：香煎雞腿排20包、到貨訊息，拆成商品、數量。 */
export function parsePurchasePaste(raw: string, products: Product[]): NoticeItem[] {
  const packed = parsePackedUnitLines(raw, products);
  if (packed.length > 0) return packed;
  const notice = parseArrivalNotice(raw, products);
  if (notice.length > 0) return notice;
  return parseCatalogPurchase(raw, products);
}

