"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChipListManager } from "@/components/chip-list-manager";
import { twd } from "@/lib/format";
import {
  comboCost,
  comboListTotal,
  comboPartsOf,
  isCombo,
  priceTiersOf,
} from "@/lib/pricing";
import { normalizeSettings } from "@/lib/shop";
import { useStore } from "@/lib/store";
import { UNITS, type Product, type Unit } from "@/lib/types";
import { cn } from "@/lib/utils";

type FormState = {
  sku: string;
  name: string;
  category: string;
  unit: Unit;
  cost: string;
  price: string;
  minStock: string;
  asCombo: boolean;
  comboParts: { productId: string; qty: string }[];
  pickId: string;
  pickQty: string;
  tiers: { qty: string; total: string }[];
};

type RowDraft = {
  name: string;
  price: string;
  cost: string;
  category: string;
};

type ChangeLine = {
  id: string;
  name: string;
  parts: string[];
};

function emptyForm(category: string): FormState {
  return {
    sku: "",
    name: "",
    category,
    unit: "個",
    cost: "",
    price: "",
    minStock: "5",
    asCombo: false,
    comboParts: [],
    pickId: "",
    pickQty: "1",
    tiers: [],
  };
}

function pickListedCategory(list: string[], current: string) {
  if (list.includes(current)) return current;
  return list[0] ?? "";
}

const tinyInputClass =
  "h-7 min-w-0 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

const addInputClass =
  "h-9 min-w-0 rounded-md border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

const cellInputClass =
  "h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-1.5 text-base outline-none focus:border-primary focus:bg-background";

function fromProduct(product: Product): RowDraft {
  return {
    name: product.name,
    price: String(product.price),
    cost: String(product.cost),
    category: product.category,
  };
}

function describeChanges(product: Product, draft: RowDraft): string[] {
  const parts: string[] = [];
  if (draft.name.trim() !== product.name) {
    parts.push(`名稱「${product.name}」→「${draft.name.trim()}」`);
  }
  if (Number(draft.price) !== product.price) {
    parts.push(`售價 ${twd(product.price)} → ${twd(Number(draft.price) || 0)}`);
  }
  if (Number(draft.cost) !== product.cost) {
    parts.push(`批價 ${twd(product.cost)} → ${twd(Number(draft.cost) || 0)}`);
  }
  if (draft.category.trim() !== product.category) {
    parts.push(`分類「${product.category}」→「${draft.category.trim()}」`);
  }
  return parts;
}

function formFromProduct(product: Product): FormState {
  const parts = comboPartsOf(product);
  const tiers = priceTiersOf(product);
  return {
    sku: product.sku,
    name: product.name,
    category: product.category,
    unit: product.unit,
    cost: String(product.cost),
    price: String(product.price),
    minStock: String(product.minStock),
    asCombo: parts.length > 0,
    comboParts: parts.map((part) => ({
      productId: part.productId,
      qty: String(part.qty),
    })),
    pickId: "",
    pickQty: "1",
    tiers: tiers.map((tier) => ({
      qty: String(tier.qty),
      total: String(tier.total),
    })),
  };
}

export function ProductsView() {
  const {
    state,
    addProduct,
    updateProduct,
    installDealDemo,
    applyCatalogDrafts,
    setActive,
    clearCatalog,
    removeProduct,
    removeProducts,
    addCategory,
    renameCategory,
    removeCategory,
  } = useStore();
  const settings = normalizeSettings(state.settings);
  const managed = settings.categories;
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const viewCategories = managed;
  const managedKey = managed.join("\n");
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(managed[0] ?? ""),
  );
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [reviewing, setReviewing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.products.filter((product) => {
      if (categoryFilter !== "全部" && product.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q)
      );
    });
  }, [state.products, query, categoryFilter]);

  const selectedCount = selected.size;
  const visibleIds = useMemo(() => rows.map((product) => product.id), [rows]);
  const selectedVisibleCount = useMemo(
    () => visibleIds.filter((id) => selected.has(id)).length,
    [visibleIds, selected],
  );
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected =
    selectedVisibleCount > 0 && !allVisibleSelected;
  const formCategory = pickListedCategory(viewCategories, form.category);

  useEffect(() => {
    setForm((current) => {
      const next = pickListedCategory(managed, current.category);
      return next === current.category ? current : { ...current, category: next };
    });
    setCategoryFilter((current) => {
      if (current === "全部" || managed.includes(current)) return current;
      return "全部";
    });
  }, [managed, managedKey]);

  function toggleSelected(productId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  function dropSelected(ids: string[]) {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
    setDrafts((current) => {
      const next = { ...current };
      for (const id of ids) delete next[id];
      return next;
    });
  }

  function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) {
      toast.error("請先勾選要刪的商品");
      return;
    }
    const names = state.products
      .filter((product) => selected.has(product.id))
      .map((product) => product.name);
    const preview = names.slice(0, 8).join("、");
    const extra = names.length > 8 ? ` 等 ${names.length} 項` : "";
    if (!window.confirm(`確定刪除已勾選的 ${names.length} 項？\n${preview}${extra}`)) {
      return;
    }
    const result = removeProducts(ids);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    dropSelected(ids);
    toast.success(`已刪除 ${result.data.count} 項`);
  }

  function draftOf(product: Product): RowDraft {
    return drafts[product.id] ?? fromProduct(product);
  }

  const changes = useMemo<ChangeLine[]>(() => {
    return state.products.flatMap((product) => {
      const draft = drafts[product.id];
      if (!draft) return [];
      const parts = describeChanges(product, draft);
      if (parts.length === 0) return [];
      return [{ id: product.id, name: draft.name.trim() || product.name, parts }];
    });
  }, [state.products, drafts]);

  function patchRow(productId: string, patch: Partial<RowDraft>) {
    setReviewing(false);
    setDrafts((current) => {
      const product = state.products.find((item) => item.id === productId);
      if (!product) return current;
      const base = current[productId] ?? fromProduct(product);
      const next = { ...base, ...patch };
      const same =
        next.name === product.name &&
        next.price === String(product.price) &&
        next.cost === String(product.cost) &&
        next.category === product.category;
      if (same) {
        const { [productId]: _, ...rest } = current;
        return rest;
      }
      return { ...current, [productId]: next };
    });
  }

  function cancelDrafts() {
    setDrafts({});
    setReviewing(false);
  }

  function openReview() {
    if (changes.length === 0) {
      toast.error("還沒有更改");
      return;
    }
    setReviewing(true);
  }

  function confirmDrafts() {
    const payload = changes
      .map((change) => {
        const product = state.products.find((item) => item.id === change.id);
        const draft = drafts[change.id];
        if (!product || !draft) return null;
        return {
          id: product.id,
          name: draft.name,
          price: Number(draft.price),
          cost: Number(draft.cost),
          category: draft.category,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const result = applyCatalogDrafts(payload);
    if (!result.ok) {
      toast.error(result.error);
      setReviewing(false);
      return;
    }
    setDrafts({});
    setReviewing(false);
    toast.success(`已確定更改 ${result.data.updated} 項`);
  }

  function saveNew(event: React.FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    const cost = Number(form.cost);
    const price = Number(form.price);
    if (!name) {
      setError("請輸入商品名稱");
      toast.error("請輸入商品名稱");
      return;
    }
    if (![cost, price].every(Number.isFinite)) {
      setError("售價、批價請填數字");
      toast.error("售價、批價請填數字");
      return;
    }
    const comboParts = form.asCombo
      ? form.comboParts.map((part) => ({
          productId: part.productId,
          qty: Number(part.qty) || 0,
        }))
      : [];
    if (form.asCombo && comboParts.length < 2) {
      setError("套組至少要兩項商品");
      toast.error("套組至少要兩項商品");
      return;
    }
    const priceTiers = form.asCombo
      ? []
      : form.tiers
          .map((tier) => ({
            qty: Number(tier.qty) || 0,
            total: Number(tier.total) || 0,
          }))
          .filter((tier) => tier.qty >= 2);
    const payload = {
      sku: form.sku,
      name,
      category: formCategory,
      unit: form.unit,
      cost,
      price,
      minStock: 0,
      comboParts,
      priceTiers,
    };
    const result = editingId
      ? updateProduct({ ...payload, id: editingId })
      : addProduct(payload);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success(editingId ? "套組／多件價已儲存" : "商品已新增，可在下方表格繼續改其他項");
    setForm(emptyForm(formCategory));
    setEditingId(null);
    setError("");
  }

  function handleAddCategory(name: string) {
    const result = addCategory(name);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    setForm((current) => ({ ...current, category: result.data }));
    toast.success(`已新增分類「${result.data}」`);
    return true;
  }

  function handleRenameCategory(from: string, to: string) {
    const result = renameCategory(from, to);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    setForm((current) =>
      current.category === from
        ? { ...current, category: result.data.to }
        : current,
    );
    setDrafts((current) => {
      const next: Record<string, RowDraft> = {};
      for (const [id, draft] of Object.entries(current)) {
        next[id] =
          draft.category === from
            ? { ...draft, category: result.data.to }
            : draft;
      }
      return next;
    });
    toast.success(`分類已改成「${result.data.to}」`);
    return true;
  }

  function handleRemoveCategory(name: string) {
    if (!window.confirm(`確定刪除分類「${name}」？`)) return false;
    const result = removeCategory(name);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    setForm((current) =>
      current.category === name
        ? { ...current, category: managed.find((item) => item !== name) ?? "" }
        : current,
    );
    toast.success(`已刪除分類「${name}」`);
    if (categoryFilter === name) setCategoryFilter("全部");
    return true;
  }

  return (
    <div className="flex flex-col pb-28">
      <div className="border-b bg-card px-3 py-2 md:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-heading text-lg font-semibold">總商品列表</h1>
          <p className="mt-1 w-full text-xs leading-5 text-muted-foreground">
            別間門市的電腦請到
            <a href="/shop" className="underline">
              備份門市資料
            </a>
            匯出總商品，用 LINE 傳過去再匯入。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {categoryFilter === "全部"
                ? `共 ${state.products.length} 項`
                : `${categoryFilter} ${rows.length} 項`}
            </p>
            <button
              type="button"
              className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
              onClick={() => {
                const result = installDealDemo();
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(
                  "已放入烤肉組（599）與測試多件蛋（1個60、2個100），可到收銀試賣",
                );
              }}
            >
              放入烤肉組範例
            </button>
            {state.products.length > 0 && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline"
                onClick={() => {
                  const typed = window.prompt("要清空全部商品，請輸入「清空」");
                  if (typed !== "清空") return;
                  clearCatalog();
                  setDrafts({});
                  setSelected(new Set());
                  setReviewing(false);
                  toast.success("商品已清空");
                }}
              >
                清空品項
              </button>
            )}
          </div>
        </div>

        <div className="mt-2">
          <ChipListManager
            label="商品分類"
            items={managed}
            addPlaceholder="輸入分類名稱"
            onAdd={handleAddCategory}
            onRename={handleRenameCategory}
            onRemove={handleRemoveCategory}
          />
        </div>

        <form
          id="product-form"
          onSubmit={saveNew}
          className="mt-2 rounded-xl border bg-background px-2.5 py-2"
        >
          <p className="mb-1.5 text-sm font-semibold">新增商品</p>
          <div className="mb-2 rounded-md bg-muted/50 px-2.5 py-2 text-xs leading-5 text-muted-foreground">
            <p className="font-medium text-foreground">烤肉組這樣打（要打 5 次加入）</p>
            <p>
              1. 名稱 23白蝦、售價 179、批價自己填、按加入（不要勾套組）
            </p>
            <p>2. 名稱 鱸魚下巴、售價 80、加入</p>
            <p>3. 名稱 蜜汁肋排、售價 180、加入</p>
            <p>4. 名稱 燒肉片、售價 245、加入</p>
            <p>
              5. 名稱 烤肉組、售價 599、勾「這是套組」、下面選單把上面四項一個一個加進套組、再按加入
            </p>
            <p className="mt-1.5 font-medium text-foreground">
              1 個 60、2 個 100 這樣打（只打 1 次）
            </p>
            <p>
              名稱照商品打、售價填 60、勾「有多件優惠」、幾個填 2、收多少填 100、按加入
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[10rem] flex-1 space-y-0.5">
              <span className="text-[11px] text-muted-foreground">名稱</span>
              <input
                id="name"
                name="name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="先打單品，例如 23白蝦"
                autoComplete="off"
                className={cn(addInputClass, "w-full")}
              />
            </label>
            <label className="w-20 space-y-0.5">
              <span className="text-[11px] text-muted-foreground">售價</span>
              <input
                id="price"
                name="price"
                type="number"
                min={0}
                inputMode="numeric"
                value={form.price}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    price: event.target.value,
                  }))
                }
                placeholder="0"
                className={cn(addInputClass, "w-full tabular-nums")}
              />
            </label>
            <label className="w-20 space-y-0.5">
              <span className="text-[11px] text-muted-foreground">批價</span>
              <input
                id="cost"
                name="cost"
                type="number"
                min={0}
                inputMode="numeric"
                value={form.cost}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    cost: event.target.value,
                  }))
                }
                placeholder="0"
                className={cn(addInputClass, "w-full tabular-nums")}
              />
            </label>
            <label className="w-28 space-y-0.5">
              <span className="text-[11px] text-muted-foreground">分類</span>
              <select
                id="category"
                name="category"
                className={cn(addInputClass, "w-full")}
                value={formCategory}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
              >
                {viewCategories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="w-16 space-y-0.5">
              <span className="text-[11px] text-muted-foreground">單位</span>
              <select
                id="unit"
                name="unit"
                className={cn(addInputClass, "w-full")}
                value={form.unit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    unit: event.target.value as Unit,
                  }))
                }
              >
                {UNITS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="w-24 space-y-0.5">
              <span className="text-[11px] text-muted-foreground">編號</span>
              <input
                id="sku"
                name="sku"
                value={form.sku}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sku: event.target.value }))
                }
                placeholder="可留空"
                autoComplete="off"
                className={cn(addInputClass, "w-full")}
              />
            </label>
            <button
              type="submit"
              className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              {editingId ? "儲存搭配" : "加入"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="h-9 rounded-md border px-3 text-sm"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm(formCategory));
                }}
              >
                取消改搭配
              </button>
            ) : null}
          </div>
          <div className="mt-2 space-y-2 border-t pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.asCombo}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    asCombo: event.target.checked,
                    tiers: event.target.checked ? [] : current.tiers,
                  }))
                }
              />
              這是套組（一次賣多項，庫存扣裡面的商品）
            </label>
            {form.asCombo ? (
              <div className="space-y-2 rounded-md bg-muted/40 px-2 py-2">
                <p className="text-xs text-muted-foreground">
                  例如烤肉組：白蝦、鱸魚下巴、蜜汁肋排、燒肉片。上面售價填套組價（599）。結帳會依各項原價比例平均分攤，並各扣 1 件庫存。
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-[10rem] flex-1 space-y-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      加入現有商品
                    </span>
                    <select
                      className={cn(addInputClass, "w-full")}
                      value={form.pickId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          pickId: event.target.value,
                        }))
                      }
                    >
                      <option value="">選擇商品</option>
                      {state.products
                        .filter(
                          (item) =>
                            !isCombo(item) &&
                            item.id !== editingId &&
                            !form.comboParts.some(
                              (part) => part.productId === item.id,
                            ),
                        )
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} {twd(item.price)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="w-16 space-y-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      數量
                    </span>
                    <input
                      className={cn(addInputClass, "w-full tabular-nums")}
                      inputMode="numeric"
                      value={form.pickQty}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          pickQty: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="h-9 rounded-md border px-3 text-sm"
                    onClick={() => {
                      if (!form.pickId) return;
                      setForm((current) => ({
                        ...current,
                        comboParts: [
                          ...current.comboParts,
                          { productId: current.pickId, qty: current.pickQty || "1" },
                        ],
                        pickId: "",
                        pickQty: "1",
                      }));
                    }}
                  >
                    加進套組
                  </button>
                </div>
                {form.comboParts.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {form.comboParts.map((part, index) => {
                      const item = state.products.find(
                        (row) => row.id === part.productId,
                      );
                      return (
                        <li
                          key={`${part.productId}-${index}`}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span className="flex-1">
                            {item?.name ?? "找不到商品"} ×{part.qty}
                            {item ? `　原價 ${twd(item.price)}` : ""}
                          </span>
                          <button
                            type="button"
                            className="text-xs text-destructive underline"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                comboParts: current.comboParts.filter(
                                  (_, row) => row !== index,
                                ),
                              }))
                            }
                          >
                            拿掉
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {form.comboParts.length >= 2 ? (
                  <p className="text-xs text-muted-foreground">
                    原價合計{" "}
                    {twd(
                      comboListTotal(
                        {
                          comboParts: form.comboParts.map((part) => ({
                            productId: part.productId,
                            qty: Number(part.qty) || 1,
                          })),
                        } as Product,
                        state.products,
                      ),
                    )}
                    ／套組價 {twd(Number(form.price) || 0)}
                    ／批價合計{" "}
                    {twd(
                      comboCost(
                        {
                          comboParts: form.comboParts.map((part) => ({
                            productId: part.productId,
                            qty: Number(part.qty) || 1,
                          })),
                        } as Product,
                        state.products,
                      ),
                    )}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.tiers.length > 0}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        tiers: event.target.checked
                          ? [{ qty: "2", total: "" }]
                          : [],
                      }))
                    }
                  />
                  有多件優惠（1 個用上面售價；2 個 100 就填 2 和 100）
                </label>
                {form.tiers.map((tier, index) => (
                  <div key={index} className="flex flex-wrap items-end gap-2">
                    <label className="w-20 space-y-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        幾個
                      </span>
                      <input
                        className={cn(addInputClass, "w-full tabular-nums")}
                        inputMode="numeric"
                        value={tier.qty}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            tiers: current.tiers.map((row, rowIndex) =>
                              rowIndex === index
                                ? { ...row, qty: event.target.value }
                                : row,
                            ),
                          }))
                        }
                      />
                    </label>
                    <label className="w-24 space-y-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        收多少
                      </span>
                      <input
                        className={cn(addInputClass, "w-full tabular-nums")}
                        inputMode="numeric"
                        value={tier.total}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            tiers: current.tiers.map((row, rowIndex) =>
                              rowIndex === index
                                ? { ...row, total: event.target.value }
                                : row,
                            ),
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="h-9 text-xs text-destructive underline"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          tiers: current.tiers.filter((_, row) => row !== index),
                        }))
                      }
                    >
                      拿掉
                    </button>
                  </div>
                ))}
                {form.tiers.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    庫存仍按件扣。賣 1 件扣 1，賣 2 件扣 2，只是收銀收 100 而不是 120。
                  </p>
                ) : null}
              </div>
            )}
          </div>
          {error ? (
            <p className="mt-1.5 text-sm font-medium text-destructive">{error}</p>
          ) : null}
        </form>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-1.5 md:px-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜尋名稱"
          className={cn(tinyInputClass, "w-44")}
          aria-label="搜尋商品"
        />
        <label className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">看分類</span>
          <select
            value={categoryFilter}
            onChange={(event) => {
              const next = event.target.value;
              setCategoryFilter(next);
              if (next !== "全部") {
                setForm((current) => ({ ...current, category: next }));
              }
            }}
            aria-label="看哪個分類"
            className={cn(tinyInputClass, "h-8 w-28")}
          >
            <option value="全部">全部</option>
            {viewCategories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {selectedCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium">已勾選 {selectedCount} 項</p>
            <button
              type="button"
              className="h-7 rounded-md bg-destructive/10 px-2 text-xs font-medium text-destructive"
              onClick={deleteSelected}
            >
              刪除已勾選
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => setSelected(new Set())}
            >
              取消勾選
            </button>
          </div>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <p className="text-lg font-semibold">
              {state.products.length === 0
                ? "還沒有商品"
                : categoryFilter === "全部"
                  ? "找不到商品"
                  : `沒有「${categoryFilter}」的商品`}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 w-8">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someVisibleSelected;
                    }}
                    onChange={toggleVisible}
                    aria-label="全選目前列表"
                    className="size-3.5 align-middle"
                  />
                </TableHead>
                <TableHead className="h-8">商品名稱</TableHead>
                <TableHead className="h-8 w-32">
                  <label className="flex items-center gap-1">
                    <span>分類</span>
                    <select
                      value={categoryFilter}
                      onChange={(event) => {
                        const next = event.target.value;
                        setCategoryFilter(next);
                        if (next !== "全部") {
                          setForm((current) => ({
                            ...current,
                            category: next,
                          }));
                        }
                      }}
                      aria-label="看哪個分類"
                      className="h-7 max-w-24 rounded-md border bg-background px-1 text-xs font-normal text-foreground"
                    >
                      <option value="全部">全部</option>
                      {viewCategories.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                </TableHead>
                <TableHead className="h-8 w-24 text-right">售價</TableHead>
                <TableHead className="h-8 w-24 text-right">批價</TableHead>
                <TableHead className="h-8 w-20 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((product) => {
                const draft = draftOf(product);
                const dirty = Boolean(drafts[product.id]);
                return (
                  <TableRow
                    key={product.id}
                    className={cn(dirty && "bg-amber-50 dark:bg-amber-950/30")}
                  >
                    <TableCell className="w-8 py-1">
                      <input
                        type="checkbox"
                        checked={selected.has(product.id)}
                        onChange={() => toggleSelected(product.id)}
                        aria-label={`勾選 ${product.name}`}
                        className="size-3.5 align-middle"
                      />
                    </TableCell>
                    <TableCell className="min-w-48 py-1">
                      <div className="flex items-center gap-2">
                        <input
                          value={draft.name}
                          onChange={(event) =>
                            patchRow(product.id, { name: event.target.value })
                          }
                          className={cn(cellInputClass, "font-medium")}
                          aria-label={`${product.name} 名稱`}
                        />
                        {(product.sku ||
                          !product.active ||
                          dirty ||
                          isCombo(product) ||
                          priceTiersOf(product).length > 0) && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {product.sku}
                            {product.active ? "" : " · 已停售"}
                            {isCombo(product)
                              ? ` · 套組${comboPartsOf(product).length}項`
                              : ""}
                            {priceTiersOf(product).map(
                              (tier) =>
                                ` · ${tier.qty}個${tier.total}`,
                            )}
                            {dirty ? " · 未確定" : ""}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-1">
                      <select
                        value={draft.category}
                        onChange={(event) =>
                          patchRow(product.id, {
                            category: event.target.value,
                          })
                        }
                        className={cn(cellInputClass, "h-8")}
                        aria-label={`${product.name} 分類`}
                      >
                        {(viewCategories.includes(draft.category)
                          ? viewCategories
                          : [...viewCategories, draft.category]
                        ).map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="py-1">
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={draft.price}
                        onChange={(event) =>
                          patchRow(product.id, { price: event.target.value })
                        }
                        className={cn(
                          cellInputClass,
                          "text-right font-semibold tabular-nums",
                        )}
                        aria-label={`${product.name} 售價`}
                      />
                    </TableCell>
                    <TableCell className="py-1">
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={draft.cost}
                        onChange={(event) =>
                          patchRow(product.id, { cost: event.target.value })
                        }
                        className={cn(
                          cellInputClass,
                          "text-right tabular-nums",
                        )}
                        aria-label={`${product.name} 批價`}
                      />
                    </TableCell>
                    <TableCell className="py-1 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline"
                          onClick={() => {
                            setEditingId(product.id);
                            setForm(formFromProduct(product));
                            setError("");
                            document
                              .getElementById("product-form")
                              ?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          改搭配
                        </button>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline"
                          onClick={() => {
                            setActive(product.id, !product.active);
                            toast.success(
                              product.active
                                ? `${product.name} 已停售`
                                : `${product.name} 已恢復販售`,
                            );
                          }}
                        >
                          {product.active ? "停售" : "恢復"}
                        </button>
                        <button
                          type="button"
                          className="text-xs text-destructive underline"
                          onClick={() => {
                            if (
                              !window.confirm(`確定刪除「${product.name}」？`)
                            ) {
                              return;
                            }
                            const result = removeProduct(product.id);
                            if (!result.ok) {
                              toast.error(result.error);
                              return;
                            }
                            dropSelected([product.id]);
                            toast.success(`已刪除 ${product.name}`);
                          }}
                        >
                          刪除
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {changes.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur">
          {reviewing ? (
            <div className="mx-auto max-w-3xl">
              <p className="font-semibold">即將確定更改 {changes.length} 項</p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
                {changes.map((change) => (
                  <li key={change.id}>
                    <span className="font-medium">{change.name}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {change.parts.join("、")}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" onClick={confirmDrafts}>
                  套用這些更改
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReviewing(false)}
                >
                  返回繼續改
                </Button>
                <Button type="button" variant="ghost" onClick={cancelDrafts}>
                  全部取消
                </Button>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                已改 <span className="font-semibold">{changes.length}</span> 項
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={cancelDrafts}>
                  取消更改
                </Button>
                <Button type="button" onClick={openReview}>
                  確定更改
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
