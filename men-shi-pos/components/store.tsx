"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  addBin,
  addCategory,
  addExpense,
  adjustStock,
  applyCatalogDrafts,
  applyPurchase,
  applyReturn,
  applyCashRefund,
  applySale,
  confirmStocktake,
  discardStocktake,
  emptyState,
  saveStocktakeBins,
  saveStocktakeCounts,
  setStocktakeCountedAt,
  removeBin,
  removeCategory,
  removeExpense,
  removeExpenses,
  removeProduct,
  removeProducts,
  removePurchase,
  removePurchases,
  removeReturn,
  removeReturns,
  removeSale,
  removeSales,
  renameBin,
  renameCategory,
  setProductActive,
  startStocktake,
  syncDraftStocktakes,
  upsertProduct,
  voidSale,
  type CatalogDraft,
} from "@/lib/engine";
import {
  DEFAULT_SHOP_NAME,
  defaultSettings,
  categoryCustomizationScore,
  mergeCategoryLists,
  normalizeSettings,
  uniqueCategories,
} from "@/lib/shop";
import {
  BRANCHES,
  branchName,
  isBranchId,
  type BranchId,
  type Workspace,
} from "@/lib/branches";
import type {
  AppState,
  Category,
  PaymentMethod,
  Product,
  ShopSettings,
  StocktakeLine,
  Unit,
} from "@/lib/types";

const STORAGE_KEY = "corner-pos-v6";
const BACKUP_KEY = "corner-pos-v6-bak";
const LEGACY_KEYS = [
  "corner-pos-v5",
  "corner-pos-v5-bak",
  "corner-pos-v4",
  "corner-pos-v3",
];

type StoreContextValue = {
  ready: boolean;
  storeId: BranchId;
  storeName: string;
  branches: typeof BRANCHES;
  allStores: { id: BranchId; name: string; state: AppState }[];
  switchStore: (id: BranchId) => void;
  state: AppState;
  addProduct: (input: {
    sku: string;
    name: string;
    category: Category;
    unit: Unit;
    cost: number;
    price: number;
    minStock: number;
  }) => { ok: true; product: Product } | { ok: false; error: string };
  updateProduct: (input: {
    id: string;
    sku: string;
    name: string;
    category: Category;
    unit: Unit;
    cost: number;
    price: number;
    minStock: number;
  }) => { ok: true; product: Product } | { ok: false; error: string };
  setActive: (productId: string, active: boolean) => void;
  removeProduct: (
    productId: string,
  ) => ReturnType<typeof removeProduct>;
  removeProducts: (
    productIds: string[],
  ) => ReturnType<typeof removeProducts>;
  applyCatalogDrafts: (
    drafts: CatalogDraft[],
  ) => ReturnType<typeof applyCatalogDrafts>;
  receiveStock: (input: {
    supplier?: string;
    note: string;
    items: {
      productId: string;
      qty: number;
      unitCost: number;
      unitPrice?: number;
    }[];
    createdAt?: string;
  }) => ReturnType<typeof applyPurchase>;
  checkout: (
    input: Parameters<typeof applySale>[1],
  ) => ReturnType<typeof applySale>;
  voidCompletedSale: (saleId: string) => ReturnType<typeof voidSale>;
  removeSale: (saleId: string) => ReturnType<typeof removeSale>;
  removeSales: (saleIds: string[]) => ReturnType<typeof removeSales>;
  removePurchase: (purchaseId: string) => ReturnType<typeof removePurchase>;
  removePurchases: (
    purchaseIds: string[],
  ) => ReturnType<typeof removePurchases>;
  removeReturn: (returnId: string) => ReturnType<typeof removeReturn>;
  removeReturns: (returnIds: string[]) => ReturnType<typeof removeReturns>;
  returnSale: (
    input: Parameters<typeof applyReturn>[1],
  ) => ReturnType<typeof applyReturn>;
  refundCash: (
    input: Parameters<typeof applyCashRefund>[1],
  ) => ReturnType<typeof applyCashRefund>;
  recount: (input: {
    productId: string;
    stock: number;
    reason: string;
  }) => ReturnType<typeof adjustStock>;
  startStocktake: (
    input?: Parameters<typeof startStocktake>[1],
  ) => ReturnType<typeof startStocktake>;
  saveStocktakeCounts: (
    input: Parameters<typeof saveStocktakeCounts>[1],
  ) => ReturnType<typeof saveStocktakeCounts>;
  saveStocktakeBins: (
    input: Parameters<typeof saveStocktakeBins>[1],
  ) => ReturnType<typeof saveStocktakeBins>;
  setStocktakeCountedAt: (
    input: Parameters<typeof setStocktakeCountedAt>[1],
  ) => ReturnType<typeof setStocktakeCountedAt>;
  confirmStocktake: (
    input: Parameters<typeof confirmStocktake>[1],
  ) => ReturnType<typeof confirmStocktake>;
  discardStocktake: (
    input: Parameters<typeof discardStocktake>[1],
  ) => ReturnType<typeof discardStocktake>;
  refreshStocktakeCatalog: () => AppState;
  updateSettings: (settings: ShopSettings) => void;
  setCheckoutOrder: (ids: string[]) => void;
  addCategory: (name: string) => ReturnType<typeof addCategory>;
  renameCategory: (
    from: string,
    to: string,
  ) => ReturnType<typeof renameCategory>;
  removeCategory: (name: string) => ReturnType<typeof removeCategory>;
  addBin: (name: string) => ReturnType<typeof addBin>;
  renameBin: (from: string, to: string) => ReturnType<typeof renameBin>;
  removeBin: (name: string) => ReturnType<typeof removeBin>;
  addExpense: (
    input: Parameters<typeof addExpense>[1],
  ) => ReturnType<typeof addExpense>;
  removeExpense: (expenseId: string) => ReturnType<typeof removeExpense>;
  removeExpenses: (expenseIds: string[]) => ReturnType<typeof removeExpenses>;
  clearCatalog: () => void;
  exportBackup: () => string;
  importBackup: (raw: string) => { ok: true } | { ok: false; error: string };
  spreadCatalogNow: () => void;
  exportCatalog: () => string;
  importCatalog: (raw: string) => { ok: true } | { ok: false; error: string };
};

const StoreContext = createContext<StoreContextValue | null>(null);

const listeners = new Set<() => void>();
let memory: Workspace | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function sanitizeState(value: unknown): AppState | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<AppState>;
  if (!Array.isArray(parsed.products)) return null;
  try {
    return syncDraftStocktakes({
      products: parsed.products.map((product) => ({
        ...product,
        bin: typeof product.bin === "string" ? product.bin : "",
      })),
      purchases: asList(parsed.purchases),
      sales: asList(parsed.sales),
      movements: asList(parsed.movements),
      stocktakes: asList<AppState["stocktakes"][number]>(parsed.stocktakes).map(
        (sheet) => ({
          ...sheet,
          countedAt:
            typeof sheet.countedAt === "string" && sheet.countedAt
              ? sheet.countedAt
              : sheet.createdAt,
          lines: asList<StocktakeLine>(sheet.lines).map((line) => ({
            ...line,
            bin: typeof line.bin === "string" ? line.bin : "",
          })),
        }),
      ),
      expenses: asList(parsed.expenses),
      saleReturns: asList(parsed.saleReturns),
      checkoutOrder: asList<string>(parsed.checkoutOrder).filter(
        (item) => typeof item === "string",
      ),
      settings: normalizeSettings(parsed.settings),
    });
  } catch {
    return null;
  }
}

function parseStored(raw: string | null): AppState | null {
  if (!raw) return null;
  try {
    return sanitizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function hasShopWork(state: AppState) {
  const shopName = state.settings.shopName?.trim() ?? "";
  return (
    state.products.length > 0 ||
    state.purchases.length > 0 ||
    state.sales.length > 0 ||
    state.expenses.length > 0 ||
    (state.stocktakes ?? []).length > 0 ||
    categoryCustomizationScore(state.settings.categories) > 0 ||
    (shopName !== "" && shopName !== DEFAULT_SHOP_NAME)
  );
}

function workScore(state: AppState) {
  const shopName = state.settings.shopName?.trim() ?? "";
  return (
    state.products.length * 10 +
    state.purchases.length +
    state.sales.length +
    state.expenses.length +
    (state.stocktakes ?? []).length +
    categoryCustomizationScore(state.settings.categories) +
    (shopName !== "" && shopName !== DEFAULT_SHOP_NAME ? 3 : 0)
  );
}

function pickRicher(candidates: Array<AppState | null>): AppState | null {
  let best: AppState | null = null;
  for (const item of candidates) {
    if (!item) continue;
    if (!best || workScore(item) > workScore(best)) best = item;
  }
  return best;
}

function emptyShop(name: string): AppState {
  return {
    ...emptyState,
    settings: normalizeSettings({
      ...defaultSettings(),
      shopName: name,
    }),
  };
}

function emptyWorkspace(): Workspace {
  const stores = {} as Record<BranchId, AppState>;
  for (const branch of BRANCHES) {
    stores[branch.id] = emptyShop(branch.name);
  }
  return { version: 6, currentStoreId: "xiluo", stores };
}

function workspaceHasWork(workspace: Workspace) {
  return BRANCHES.some((branch) => hasShopWork(workspace.stores[branch.id]));
}

function workspaceScore(workspace: Workspace) {
  return BRANCHES.reduce(
    (sum, branch) => sum + workScore(workspace.stores[branch.id]),
    0,
  );
}

function sanitizeWorkspace(value: unknown): Workspace | null {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<Workspace>;
  if (parsed.version !== 6 || !parsed.stores || typeof parsed.stores !== "object") {
    return null;
  }
  const workspace = emptyWorkspace();
  if (parsed.currentStoreId && isBranchId(parsed.currentStoreId)) {
    workspace.currentStoreId = parsed.currentStoreId;
  }
  for (const branch of BRANCHES) {
    const slice = sanitizeState(parsed.stores[branch.id]);
    if (slice) {
      workspace.stores[branch.id] = {
        ...slice,
        settings: normalizeSettings({
          ...slice.settings,
          shopName: slice.settings.shopName?.trim() || branch.name,
        }),
      };
    }
  }
  return workspace;
}

function parseWorkspace(raw: string | null): Workspace | null {
  if (!raw) return null;
  try {
    return sanitizeWorkspace(JSON.parse(raw));
  } catch {
    return null;
  }
}

function workspaceFromLegacy(state: AppState): Workspace {
  const workspace = emptyWorkspace();
  const label = state.settings.shopName?.trim() || "";
  workspace.stores.xiluo = {
    ...state,
    settings: normalizeSettings({
      ...state.settings,
      shopName: label.includes("西螺") || label === DEFAULT_SHOP_NAME ? "西螺" : label || "西螺",
    }),
  };
  return workspace;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function loadWorkspace(): Workspace {
  if (!canUseStorage()) return emptyWorkspace();
  const current = parseWorkspace(localStorage.getItem(STORAGE_KEY));
  const backup = parseWorkspace(localStorage.getItem(BACKUP_KEY));
  const richer =
    current && backup
      ? workspaceScore(current) >= workspaceScore(backup)
        ? current
        : backup
      : current ?? backup;
  if (richer && workspaceHasWork(richer)) {
    const unified = unifySharedCatalog(richer);
    persist(unified);
    return unified;
  }

  const older = LEGACY_KEYS.map((key) => parseStored(localStorage.getItem(key)));
  const recovered = pickRicher(older);
  if (recovered && hasShopWork(recovered)) {
    return unifySharedCatalog(workspaceFromLegacy(recovered));
  }
  return emptyWorkspace();
}

function persist(workspace: Workspace, options?: { force?: boolean }) {
  if (!canUseStorage()) return;
  try {
    const existing = parseWorkspace(localStorage.getItem(STORAGE_KEY));
    if (
      !options?.force &&
      existing &&
      workspaceHasWork(existing) &&
      !workspaceHasWork(workspace)
    ) {
      return;
    }
    const raw = JSON.stringify(workspace);
    localStorage.setItem(STORAGE_KEY, raw);
    if (workspaceHasWork(workspace)) {
      localStorage.setItem(BACKUP_KEY, raw);
    }
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function readWorkspace(): Workspace {
  if (!memory) {
    memory = loadWorkspace();
  }
  return memory;
}

function read(): AppState {
  const workspace = readWorkspace();
  return workspace.stores[workspace.currentStoreId];
}

function spreadCatalog(workspace: Workspace, source: AppState): Workspace {
  const stores = { ...workspace.stores };
  for (const branch of BRANCHES) {
    if (branch.id === workspace.currentStoreId) {
      stores[branch.id] = source;
      continue;
    }
    const current = stores[branch.id];
    const previous = new Map(current.products.map((item) => [item.id, item]));
    stores[branch.id] = {
      ...current,
      products: source.products.map((item) => {
        const existing = previous.get(item.id);
        return {
          ...item,
          stock: existing?.stock ?? 0,
          bin: existing?.bin ?? "",
        };
      }),
      settings: {
        ...current.settings,
        categories: [...source.settings.categories],
        bins: [...source.settings.bins],
        sop: source.settings.sop.map((section) => ({ ...section })),
      },
    };
  }
  return { ...workspace, stores };
}

const CATALOG_KIND = "corner-pos-catalog-v6";

function catalogFromState(state: AppState) {
  return {
    kind: CATALOG_KIND,
    products: state.products.map((item) => ({
      ...item,
      stock: 0,
      bin: "",
    })),
    categories: [...state.settings.categories],
    bins: [...state.settings.bins],
    sop: state.settings.sop.map((section) => ({ ...section })),
  };
}

function applyCatalogFields(input: {
  products: Product[];
  categories: string[];
  bins: string[];
  sop: AppState["settings"]["sop"];
}) {
  const current = read();
  const previous = new Map(current.products.map((item) => [item.id, item]));
  commitCatalog(
    {
      ...current,
      products: input.products.map((item) => {
        const existing = previous.get(item.id);
        return {
          ...item,
          stock: existing?.stock ?? 0,
          bin: existing?.bin ?? "",
        };
      }),
      settings: {
        ...current.settings,
        categories: uniqueCategories(input.categories),
        bins: uniqueCategories(input.bins),
        sop: input.sop.map((section) => ({ ...section })),
      },
    },
    { force: true },
  );
}

function parseCatalog(raw: string):
  | { ok: true }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "檔案打不開" };
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    (parsed as { kind?: string }).kind === CATALOG_KIND
  ) {
    const body = parsed as ReturnType<typeof catalogFromState>;
    if (!Array.isArray(body.products)) {
      return { ok: false, error: "這不是總商品檔" };
    }
    applyCatalogFields({
      products: body.products,
      categories: body.categories ?? [],
      bins: body.bins ?? [],
      sop: body.sop ?? [],
    });
    return { ok: true };
  }
  const workspace = sanitizeWorkspace(parsed);
  if (workspace && workspaceHasWork(workspace)) {
    const unified = unifySharedCatalog(workspace);
    const source = unified.stores[unified.currentStoreId];
    applyCatalogFields({
      products: source.products,
      categories: source.settings.categories,
      bins: source.settings.bins,
      sop: source.settings.sop,
    });
    return { ok: true };
  }
  const next = sanitizeState(parsed);
  if (!next || next.products.length === 0) {
    return { ok: false, error: "這不是總商品檔" };
  }
  applyCatalogFields({
    products: next.products,
    categories: next.settings.categories,
    bins: next.settings.bins,
    sop: next.settings.sop,
  });
  return { ok: true };
}

function renameBinsEverywhere(workspace: Workspace, from: string, to: string): Workspace {
  const stores = { ...workspace.stores };
  for (const branch of BRANCHES) {
    const current = stores[branch.id];
    stores[branch.id] = {
      ...current,
      products: current.products.map((item) =>
        item.bin === from ? { ...item, bin: to } : item,
      ),
      stocktakes: (current.stocktakes ?? []).map((sheet) => ({
        ...sheet,
        lines: sheet.lines.map((line) =>
          line.bin === from ? { ...line, bin: to } : line,
        ),
      })),
    };
  }
  return { ...workspace, stores };
}

function unifySharedCatalog(workspace: Workspace): Workspace {
  let richestId: BranchId = BRANCHES[0].id;
  for (const branch of BRANCHES) {
    if (
      workspace.stores[branch.id].products.length >
      workspace.stores[richestId].products.length
    ) {
      richestId = branch.id;
    }
  }
  const catalog: Product[] = [];
  const seenIds = new Set<string>();
  const seenSkus = new Set<string>();
  const addAll = (list: Product[]) => {
    for (const item of list) {
      if (seenIds.has(item.id) || seenSkus.has(item.sku)) continue;
      catalog.push(item);
      seenIds.add(item.id);
      seenSkus.add(item.sku);
    }
  };
  addAll(workspace.stores[richestId].products);
  for (const branch of BRANCHES) {
    addAll(workspace.stores[branch.id].products);
  }
  const categories = mergeCategoryLists(
    BRANCHES.map((branch) => workspace.stores[branch.id].settings.categories ?? []),
    catalog.map((item) => item.category),
  );
  const bins = uniqueCategories(
    BRANCHES.flatMap((branch) => workspace.stores[branch.id].settings.bins ?? []),
  );
  let systemId: BranchId = richestId;
  let systemScore = -1;
  for (const branch of BRANCHES) {
    const settings = workspace.stores[branch.id].settings;
    const score =
      (settings.bins?.length ?? 0) * 20 +
      (settings.sop?.reduce((sum, item) => sum + item.body.length, 0) ?? 0);
    if (score > systemScore) {
      systemScore = score;
      systemId = branch.id;
    }
  }
  const currentId = workspace.currentStoreId;
  const source: AppState = {
    ...workspace.stores[currentId],
    products: catalog.map((item) => {
      const existing = workspace.stores[currentId].products.find(
        (row) => row.id === item.id,
      );
      return {
        ...item,
        stock: existing?.stock ?? 0,
        bin: existing?.bin ?? item.bin ?? "",
      };
    }),
    settings: {
      ...workspace.stores[currentId].settings,
      categories,
      bins,
      sop: workspace.stores[systemId].settings.sop.map((section) => ({
        ...section,
      })),
    },
  };
  return spreadCatalog(workspace, source);
}

function commit(next: AppState, options?: { force?: boolean }) {
  const workspace = readWorkspace();
  memory = {
    ...workspace,
    stores: {
      ...workspace.stores,
      [workspace.currentStoreId]: next,
    },
  };
  persist(memory, options);
  emit();
}

function commitWorkspace(next: Workspace, options?: { force?: boolean }) {
  memory = next;
  persist(next, options);
  emit();
}

function commitCatalog(next: AppState, options?: { force?: boolean }) {
  const synced = syncDraftStocktakes(next);
  commitWorkspace(spreadCatalog(readWorkspace(), synced), options);
}

function getServerSnapshot() {
  return emptyState;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, read, getServerSnapshot);

  const value = useMemo<StoreContextValue>(
    () => ({
      ready: true,
      storeId: readWorkspace().currentStoreId,
      storeName: branchName(readWorkspace().currentStoreId),
      branches: BRANCHES,
      allStores: BRANCHES.map((branch) => ({
        id: branch.id,
        name: branch.name,
        state: readWorkspace().stores[branch.id],
      })),
      switchStore: (id) => {
        const workspace = readWorkspace();
        if (workspace.currentStoreId === id) return;
        commitWorkspace({ ...workspace, currentStoreId: id });
      },
      state,
      addProduct: (input) => {
        const result = upsertProduct(read(), input);
        if (!result.ok) return result;
        commitCatalog(result.state);
        return { ok: true, product: result.data };
      },
      updateProduct: (input) => {
        const result = upsertProduct(read(), input);
        if (!result.ok) return result;
        commitCatalog(result.state);
        return { ok: true, product: result.data };
      },
      setActive: (productId, active) => {
        const result = setProductActive(read(), productId, active);
        if (result.ok) commitCatalog(result.state);
      },
      removeProduct: (productId) => {
        const result = removeProduct(read(), productId);
        if (result.ok) commitCatalog(result.state);
        return result;
      },
      removeProducts: (productIds) => {
        const result = removeProducts(read(), productIds);
        if (result.ok) commitCatalog(result.state);
        return result;
      },
      applyCatalogDrafts: (drafts) => {
        const result = applyCatalogDrafts(read(), drafts);
        if (result.ok) commitCatalog(result.state);
        return result;
      },
      receiveStock: (input) => {
        const result = applyPurchase(read(), input);
        if (result.ok) commit(result.state);
        return result;
      },
      checkout: (input) => {
        const result = applySale(read(), input);
        if (result.ok) commit(result.state);
        return result;
      },
      voidCompletedSale: (saleId) => {
        const result = voidSale(read(), saleId);
        if (result.ok) commit(result.state);
        return result;
      },
      removeSale: (saleId) => {
        const result = removeSale(read(), saleId);
        if (result.ok) commit(result.state);
        return result;
      },
      removeSales: (saleIds) => {
        const result = removeSales(read(), saleIds);
        if (result.ok) commit(result.state);
        return result;
      },
      removePurchase: (purchaseId) => {
        const result = removePurchase(read(), purchaseId);
        if (result.ok) commit(result.state);
        return result;
      },
      removePurchases: (purchaseIds) => {
        const result = removePurchases(read(), purchaseIds);
        if (result.ok) commit(result.state);
        return result;
      },
      removeReturn: (returnId) => {
        const result = removeReturn(read(), returnId);
        if (result.ok) commit(result.state);
        return result;
      },
      removeReturns: (returnIds) => {
        const result = removeReturns(read(), returnIds);
        if (result.ok) commit(result.state);
        return result;
      },
      returnSale: (input) => {
        const result = applyReturn(read(), input);
        if (result.ok) commit(result.state);
        return result;
      },
      refundCash: (input) => {
        const result = applyCashRefund(read(), input);
        if (result.ok) commit(result.state);
        return result;
      },
      recount: (input) => {
        const result = adjustStock(read(), input);
        if (result.ok) commit(result.state);
        return result;
      },
      startStocktake: (input) => {
        const result = startStocktake(read(), input);
        if (result.ok) commit(result.state);
        return result;
      },
      saveStocktakeCounts: (input) => {
        const result = saveStocktakeCounts(read(), input);
        if (result.ok) commit(result.state);
        return result;
      },
      saveStocktakeBins: (input) => {
        const result = saveStocktakeBins(read(), input);
        if (result.ok) commit(result.state);
        return result;
      },
      setStocktakeCountedAt: (input) => {
        const result = setStocktakeCountedAt(read(), input);
        if (result.ok) commit(result.state);
        return result;
      },
      confirmStocktake: (input) => {
        const result = confirmStocktake(read(), input);
        if (result.ok) commit(result.state);
        return result;
      },
      discardStocktake: (input) => {
        const result = discardStocktake(read(), input);
        if (result.ok) commit(result.state);
        return result;
      },
      refreshStocktakeCatalog: () => {
        const current = read();
        const next = syncDraftStocktakes(current);
        if (next !== current) commit(next);
        return next;
      },
      updateSettings: (settings) => {
        const current = read();
        commitCatalog({
          ...current,
          settings: normalizeSettings(settings),
        });
      },
      setCheckoutOrder: (ids) => {
        commit({
          ...read(),
          checkoutOrder: ids.filter((item) => typeof item === "string"),
        });
      },
      addCategory: (name) => {
        const result = addCategory(read(), name);
        if (result.ok) commitCatalog(result.state);
        return result;
      },
      renameCategory: (from, to) => {
        const result = renameCategory(read(), from, to);
        if (result.ok) commitCatalog(result.state);
        return result;
      },
      removeCategory: (name) => {
        const result = removeCategory(read(), name);
        if (result.ok) commitCatalog(result.state);
        return result;
      },
      addBin: (name) => {
        const result = addBin(read(), name);
        if (result.ok) commitCatalog(result.state);
        return result;
      },
      renameBin: (from, to) => {
        const result = renameBin(read(), from, to);
        if (!result.ok) return result;
        const synced = syncDraftStocktakes(result.state);
        commitWorkspace(
          renameBinsEverywhere(
            spreadCatalog(readWorkspace(), synced),
            from.trim(),
            to.trim(),
          ),
        );
        return result;
      },
      removeBin: (name) => {
        const result = removeBin(read(), name);
        if (result.ok) commitCatalog(result.state);
        return result;
      },
      addExpense: (input) => {
        const result = addExpense(read(), input);
        if (result.ok) commit(result.state);
        return result;
      },
      removeExpense: (expenseId) => {
        const result = removeExpense(read(), expenseId);
        if (result.ok) commit(result.state);
        return result;
      },
      removeExpenses: (expenseIds) => {
        const result = removeExpenses(read(), expenseIds);
        if (result.ok) commit(result.state);
        return result;
      },
      clearCatalog: () => {
        const current = read();
        commitCatalog(
          {
            ...current,
            products: [],
          },
          { force: true },
        );
      },
      exportBackup: () => JSON.stringify(read(), null, 2),
      importBackup: (raw) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return { ok: false, error: "備份檔打不開" };
        }
        const workspace = sanitizeWorkspace(parsed);
        if (workspace && workspaceHasWork(workspace)) {
          commitWorkspace(workspace, { force: true });
          return { ok: true };
        }
        const next = sanitizeState(parsed);
        if (!next || !hasShopWork(next)) {
          return { ok: false, error: "這不是可用的店舖備份" };
        }
        commitCatalog(next, { force: true });
        return { ok: true };
      },
      spreadCatalogNow: () => {
        commitWorkspace(unifySharedCatalog(readWorkspace()), { force: true });
      },
      exportCatalog: () => {
        const unified = unifySharedCatalog(readWorkspace());
        commitWorkspace(unified, { force: true });
        return JSON.stringify(
          catalogFromState(unified.stores[unified.currentStoreId]),
          null,
          2,
        );
      },
      importCatalog: (raw) => parseCatalog(raw),
    }),
    [state],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return context;
}
