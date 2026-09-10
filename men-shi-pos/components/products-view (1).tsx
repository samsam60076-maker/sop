"use client";

import { useMemo, useState } from "react";
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
  listedCategories,
  normalizeSettings,
} from "@/lib/shop";
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
  };
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

export function ProductsView() {
  const {
    state,
    addProduct,
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
  const categories = listedCategories(settings, state.products);
  const managed = settings.categories;
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("全部");
  const viewCategories = categories;
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(managed[0] ?? "常溫"),
  );
  const [error, setError] = useState("");
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
    const result = addProduct({
      sku: form.sku,
      name,
      category: form.category,
      unit: form.unit,
      cost,
      price,
      minStock: 0,
    });
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    toast.success("商品已新增，可在下方表格繼續改其他項");
    setForm(emptyForm(form.category));
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
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {categoryFilter === "全部"
                ? `共 ${state.products.length} 項`
                : `${categoryFilter} ${rows.length} 項`}
            </p>
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
                placeholder="例如 茶葉蛋"
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
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
              >
                {viewCategories.includes(form.category) || !form.category
                  ? null
                  : (
                    <option value={form.category}>{form.category}</option>
                  )}
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
              加入
            </button>
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
                        {(product.sku || !product.active || dirty) && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {product.sku}
                            {product.active ? "" : " · 已停售"}
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
