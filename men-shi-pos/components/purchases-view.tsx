"use client";

import { useMemo, useRef, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProductTypeahead } from "@/components/product-typeahead";
import { PurchasePastePanel } from "@/components/purchase-paste-panel";
import { DayPaperCheck, type DayPaperLine } from "@/components/day-paper-check";
import { YmdPicker } from "@/components/ymd-picker";
import { formatTime, inputDateToIso, toInputDate, twd } from "@/lib/format";
import Link from "next/link";
import { productFromTypedName, resolveProduct } from "@/lib/lookup";
import { listedCategories, normalizeSettings } from "@/lib/shop";
import { isCombo } from "@/lib/pricing";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type DraftLine = {
  key: string;
  productId: string;
  name: string;
  price: number;
  unitCost: string;
  qty: string;
};

export function PurchasesView() {
  const { state, storeName, receiveStock, removePurchase } = useStore();
  const [note, setNote] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(toInputDate());
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Product | null>(null);
  const [qty, setQty] = useState("1");
  const [retail, setRetail] = useState("");
  const [wholesale, setWholesale] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [category, setCategory] = useState("全部");
  const qtyRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const categories = listedCategories(
    normalizeSettings(state.settings),
    state.products,
  );
  const activeProducts = state.products.filter(
    (product) => product.active && !isCombo(product),
  );
  const tileProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeProducts.filter((product) => {
      if (category !== "全部" && product.category !== category) return false;
      if (!q) return true;
      return (
        product.name.toLowerCase().includes(q) ||
        product.sku.toLowerCase().includes(q)
      );
    });
  }, [activeProducts, category, query]);
  const draftTotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const amount = Number(line.qty) || 0;
        const cost = Number(line.unitCost) || 0;
        return sum + amount * cost;
      }, 0),
    [lines],
  );
  const draftRetail = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const amount = Number(line.qty) || 0;
        return sum + amount * (Number(line.price) || 0);
      }, 0),
    [lines],
  );
  const itemCount = lines.reduce(
    (sum, line) => sum + (Number(line.qty) || 0),
    0,
  );
  const dayPurchases = useMemo(
    () =>
      state.purchases.filter(
        (purchase) => toInputDate(new Date(purchase.createdAt)) === purchaseDate,
      ),
    [state.purchases, purchaseDate],
  );
  const dayLines = useMemo(
    () =>
      dayPurchases.flatMap((purchase) =>
        purchase.items.map((item, index) => ({
          key: `${purchase.id}-${item.productId}-${index}`,
          purchaseId: purchase.id,
          createdAt: purchase.createdAt,
          number: purchase.number,
          note: purchase.note,
          name: item.name,
          qty: item.qty,
          unitCost: item.unitCost,
          unitPrice: item.unitPrice ?? 0,
          amount: item.qty * item.unitCost,
        })),
      ),
    [dayPurchases],
  );
  const paperLines = useMemo<DayPaperLine[]>(() => {
    const pending: DayPaperLine[] = lines.map((line) => ({
      id: `draft-${line.key}`,
      time: "",
      label: line.name,
      hint: "本次進貨",
      qty: Number(line.qty) || 0,
      amount: (Number(line.qty) || 0) * (Number(line.unitCost) || 0),
      pending: true,
    }));
    const posted: DayPaperLine[] = dayLines.map((line) => ({
      id: line.key,
      time: formatTime(line.createdAt),
      label: line.name,
      hint: line.number,
      qty: line.qty,
      amount: line.amount,
      onDelete: () => deleteOnePurchase(line.purchaseId, line.number),
    }));
    return [...pending, ...posted];
  }, [lines, dayLines]);

  function focusName() {
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }

  function resetForm() {
    setQuery("");
    setPicked(null);
    setQty("1");
    setRetail("");
    setWholesale("");
  }

  function pushLine(
    product: Product,
    amount: number,
    cost = product.cost,
    salePrice = product.price,
  ) {
    setLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) =>
          line.productId === product.id
            ? {
                ...line,
                qty: String((Number(line.qty) || 0) + amount),
                unitCost: String(cost),
                price: salePrice,
                name: product.name,
              }
            : line,
        );
      }
      return [
        ...current,
        {
          key: crypto.randomUUID(),
          productId: product.id,
          name: product.name,
          price: salePrice,
          unitCost: String(cost),
          qty: String(amount),
        },
      ];
    });
  }

  function fillFromName(value: string) {
    setQuery(value);
    const { product, qty: parsedQty } = productFromTypedName(
      activeProducts,
      value,
      { activeOnly: true },
    );
    if (product) {
      setPicked(product);
      setRetail(String(product.price));
      setWholesale(String(product.cost));
      if (parsedQty && parsedQty > 0) setQty(String(parsedQty));
      return;
    }
    setPicked(null);
    setRetail("");
    setWholesale("");
  }

  function applyProduct(product: Product, parsedQty: number | null) {
    const amount = parsedQty && parsedQty > 0 ? parsedQty : Number(qty) || 1;
    const cost = Number(wholesale || product.cost);
    const salePrice = Number(retail || product.price);
    pushLine(
      product,
      amount,
      Number.isFinite(cost) ? cost : product.cost,
      Number.isFinite(salePrice) ? salePrice : product.price,
    );
    resetForm();
    focusName();
  }

  function setLineQty(key: string, nextQty: number) {
    if (nextQty <= 0) {
      setLines((current) => current.filter((item) => item.key !== key));
      return;
    }
    setLines((current) =>
      current.map((item) =>
        item.key === key ? { ...item, qty: String(nextQty) } : item,
      ),
    );
  }

  function addLine(event?: React.FormEvent) {
    event?.preventDefault();
    const parts = query
      .split(/[,，、\n;；]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      const missing: string[] = [];
      let added = 0;
      for (const part of parts) {
        const { product, qty: parsedQty } = productFromTypedName(
          activeProducts,
          part,
          { activeOnly: true },
        );
        if (!product) {
          missing.push(part);
          continue;
        }
        pushLine(product, parsedQty && parsedQty > 0 ? parsedQty : 1);
        added += 1;
      }
      if (missing.length > 0) {
        toast.error(`找不到：${missing.join("、")}`);
      }
      if (added > 0) {
        toast.success(`已加入 ${added} 項，可繼續加或按確認入庫`);
        resetForm();
        focusName();
      }
      return;
    }
    const product =
      picked ?? resolveProduct(activeProducts, query, { activeOnly: true });
    if (!product) {
      toast.error("請先打商品名稱，或從下方點選");
      return;
    }
    const amount = Number(qty || 1);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("請填進貨數量");
      qtyRef.current?.focus();
      return;
    }
    const cost = Number(wholesale || product.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      toast.error("批價請填數字");
      return;
    }
    const salePrice = Number(retail || product.price);
    pushLine(
      product,
      amount,
      cost,
      Number.isFinite(salePrice) ? salePrice : product.price,
    );
    resetForm();
    focusName();
  }

  function submit() {
    const pending =
      picked ??
      (query.trim()
        ? resolveProduct(activeProducts, query, { activeOnly: true })
        : null);
    const pendingQty = Number(qty || 1);
    const extra =
      pending && Number.isFinite(pendingQty) && pendingQty > 0
        ? [
            {
              productId: pending.id,
              qty: pendingQty,
              unitCost: Number(wholesale || pending.cost) || 0,
              unitPrice: Number(retail || pending.price) || pending.price,
            },
          ]
        : [];
    const items = [
      ...lines.flatMap((line) => {
        const amount = Number(line.qty);
        const cost = Number(line.unitCost);
        if (!line.productId || !Number.isFinite(amount) || amount <= 0) {
          return [];
        }
        return [
          {
            productId: line.productId,
            qty: amount,
            unitCost: Number.isFinite(cost) ? cost : 0,
            unitPrice: line.price,
          },
        ];
      }),
      ...extra,
    ];
    const merged = new Map<
      string,
      { productId: string; qty: number; unitCost: number; unitPrice: number }
    >();
    for (const item of items) {
      const current = merged.get(item.productId);
      if (current) {
        merged.set(item.productId, {
          ...current,
          qty: current.qty + item.qty,
          unitCost: item.unitCost,
          unitPrice: item.unitPrice,
        });
      } else {
        merged.set(item.productId, item);
      }
    }
    const packed = [...merged.values()];
    if (packed.length === 0) {
      toast.error("請先加入要進的商品，再按確認入庫");
      return;
    }
    const result = receiveStock({
      note,
      items: packed,
      createdAt: inputDateToIso(purchaseDate),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`已入庫 ${result.data.number}，共 ${packed.length} 項`);
    setNote("");
    setLines([]);
    resetForm();
  }

  function deleteOnePurchase(purchaseId: string, number: string) {
    if (
      !window.confirm(
        `確定刪除進貨 ${number}？進貨與總表會一起拿掉，庫存扣回，可再重打。`,
      )
    ) {
      return;
    }
    const result = removePurchase(purchaseId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`已刪除 ${number}`);
  }

  const cartPanel = (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col lg:max-w-none">
      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-[13px] font-semibold">
          {itemCount === 0 ? "本次進貨" : `本次進貨 · ${itemCount} 件`}
        </p>
        {lines.length > 0 ? (
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => setLines([])}
          >
            清空
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5">
        {lines.length === 0 ? (
          <p className="px-1 py-4 text-center text-[12px] text-muted-foreground">
            點左邊商品，或貼文字加入
          </p>
        ) : (
          <ul>
            {lines.map((line) => {
              const amount = Number(line.qty) || 0;
              const cost = Number(line.unitCost) || 0;
              return (
                <li
                  key={line.key}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1 border-b border-dashed py-0.5"
                >
                  <p className="truncate text-[12px] font-medium leading-tight">
                    {line.name}
                    <span className="ml-1 font-normal tabular-nums text-muted-foreground">
                      {twd(amount * cost)}
                    </span>
                  </p>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      className="flex size-6 items-center justify-center rounded border bg-background"
                      onClick={() => setLineQty(line.key, amount - 1)}
                      aria-label="減少"
                    >
                      <Minus className="size-3" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={line.qty}
                      onChange={(event) =>
                        setLineQty(line.key, Number(event.target.value) || 0)
                      }
                      className="h-6 w-8 rounded border bg-background text-center text-[12px] tabular-nums"
                      aria-label={`${line.name} 數量`}
                    />
                    <button
                      type="button"
                      className="flex size-6 items-center justify-center rounded border bg-background"
                      onClick={() => setLineQty(line.key, amount + 1)}
                      aria-label="增加"
                    >
                      <Plus className="size-3" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={line.unitCost}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((item) =>
                            item.key === line.key
                              ? { ...item, unitCost: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className="h-6 w-12 rounded border bg-background px-0.5 text-center text-[12px] tabular-nums"
                      aria-label={`${line.name} 批價`}
                      title="批價"
                    />
                    <button
                      type="button"
                      className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                      onClick={() => setLineQty(line.key, 0)}
                      aria-label={`移除 ${line.name}`}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="border-t bg-card px-2 py-1.5">
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="備註可留空"
          className="mb-1 h-7 w-full rounded border bg-background px-1.5 text-[11px] outline-none focus-visible:border-ring"
        />
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px] tabular-nums">
          <span className="text-muted-foreground">批價 {twd(draftTotal)}</span>
          <span className="text-muted-foreground">售價 {twd(draftRetail)}</span>
        </div>
        <button
          type="button"
          className="h-8 w-full rounded bg-primary text-[13px] font-medium text-primary-foreground disabled:opacity-50"
          disabled={lines.length === 0 && !picked && !query.trim()}
          onClick={submit}
        >
          確認入庫
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100svh-2.25rem)] flex-col">
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <section className="min-w-0 flex-1">
        <div className="border-b bg-card px-3 py-2">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">進貨年月日</span>
            <YmdPicker
              tiny
              id="purchase-date"
              value={purchaseDate}
              onChange={setPurchaseDate}
            />
          </div>
          <div className="mb-1.5 flex gap-1 overflow-x-auto pb-0.5">
            {["全部", ...categories].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap",
                  category === item
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {item}
              </button>
            ))}
          </div>
          <form onSubmit={addLine} className="flex items-stretch gap-2">
            <ProductTypeahead
              className="flex-1"
              id="purchase-name"
              inputRef={nameRef}
              products={activeProducts}
              value={query}
              onChange={fillFromName}
              onPick={applyProduct}
              autoFocus
              activeOnly
              compact
              showCost
              placeholder="打名稱找商品，例如 香煎雞腿排"
            />
            <input
              ref={qtyRef}
              type="number"
              min={1}
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              aria-label="數量"
              className="h-9 w-12 shrink-0 rounded-lg border bg-background px-1 text-center text-sm"
            />
            <button
              type="submit"
              className="h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              加入
            </button>
          </form>
          <PurchasePastePanel
            products={activeProducts}
            inCartIds={lines.map((line) => line.productId)}
            onAdd={(items) => {
              for (const item of items) {
                const product = activeProducts.find(
                  (row) => row.id === item.productId,
                );
                if (!product) continue;
                const cost =
                  item.unitPrice > 0 ? item.unitPrice : product.cost;
                pushLine(product, item.qty, cost, product.price);
              }
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {state.products.length === 0 ? (
            <div className="col-span-full flex flex-col items-center gap-4 rounded-2xl border bg-card px-6 py-16 text-center">
              <p className="text-xl font-semibold">還沒有商品</p>
              <Link href="/products" className="text-sm underline">
                總商品
              </Link>
            </div>
          ) : tileProducts.length === 0 ? (
            <div className="col-span-full py-16 text-center text-muted-foreground">
              找不到符合的商品
            </div>
          ) : (
            tileProducts.map((product) => {
              const inDraft = lines.find(
                (line) => line.productId === product.id,
              );
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => applyProduct(product, Number(qty) || 1)}
                  className={cn(
                    "flex min-h-16 flex-col justify-between rounded-lg border px-3 py-2 text-left transition hover:border-primary/50 hover:bg-muted/40",
                    inDraft
                      ? "border-primary/50 bg-primary/5"
                      : "bg-card",
                  )}
                >
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {product.name}
                  </p>
                  <p className="mt-1 font-heading text-lg font-semibold tabular-nums">
                    {twd(product.cost)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    售價 {twd(product.price)}
                    {inDraft ? ` · 已加 ${inDraft.qty}` : ""}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </section>

      <aside className="border-t bg-muted/70 lg:w-[20rem] lg:shrink-0 lg:border-t-0 lg:border-l xl:w-[21rem]">
        <div className="lg:sticky lg:top-9 lg:h-[calc(100svh-2.25rem)]">
          {cartPanel}
        </div>
      </aside>
    </div>
      <div className="border-t px-3 py-2 md:px-4">
        <DayPaperCheck
          kind="進貨"
          shopName={storeName}
          day={purchaseDate}
          lines={paperLines}
          defaultOpen={false}
        />
      </div>
    </div>
  );
}
