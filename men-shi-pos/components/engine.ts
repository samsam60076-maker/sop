import type {
  AppState,
  Expense,
  Movement,
  Product,
  Purchase,
  Sale,
  SaleReturn,
  PaymentMethod,
  Category,
  Unit,
  Stocktake,
  StocktakeLine,
} from "@/lib/types";
import { defaultSettings, uniqueCategories } from "@/lib/shop";

export const emptyState: AppState = {
  products: [],
  purchases: [],
  sales: [],
  movements: [],
  stocktakes: [],
  expenses: [],
  saleReturns: [],
  checkoutOrder: [],
  settings: defaultSettings(),
};

function nextSeq(prefix: string, numbers: string[]) {
  let max = 0;
  for (const number of numbers) {
    if (!number.startsWith(prefix)) continue;
    const value = Number(number.slice(prefix.length));
    if (Number.isFinite(value) && value > max) max = value;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function nowIso() {
  return new Date().toISOString();
}

function qtyByProduct(items: { productId: string; qty: number }[]) {
  const map = new Map<string, number>();
  for (const item of items) {
    if (!item.productId) continue;
    map.set(item.productId, (map.get(item.productId) ?? 0) + item.qty);
  }
  return map;
}

function addStock(products: Product[], add: Map<string, number>) {
  return products.map((product) => {
    const qty = add.get(product.id) ?? 0;
    return qty ? { ...product, stock: product.stock + qty } : product;
  });
}

function subtractStock(
  products: Product[],
  subtract: Map<string, number>,
): { ok: true; products: Product[] } | { ok: false; error: string } {
  for (const product of products) {
    const qty = subtract.get(product.id) ?? 0;
    if (qty > 0 && product.stock < qty) {
      return {
        ok: false,
        error: `${product.name} 庫存不夠扣回（現有 ${product.stock}）`,
      };
    }
  }
  return {
    ok: true,
    products: products.map((product) => {
      const qty = subtract.get(product.id) ?? 0;
      return qty ? { ...product, stock: product.stock - qty } : product;
    }),
  };
}

function applyEach<T>(
  state: AppState,
  ids: string[],
  emptyError: string,
  applyOne: (state: AppState, id: string) => EngineResult<T>,
): EngineResult<{ count: number; items: T[] }> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return { ok: false, error: emptyError };
  let current = state;
  const items: T[] = [];
  for (const id of unique) {
    const result = applyOne(current, id);
    if (!result.ok) return result;
    current = result.state;
    items.push(result.data);
  }
  return { ok: true, data: { count: items.length, items }, state: current };
}

export type EngineResult<T> =
  | { ok: true; state: AppState; data: T }
  | { ok: false; error: string };

export function upsertProduct(
  state: AppState,
  input: {
    id?: string;
    sku: string;
    name: string;
    category: Category;
    unit: Unit;
    cost: number;
    price: number;
    minStock: number;
  },
): EngineResult<Product> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "請輸入商品名稱" };
  const sku =
    input.sku.trim().toUpperCase() ||
    nextSeq(
      "P",
      state.products.map((product) => product.sku),
    );
  if (
    !Number.isFinite(input.cost) ||
    !Number.isFinite(input.price) ||
    !Number.isFinite(input.minStock)
  ) {
    return { ok: false, error: "售價、批價請填數字" };
  }
  if (input.price < 0 || input.cost < 0) {
    return { ok: false, error: "價格不可為負數" };
  }
  if (input.minStock < 0) return { ok: false, error: "安全庫存不可為負數" };

  const category = input.category.trim();
  if (!category) return { ok: false, error: "請選擇分類" };
  const settings = {
    ...state.settings,
    categories: uniqueCategories([...state.settings.categories, category]),
  };

  const duplicate = state.products.find(
    (product) => product.sku === sku && product.id !== input.id,
  );
  if (duplicate) return { ok: false, error: "商品編號已存在" };

  if (input.id) {
    const existing = state.products.find((product) => product.id === input.id);
    if (!existing) return { ok: false, error: "找不到商品" };
    const product: Product = {
      ...existing,
      sku,
      name,
      category,
      unit: input.unit,
      cost: Math.round(input.cost),
      price: Math.round(input.price),
      minStock: Math.round(input.minStock),
    };
    return {
      ok: true,
      data: product,
      state: {
        ...state,
        settings,
        products: state.products.map((item) =>
          item.id === product.id ? product : item,
        ),
      },
    };
  }

  const product: Product = {
    id: crypto.randomUUID(),
    sku,
    name,
    category,
    unit: input.unit,
    cost: Math.round(input.cost),
    price: Math.round(input.price),
    minStock: Math.round(input.minStock),
    stock: 0,
    active: true,
  };
  return {
    ok: true,
    data: product,
    state: { ...state, settings, products: [product, ...state.products] },
  };
}

export function addCategory(
  state: AppState,
  name: string,
): EngineResult<string> {
  const category = name.trim();
  if (!category) return { ok: false, error: "請填分類名稱" };
  const categories = uniqueCategories(state.settings.categories);
  if (categories.includes(category)) {
    return { ok: false, error: "已有這個分類" };
  }
  return {
    ok: true,
    data: category,
    state: {
      ...state,
      settings: { ...state.settings, categories: [...categories, category] },
    },
  };
}

export function renameCategory(
  state: AppState,
  from: string,
  to: string,
): EngineResult<{ from: string; to: string }> {
  const current = from.trim();
  const next = to.trim();
  if (!current) return { ok: false, error: "找不到這個分類" };
  if (!next) return { ok: false, error: "請填新名稱" };
  const categories = uniqueCategories(state.settings.categories);
  if (!categories.includes(current)) {
    return { ok: false, error: "找不到這個分類" };
  }
  if (next !== current && categories.includes(next)) {
    return { ok: false, error: "已有這個分類" };
  }
  if (next === current) return { ok: false, error: "名稱沒有改" };
  return {
    ok: true,
    data: { from: current, to: next },
    state: {
      ...state,
      settings: {
        ...state.settings,
        categories: categories.map((item) => (item === current ? next : item)),
      },
      products: state.products.map((product) =>
        product.category === current ? { ...product, category: next } : product,
      ),
      stocktakes: (state.stocktakes ?? []).map((sheet) => ({
        ...sheet,
        lines: sheet.lines.map((line) =>
          line.category === current ? { ...line, category: next } : line,
        ),
      })),
    },
  };
}

export function addBin(state: AppState, name: string): EngineResult<string> {
  const bin = name.trim();
  if (!bin) return { ok: false, error: "請填櫃位名稱" };
  const bins = uniqueCategories(state.settings.bins ?? []);
  if (bins.includes(bin)) {
    return { ok: false, error: "已有這個櫃位" };
  }
  return {
    ok: true,
    data: bin,
    state: {
      ...state,
      settings: { ...state.settings, bins: [...bins, bin] },
    },
  };
}

export function renameBin(
  state: AppState,
  from: string,
  to: string,
): EngineResult<{ from: string; to: string }> {
  const current = from.trim();
  const next = to.trim();
  if (!current) return { ok: false, error: "找不到這個櫃位" };
  if (!next) return { ok: false, error: "請填新名稱" };
  const bins = uniqueCategories(state.settings.bins ?? []);
  if (!bins.includes(current)) {
    return { ok: false, error: "找不到這個櫃位" };
  }
  if (next !== current && bins.includes(next)) {
    return { ok: false, error: "已有這個櫃位" };
  }
  if (next === current) return { ok: false, error: "名稱沒有改" };
  return {
    ok: true,
    data: { from: current, to: next },
    state: {
      ...state,
      settings: {
        ...state.settings,
        bins: bins.map((item) => (item === current ? next : item)),
      },
      stocktakes: (state.stocktakes ?? []).map((sheet) => ({
        ...sheet,
        lines: sheet.lines.map((line) =>
          line.bin === current ? { ...line, bin: next } : line,
        ),
      })),
    },
  };
}

export function removeBin(state: AppState, name: string): EngineResult<string> {
  const bin = name.trim();
  const bins = uniqueCategories(state.settings.bins ?? []);
  if (!bins.includes(bin)) {
    return { ok: false, error: "找不到這個櫃位" };
  }
  if (bins.length <= 1) {
    return { ok: false, error: "至少要留一個櫃位" };
  }
  return {
    ok: true,
    data: bin,
    state: {
      ...state,
      settings: {
        ...state.settings,
        bins: bins.filter((item) => item !== bin),
      },
    },
  };
}

export function removeCategory(
  state: AppState,
  name: string,
): EngineResult<string> {
  const category = name.trim();
  const categories = uniqueCategories(state.settings.categories);
  if (!categories.includes(category)) {
    return { ok: false, error: "找不到這個分類" };
  }
  if (categories.length <= 1) {
    return { ok: false, error: "至少要留一個分類" };
  }
  if (state.products.some((product) => product.category === category)) {
    return { ok: false, error: `還有商品使用「${category}」，請先改分類` };
  }
  return {
    ok: true,
    data: category,
    state: {
      ...state,
      settings: {
        ...state.settings,
        categories: categories.filter((item) => item !== category),
      },
    },
  };
}

export function removeProduct(
  state: AppState,
  productId: string,
): EngineResult<Product> {
  const existing = state.products.find((product) => product.id === productId);
  if (!existing) return { ok: false, error: "找不到商品" };
  return {
    ok: true,
    data: existing,
    state: {
      ...state,
      products: state.products.filter((item) => item.id !== productId),
    },
  };
}

export function removeProducts(
  state: AppState,
  productIds: string[],
): EngineResult<{ count: number; names: string[] }> {
  const ids = new Set(productIds.filter(Boolean));
  if (ids.size === 0) return { ok: false, error: "請先勾選要刪的商品" };
  const removed = state.products.filter((product) => ids.has(product.id));
  if (removed.length === 0) return { ok: false, error: "找不到商品" };
  return {
    ok: true,
    data: {
      count: removed.length,
      names: removed.map((item) => item.name),
    },
    state: {
      ...state,
      products: state.products.filter((item) => !ids.has(item.id)),
    },
  };
}

export function setProductActive(
  state: AppState,
  productId: string,
  active: boolean,
): EngineResult<Product> {
  const existing = state.products.find((product) => product.id === productId);
  if (!existing) return { ok: false, error: "找不到商品" };
  const product = { ...existing, active };
  return {
    ok: true,
    data: product,
    state: {
      ...state,
      products: state.products.map((item) =>
        item.id === productId ? product : item,
      ),
    },
  };
}

export function applyPurchase(
  state: AppState,
  input: {
    supplier?: string;
    note: string;
    items: {
      productId: string;
      qty: number;
      unitCost: number;
      unitPrice?: number;
    }[];
    createdAt?: string;
  },
): EngineResult<Purchase> {
  if (input.items.length === 0) return { ok: false, error: "請加入進貨商品" };

  for (const item of input.items) {
    if (!Number.isFinite(item.qty) || item.qty <= 0) {
      return { ok: false, error: "進貨數量必須大於 0" };
    }
    if (!Number.isFinite(item.unitCost) || item.unitCost < 0) {
      return { ok: false, error: "批價不可為負數" };
    }
    if (!state.products.some((product) => product.id === item.productId)) {
      return { ok: false, error: "找不到進貨商品" };
    }
  }

  const createdAt = input.createdAt ?? nowIso();
  const id = crypto.randomUUID();
  const number = nextSeq(
    "IN-",
    state.purchases.map((purchase) => purchase.number),
  );

  const products = state.products.map((product) => {
    const item = input.items.find((line) => line.productId === product.id);
    if (!item) return product;
    const qty = Math.round(item.qty);
    return { ...product, stock: product.stock + qty };
  });

  const items = input.items.map((item) => {
    const product = state.products.find((row) => row.id === item.productId)!;
    const unitPrice =
      item.unitPrice != null && Number.isFinite(item.unitPrice)
        ? Math.round(item.unitPrice)
        : product.price;
    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      qty: Math.round(item.qty),
      unitCost: Math.round(item.unitCost),
      unitPrice: unitPrice < 0 ? product.price : unitPrice,
    };
  });

  const purchase: Purchase = {
    id,
    number,
    supplier: input.supplier?.trim() ?? "",
    createdAt,
    items,
    note: input.note.trim(),
    totalCost: items.reduce((sum, item) => sum + item.qty * item.unitCost, 0),
  };

  const movements: Movement[] = items.map((item) => ({
    id: crypto.randomUUID(),
    productId: item.productId,
    type: "in",
    qty: item.qty,
    reason: `進貨 ${number}`,
    refId: id,
    createdAt,
  }));

  return {
    ok: true,
    data: purchase,
    state: {
      ...state,
      products,
      purchases: [purchase, ...state.purchases],
      movements: [...movements, ...state.movements],
    },
  };
}

export function removePurchase(
  state: AppState,
  purchaseId: string,
): EngineResult<Purchase> {
  const purchase = state.purchases.find((item) => item.id === purchaseId);
  if (!purchase) return { ok: false, error: "找不到進貨單" };
  const subtracted = subtractStock(state.products, qtyByProduct(purchase.items));
  if (!subtracted.ok) return subtracted;
  return {
    ok: true,
    data: purchase,
    state: {
      ...state,
      products: subtracted.products,
      purchases: state.purchases.filter((item) => item.id !== purchaseId),
      movements: state.movements.filter((item) => item.refId !== purchaseId),
    },
  };
}

export function removePurchases(state: AppState, purchaseIds: string[]) {
  return applyEach(state, purchaseIds, "請先勾選要刪的進貨", removePurchase);
}

export function applySale(
  state: AppState,
  input: {
    items: {
      productId: string;
      qty: number;
      unitPrice?: number;
      note?: string;
    }[];
    paymentMethod: PaymentMethod;
    received: number;
    note: string;
    createdAt?: string;
  },
): EngineResult<Sale> {
  if (input.items.length === 0) return { ok: false, error: "購物車是空的" };

  const lineItems: {
    product: Product;
    qty: number;
    unitPrice: number;
    note: string;
  }[] = [];
  const qtyByProduct = new Map<string, number>();
  for (const item of input.items) {
    const product = state.products.find((row) => row.id === item.productId);
    if (!product) return { ok: false, error: "找不到銷售商品" };
    const qty = Math.round(item.qty);
    const unitPrice =
      item.unitPrice == null ? product.price : Math.round(item.unitPrice);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, error: "數量必須大於 0" };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { ok: false, error: `${product.name} 的售價不可為負數` };
    }
    if (!product.active) {
      return { ok: false, error: `${product.name} 已停售` };
    }
    lineItems.push({
      product,
      qty,
      unitPrice,
      note: item.note?.trim() || "",
    });
    qtyByProduct.set(product.id, (qtyByProduct.get(product.id) ?? 0) + qty);
  }
  for (const [productId, qty] of qtyByProduct) {
    const product = state.products.find((row) => row.id === productId)!;
    if (product.stock < qty) {
      return {
        ok: false,
        error: `${product.name} 庫存不足（現有 ${product.stock}）`,
      };
    }
  }

  const items = lineItems.map(({ product, qty, unitPrice, note }) => ({
    productId: product.id,
    name: product.name,
    sku: product.sku,
    qty,
    unitPrice,
    unitCost: product.cost,
    note,
  }));
  const total = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const received =
    input.paymentMethod === "cash" ? Math.round(input.received) : total;
  if (input.paymentMethod === "cash" && received < total) {
    return { ok: false, error: "收款金額不足" };
  }

  const createdAt = input.createdAt ?? nowIso();
  const id = crypto.randomUUID();
  const number = nextSeq(
    "S-",
    state.sales.map((sale) => sale.number),
  );
  const sale: Sale = {
    id,
    number,
    createdAt,
    items,
    paymentMethod: input.paymentMethod,
    received,
    change: received - total,
    total,
    note: input.note.trim(),
    status: "completed",
  };

  const products = state.products.map((product) => {
    const sold = qtyByProduct.get(product.id);
    return sold ? { ...product, stock: product.stock - sold } : product;
  });

  const movements: Movement[] = items.map((item) => ({
    id: crypto.randomUUID(),
    productId: item.productId,
    type: "out",
    qty: item.qty,
    reason: `銷貨 ${number}`,
    refId: id,
    createdAt,
  }));

  return {
    ok: true,
    data: sale,
    state: {
      ...state,
      products,
      sales: [sale, ...state.sales],
      movements: [...movements, ...state.movements],
    },
  };
}

export function voidSale(state: AppState, saleId: string): EngineResult<Sale> {
  const sale = state.sales.find((item) => item.id === saleId);
  if (!sale) return { ok: false, error: "找不到銷貨單" };
  if (sale.status === "voided") return { ok: false, error: "此單已作廢" };
  if ((state.saleReturns ?? []).some((item) => item.saleId === saleId)) {
    return { ok: false, error: "已有退貨，不能整單作廢" };
  }

  const createdAt = nowIso();
  const addByProduct = new Map<string, number>();
  for (const item of sale.items) {
    addByProduct.set(
      item.productId,
      (addByProduct.get(item.productId) ?? 0) + item.qty,
    );
  }
  const products = state.products.map((product) => {
    const add = addByProduct.get(product.id);
    return add ? { ...product, stock: product.stock + add } : product;
  });
  const nextSale: Sale = { ...sale, status: "voided" };
  const movements: Movement[] = sale.items.map((item) => ({
    id: crypto.randomUUID(),
    productId: item.productId,
    type: "in",
    qty: item.qty,
    reason: `銷貨作廢 ${sale.number}`,
    refId: sale.id,
    createdAt,
  }));

  return {
    ok: true,
    data: nextSale,
    state: {
      ...state,
      products,
      sales: state.sales.map((item) => (item.id === saleId ? nextSale : item)),
      movements: [...movements, ...state.movements],
    },
  };
}

export function removeSale(state: AppState, saleId: string): EngineResult<Sale> {
  const sale = state.sales.find((item) => item.id === saleId);
  if (!sale) return { ok: false, error: "找不到銷貨單" };

  let current = state;
  const related = (current.saleReturns ?? []).filter(
    (item) => item.saleId === saleId,
  );
  for (const refund of related) {
    const undone = removeReturn(current, refund.id);
    if (!undone.ok) return undone;
    current = undone.state;
  }

  if (sale.status === "voided") {
    return {
      ok: true,
      data: sale,
      state: {
        ...current,
        sales: current.sales.filter((item) => item.id !== saleId),
        movements: current.movements.filter((item) => item.refId !== saleId),
      },
    };
  }

  return {
    ok: true,
    data: sale,
    state: {
      ...current,
      products: addStock(current.products, qtyByProduct(sale.items)),
      sales: current.sales.filter((item) => item.id !== saleId),
      movements: current.movements.filter((item) => item.refId !== saleId),
    },
  };
}

export function removeSales(state: AppState, saleIds: string[]) {
  return applyEach(state, saleIds, "請先勾選要刪的銷貨", removeSale);
}

export function remainingReturnQty(
  state: AppState,
  saleId: string,
  index: number,
) {
  const sale = state.sales.find((item) => item.id === saleId);
  if (!sale || sale.status !== "completed") return 0;
  const sold = sale.items[index]?.qty ?? 0;
  const returned = (state.saleReturns ?? [])
    .filter((item) => item.saleId === saleId)
    .reduce(
      (sum, item) =>
        sum +
        item.items
          .filter((line) => line.saleItemIndex === index)
          .reduce((inner, line) => inner + line.qty, 0),
      0,
    );
  return Math.max(0, sold - returned);
}

export function applyReturn(
  state: AppState,
  input: {
    saleId: string;
    lines: { index: number; qty: number }[];
    restock: boolean;
    note: string;
    createdAt?: string;
  },
): EngineResult<SaleReturn> {
  const sale = state.sales.find((item) => item.id === input.saleId);
  if (!sale) return { ok: false, error: "找不到銷貨單" };
  if (sale.status !== "completed") return { ok: false, error: "作廢單不能退貨" };

  const picked = input.lines.filter((line) => line.qty > 0);
  if (picked.length === 0) return { ok: false, error: "請填退貨數量" };

  const items: SaleReturn["items"] = [];
  for (const line of picked) {
    const source = sale.items[line.index];
    if (!source) return { ok: false, error: "找不到要退的商品" };
    const qty = Math.round(line.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, error: "退貨數量必須大於 0" };
    }
    const remaining = remainingReturnQty(state, sale.id, line.index);
    if (qty > remaining) {
      return {
        ok: false,
        error: `${source.name} 最多還能退 ${remaining} 件`,
      };
    }
    items.push({
      saleItemIndex: line.index,
      productId: source.productId,
      name: source.name,
      sku: source.sku,
      qty,
      unitPrice: source.unitPrice,
      unitCost: source.unitCost,
    });
  }

  const createdAt = input.createdAt ?? nowIso();
  const refund: SaleReturn = {
    id: crypto.randomUUID(),
    number: nextSeq(
      "RT-",
      (state.saleReturns ?? []).map((item) => item.number),
    ),
    saleId: sale.id,
    saleNumber: sale.number,
    createdAt,
    items,
    total: items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0),
    restock: input.restock,
    note: input.note.trim() || "客人退貨",
  };

  const addByProduct = new Map<string, number>();
  if (input.restock) {
    for (const item of items) {
      addByProduct.set(
        item.productId,
        (addByProduct.get(item.productId) ?? 0) + item.qty,
      );
    }
  }
  const products = state.products.map((product) => {
    const add = addByProduct.get(product.id);
    return add ? { ...product, stock: product.stock + add } : product;
  });
  const movements: Movement[] = items.map((item) => ({
    id: crypto.randomUUID(),
    productId: item.productId,
    type: input.restock ? "in" : "adjust",
    qty: item.qty,
    reason: input.restock
      ? `退貨回庫 ${refund.number}`
      : `退貨報廢 ${refund.number}`,
    refId: refund.id,
    createdAt,
  }));

  return {
    ok: true,
    data: refund,
    state: {
      ...state,
      products,
      saleReturns: [refund, ...(state.saleReturns ?? [])],
      movements: [...movements, ...state.movements],
    },
  };
}

export function applyCashRefund(
  state: AppState,
  input: {
    amount: number;
    note: string;
    createdAt?: string;
  },
): EngineResult<SaleReturn> {
  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "請填退費金額" };
  }
  const note = input.note.trim();
  if (!note) return { ok: false, error: "請填退費備註" };
  const createdAt = input.createdAt ?? nowIso();
  const refund: SaleReturn = {
    id: crypto.randomUUID(),
    number: nextSeq(
      "RF-",
      (state.saleReturns ?? []).map((item) => item.number),
    ),
    saleId: "",
    saleNumber: "收銀退費",
    createdAt,
    items: [
      {
        saleItemIndex: -1,
        productId: "",
        name: "退費",
        sku: "",
        qty: 1,
        unitPrice: amount,
        unitCost: 0,
      },
    ],
    total: amount,
    restock: false,
    note,
  };
  return {
    ok: true,
    data: refund,
    state: {
      ...state,
      saleReturns: [refund, ...(state.saleReturns ?? [])],
    },
  };
}

export function removeReturn(
  state: AppState,
  returnId: string,
): EngineResult<SaleReturn> {
  const refund = (state.saleReturns ?? []).find((item) => item.id === returnId);
  if (!refund) return { ok: false, error: "找不到這筆退貨" };
  let products = state.products;
  if (refund.restock) {
    const subtracted = subtractStock(products, qtyByProduct(refund.items));
    if (!subtracted.ok) return subtracted;
    products = subtracted.products;
  }
  return {
    ok: true,
    data: refund,
    state: {
      ...state,
      products,
      saleReturns: (state.saleReturns ?? []).filter((item) => item.id !== returnId),
      movements: state.movements.filter((item) => item.refId !== returnId),
    },
  };
}

export function removeReturns(state: AppState, returnIds: string[]) {
  return applyEach(state, returnIds, "請先勾選要刪的退貨", removeReturn);
}

export type CatalogDraft = {
  id: string;
  name: string;
  cost: number;
  price: number;
  category?: string;
  stock?: number;
};

export function applyCatalogDrafts(
  state: AppState,
  drafts: CatalogDraft[],
): EngineResult<{ updated: number; stockChanged: number }> {
  if (drafts.length === 0) return { ok: false, error: "沒有要更改的項目" };

  const products = [...state.products];
  const movements = [...state.movements];
  const createdAt = nowIso();
  let updated = 0;
  let stockChanged = 0;

  for (const draft of drafts) {
    const index = products.findIndex((item) => item.id === draft.id);
    if (index < 0) return { ok: false, error: "找不到商品" };
    const existing = products[index];
    const name = draft.name.trim();
    if (!name) return { ok: false, error: `${existing.name || "商品"}：請輸入名稱` };
    if (![draft.cost, draft.price].every(Number.isFinite)) {
      return { ok: false, error: `${existing.name} 的售價或批價不是數字` };
    }
    if (draft.price < 0 || draft.cost < 0) {
      return { ok: false, error: `${existing.name} 的價格不可為負數` };
    }
    if (draft.stock != null && (!Number.isFinite(draft.stock) || draft.stock < 0)) {
      return { ok: false, error: `${existing.name} 的數量不可為負數` };
    }

    const price = Math.round(draft.price);
    const cost = Math.round(draft.cost);
    const category =
      draft.category != null ? draft.category.trim() : existing.category;
    if (!category) {
      return { ok: false, error: `${existing.name}：請選擇分類` };
    }
    const stock =
      draft.stock == null ? existing.stock : Math.round(draft.stock);
    const catalogChanged =
      name !== existing.name ||
      price !== existing.price ||
      cost !== existing.cost ||
      category !== existing.category;
    const delta = stock - existing.stock;
    if (!catalogChanged && delta === 0) continue;

    products[index] = { ...existing, name, price, cost, stock, category };
    updated += 1;
    if (delta !== 0) {
      stockChanged += 1;
      movements.unshift({
        id: crypto.randomUUID(),
        productId: existing.id,
        type: "adjust",
        qty: Math.abs(delta),
        reason: "整理資料",
        createdAt,
      });
    }
  }

  if (updated === 0) return { ok: false, error: "沒有實際變更" };

  return {
    ok: true,
    data: { updated, stockChanged },
    state: {
      ...state,
      products,
      movements,
      settings: {
        ...state.settings,
        categories: uniqueCategories([
          ...state.settings.categories,
          ...products.map((product) => product.category),
        ]),
      },
    },
  };
}

export function adjustStock(
  state: AppState,
  input: {
    productId: string;
    stock: number;
    reason: string;
    refId?: string;
    createdAt?: string;
  },
): EngineResult<Product> {
  const product = state.products.find((item) => item.id === input.productId);
  if (!product) return { ok: false, error: "找不到商品" };
  const stock = Math.round(input.stock);
  if (stock < 0) return { ok: false, error: "庫存不可為負數" };
  const delta = stock - product.stock;
  if (delta === 0) return { ok: true, data: product, state };

  const next: Product = { ...product, stock };
  const movement: Movement = {
    id: crypto.randomUUID(),
    productId: product.id,
    type: "adjust",
    qty: Math.abs(delta),
    reason: input.reason.trim() || (delta > 0 ? "盤點盤盈" : "盤點盤虧"),
    refId: input.refId,
    createdAt: input.createdAt ?? nowIso(),
  };

  return {
    ok: true,
    data: next,
    state: {
      ...state,
      products: state.products.map((item) =>
        item.id === product.id ? next : item,
      ),
      movements: [movement, ...state.movements],
    },
  };
}

export function inventoryValue(state: AppState) {
  return state.products.reduce(
    (sum, product) => sum + product.stock * product.cost,
    0,
  );
}

export function lowStockProducts(state: AppState) {
  return state.products.filter(
    (product) => product.active && product.stock <= product.minStock,
  );
}

export function profitOf(sale: Sale) {
  if (sale.status === "voided") return 0;
  return sale.items.reduce(
    (sum, item) => sum + (item.unitPrice - item.unitCost) * item.qty,
    0,
  );
}

export function monthStocktakeTitle(date = new Date()) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月盤點`;
}

export function stocktakeCountedAt(sheet: {
  countedAt?: string;
  createdAt: string;
}) {
  return sheet.countedAt || sheet.createdAt;
}

function sortStocktakeProducts(products: Product[]) {
  return products.slice().sort((a, b) => {
    const category = a.category.localeCompare(b.category, "zh-Hant");
    if (category !== 0) return category;
    return a.name.localeCompare(b.name, "zh-Hant");
  });
}

function sameStocktakeLine(left: StocktakeLine, right: StocktakeLine) {
  return (
    left.productId === right.productId &&
    left.name === right.name &&
    left.sku === right.sku &&
    left.category === right.category &&
    left.bin === right.bin &&
    left.unit === right.unit &&
    left.bookQty === right.bookQty &&
    left.countedQty === right.countedQty
  );
}

export function linesForStocktake(
  products: Product[],
  existing: StocktakeLine[] = [],
): StocktakeLine[] {
  const previous = new Map(existing.map((line) => [line.productId, line]));
  const catalogIds = new Set(products.map((product) => product.id));
  const lines = sortStocktakeProducts(products).map((product) => {
    const current = previous.get(product.id);
    if (current) {
      return {
        ...current,
        name: product.name,
        sku: product.sku,
        category: product.category,
        bin: current.bin ?? "",
        unit: product.unit,
      };
    }
    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      category: product.category,
      bin: "",
      unit: product.unit,
      bookQty: product.stock,
      countedQty: null,
    };
  });
  for (const line of existing) {
    if (!catalogIds.has(line.productId) && line.countedQty != null) {
      lines.push({ ...line, bin: line.bin ?? "" });
    }
  }
  return lines;
}

export function syncDraftStocktakes(state: AppState): AppState {
  const sheets = state.stocktakes ?? [];
  let changed = false;
  const stocktakes = sheets.map((sheet) => {
    if (sheet.status !== "draft") return sheet;
    const lines = linesForStocktake(state.products, sheet.lines);
    if (
      lines.length === sheet.lines.length &&
      lines.every((line, index) => sameStocktakeLine(line, sheet.lines[index]))
    ) {
      return sheet;
    }
    changed = true;
    return { ...sheet, lines };
  });
  return changed ? { ...state, stocktakes } : state;
}

export function stocktakeSummary(lines: StocktakeLine[]) {
  let pending = 0;
  let match = 0;
  let missing = 0;
  let surplus = 0;
  let missingQty = 0;
  let surplusQty = 0;
  for (const line of lines) {
    if (line.countedQty == null) {
      pending += 1;
      continue;
    }
    const diff = line.countedQty - line.bookQty;
    if (diff < 0) {
      missing += 1;
      missingQty += -diff;
    } else if (diff > 0) {
      surplus += 1;
      surplusQty += diff;
    } else {
      match += 1;
    }
  }
  return {
    pending,
    match,
    missing,
    surplus,
    missingQty,
    surplusQty,
    counted: lines.length - pending,
    total: lines.length,
  };
}

export function startStocktake(
  state: AppState,
  input: { title?: string; note?: string; countedAt?: string } = {},
): EngineResult<Stocktake> {
  const lines = linesForStocktake(state.products);
  if (lines.length === 0) return { ok: false, error: "沒有可盤點的商品" };

  const countedAt = input.countedAt ?? nowIso();
  const title = input.title?.trim() || monthStocktakeTitle(new Date(countedAt));
  const stocktake: Stocktake = {
    id: crypto.randomUUID(),
    number: nextSeq(
      "PD-",
      (state.stocktakes ?? []).map((item) => item.number),
    ),
    title,
    createdAt: nowIso(),
    countedAt,
    note: input.note?.trim() || "",
    status: "draft",
    lines,
  };

  return {
    ok: true,
    data: stocktake,
    state: {
      ...state,
      stocktakes: [stocktake, ...(state.stocktakes ?? [])],
    },
  };
}

export function saveStocktakeCounts(
  state: AppState,
  input: { id: string; counts: Record<string, number | null>; note?: string },
): EngineResult<Stocktake> {
  const current = (state.stocktakes ?? []).find((item) => item.id === input.id);
  if (!current) return { ok: false, error: "找不到盤點單" };
  if (current.status !== "draft") return { ok: false, error: "此單已入帳，不能再改" };

  const lines = current.lines.map((line) => {
    if (!Object.prototype.hasOwnProperty.call(input.counts, line.productId)) {
      return line;
    }
    const raw = input.counts[line.productId];
    if (raw == null) return { ...line, countedQty: null };
    if (!Number.isFinite(raw) || raw < 0) return line;
    return { ...line, countedQty: Math.round(raw) };
  });

  const stocktake: Stocktake = {
    ...current,
    lines,
    note: input.note !== undefined ? input.note.trim() : current.note,
  };

  return {
    ok: true,
    data: stocktake,
    state: {
      ...state,
      stocktakes: (state.stocktakes ?? []).map((item) =>
        item.id === stocktake.id ? stocktake : item,
      ),
    },
  };
}

export function saveStocktakeBins(
  state: AppState,
  input: { id: string; bins: Record<string, string> },
): EngineResult<Stocktake> {
  const current = (state.stocktakes ?? []).find((item) => item.id === input.id);
  if (!current) return { ok: false, error: "找不到盤點單" };
  if (current.status !== "draft") return { ok: false, error: "此單已入帳，不能再改" };

  const lines = current.lines.map((line) => {
    if (!Object.prototype.hasOwnProperty.call(input.bins, line.productId)) {
      return line;
    }
    return { ...line, bin: input.bins[line.productId].trim() };
  });

  const stocktake: Stocktake = { ...current, lines };
  return {
    ok: true,
    data: stocktake,
    state: {
      ...state,
      stocktakes: (state.stocktakes ?? []).map((item) =>
        item.id === stocktake.id ? stocktake : item,
      ),
    },
  };
}

export function setStocktakeCountedAt(
  state: AppState,
  input: { id: string; countedAt: string },
): EngineResult<Stocktake> {
  const current = (state.stocktakes ?? []).find((item) => item.id === input.id);
  if (!current) return { ok: false, error: "找不到盤點單" };
  if (!input.countedAt) return { ok: false, error: "請選盤點日期" };
  const autoTitle = /^\d+年\d+月盤點$/.test(current.title);
  const stocktake: Stocktake = {
    ...current,
    countedAt: input.countedAt,
    title: autoTitle
      ? monthStocktakeTitle(new Date(input.countedAt))
      : current.title,
  };
  const movements =
    current.status === "confirmed"
      ? state.movements.map((item) =>
          item.refId === current.id
            ? { ...item, createdAt: input.countedAt }
            : item,
        )
      : state.movements;
  return {
    ok: true,
    data: stocktake,
    state: {
      ...state,
      stocktakes: (state.stocktakes ?? []).map((item) =>
        item.id === stocktake.id ? stocktake : item,
      ),
      movements,
    },
  };
}

export function confirmStocktake(
  state: AppState,
  input: { id: string },
): EngineResult<Stocktake> {
  const current = (state.stocktakes ?? []).find((item) => item.id === input.id);
  if (!current) return { ok: false, error: "找不到盤點單" };
  if (current.status !== "draft") return { ok: false, error: "此單已入帳" };

  const counted = current.lines.filter((line) => line.countedQty != null);
  if (counted.length === 0) {
    return { ok: false, error: "請先填實盤數量" };
  }

  let next = state;
  for (const line of counted) {
    const result = adjustStock(next, {
      productId: line.productId,
      stock: line.countedQty as number,
      reason: `盤點單 ${current.number}`,
      refId: current.id,
      createdAt: stocktakeCountedAt(current),
    });
    if (!result.ok) return result;
    next = result.state;
  }

  const stocktake: Stocktake = {
    ...current,
    status: "confirmed",
    confirmedAt: nowIso(),
  };

  return {
    ok: true,
    data: stocktake,
    state: {
      ...next,
      stocktakes: (next.stocktakes ?? []).map((item) =>
        item.id === stocktake.id ? stocktake : item,
      ),
    },
  };
}

export function discardStocktake(
  state: AppState,
  input: { id: string },
): EngineResult<Stocktake> {
  const current = (state.stocktakes ?? []).find((item) => item.id === input.id);
  if (!current) return { ok: false, error: "找不到盤點單" };

  let products = state.products;
  if (current.status === "confirmed") {
    for (const line of current.lines) {
      if (line.countedQty == null) continue;
      const product = products.find((item) => item.id === line.productId);
      if (!product) continue;
      const restored = product.stock - line.countedQty + line.bookQty;
      if (restored < 0) {
        return {
          ok: false,
          error: `${product.name} 庫存不夠扣回（現有 ${product.stock}）`,
        };
      }
      products = products.map((item) =>
        item.id === product.id ? { ...item, stock: restored } : item,
      );
    }
  }

  return {
    ok: true,
    data: current,
    state: {
      ...state,
      products,
      stocktakes: (state.stocktakes ?? []).filter((item) => item.id !== input.id),
      movements: state.movements.filter(
        (item) =>
          item.refId !== current.id &&
          item.reason !== `盤點單 ${current.number}`,
      ),
    },
  };
}

export function addExpense(
  state: AppState,
  input: {
    title: string;
    category: string;
    amount: number;
    note: string;
    createdAt?: string;
  },
): EngineResult<Expense> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "請填支出項目" };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "金額必須大於 0" };
  }
  const createdAt = input.createdAt ?? nowIso();
  const expense: Expense = {
    id: crypto.randomUUID(),
    number: nextSeq(
      "EX-",
      (state.expenses ?? []).map((item) => item.number),
    ),
    createdAt,
    title,
    category: input.category.trim(),
    amount: Math.round(input.amount),
    note: input.note.trim(),
  };
  return {
    ok: true,
    data: expense,
    state: {
      ...state,
      expenses: [expense, ...(state.expenses ?? [])],
    },
  };
}

export function removeExpense(
  state: AppState,
  expenseId: string,
): EngineResult<Expense> {
  const existing = (state.expenses ?? []).find((item) => item.id === expenseId);
  if (!existing) return { ok: false, error: "找不到這筆支出" };
  return {
    ok: true,
    data: existing,
    state: {
      ...state,
      expenses: (state.expenses ?? []).filter((item) => item.id !== expenseId),
    },
  };
}

export function removeExpenses(state: AppState, expenseIds: string[]) {
  return applyEach(state, expenseIds, "請先勾選要刪的支出", removeExpense);
}
