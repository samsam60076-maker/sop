"use client";

import { useMemo, useRef, useState } from "react";
import { Minus, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProductTypeahead } from "@/components/product-typeahead";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { YmdPicker } from "@/components/ymd-picker";
import { formatTime, inputDateToIso, toInputDate, twd } from "@/lib/format";
import Link from "next/link";
import { productFromTypedName, resolveProduct } from "@/lib/lookup";
import { listedCategories, normalizeSettings } from "@/lib/shop";
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
  const { state, receiveStock, removePurchase } = useStore();
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
  const activeProducts = state.products.filter((product) => product.active);
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
  const dayQty = dayLines.reduce((sum, line) => sum + line.qty, 0);
  const dayCost = dayPurchases.reduce(
    (sum, purchase) => sum + purchase.totalCost,
    0,
  );

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
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-base font-semibold">
          {itemCount === 0 ? "本次進貨" : `本次進貨 · ${itemCount} 件`}
        </p>
        {lines.length > 0 && (
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setLines([])}
          >
            清空
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        {lines.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Package className="size-10 opacity-40" />
            <p className="text-base font-medium">點左邊商品加入</p>
          </div>
        ) : (
          <ul className="divide-y">
            {lines.map((line) => {
              const amount = Number(line.qty) || 0;
              const cost = Number(line.unitCost) || 0;
              return (
                <li key={line.key} className="space-y-2 py-2.5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-medium leading-snug">
                        {line.name}
                      </p>
                      <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                        小計 {twd(amount * cost)} · 售價 {twd(line.price)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="flex size-10 items-center justify-center rounded-md border bg-background"
                        onClick={() => setLineQty(line.key, amount - 1)}
                        aria-label="減少"
                      >
                        <Minus className="size-4" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={line.qty}
                        onChange={(event) =>
                          setLineQty(
                            line.key,
                            Number(event.target.value) || 0,
                          )
                        }
                        className="h-10 w-12 rounded-md border bg-background text-center text-base tabular-nums"
                        aria-label={`${line.name} 數量`}
                      />
                      <button
                        type="button"
                        className="flex size-10 items-center justify-center rounded-md border bg-background"
                        onClick={() => setLineQty(line.key, amount + 1)}
                        aria-label="增加"
                      >
                        <Plus className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="ml-0.5 flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                        onClick={() => setLineQty(line.key, 0)}
                        aria-label={`移除 ${line.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">批價</span>
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
                      className="h-8 w-16 rounded-md border bg-background px-1 text-center text-base tabular-nums"
                      aria-label={`${line.name} 批價`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="border-t bg-card p-3">
        <label className="mb-2 block">
          <span className="sr-only">備註</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="備註可留空"
            className="mb-2 h-9 w-full rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring"
          />
        </label>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">進貨批價合計</span>
          <span className="font-heading text-2xl font-semibold tabular-nums">
            {twd(draftTotal)}
          </span>
        </div>
        <button
          type="button"
          className="h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground disabled:opacity-50"
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
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">進貨年月日</span>
            <YmdPicker
              compact
              id="purchase-date"
              value={purchaseDate}
              onChange={setPurchaseDate}
            />
          </div>
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
            {["全部", ...categories].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm whitespace-nowrap",
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
              placeholder="打名稱找商品，例如 茶葉蛋*10"
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

      <aside className="border-t bg-muted/70 lg:w-[26rem] lg:shrink-0 lg:border-t-0 lg:border-l lg:shadow-[-8px_0_24px_rgba(0,0,0,0.04)] xl:w-[28rem]">
        <div className="lg:sticky lg:top-9 lg:h-[calc(100svh-2.25rem)]">
          {cartPanel}
        </div>
      </aside>
    </div>
      <section className="border-t">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 md:px-4">
          <h2 className="text-sm font-semibold">當日進貨明細</h2>
          <p className="text-sm tabular-nums text-muted-foreground">
            {dayPurchases.length} 張 · {dayQty} 件 · 批價合計 {twd(dayCost)}
          </p>
        </div>
        <div className="overflow-x-auto">
          {dayLines.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              這天還沒有進貨
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8">時間</TableHead>
                  <TableHead className="h-8">單號</TableHead>
                  <TableHead className="h-8">商品名稱</TableHead>
                  <TableHead className="h-8 text-right">數量</TableHead>
                  <TableHead className="h-8 text-right">售價</TableHead>
                  <TableHead className="h-8 text-right">批價</TableHead>
                  <TableHead className="h-8 text-right">小計</TableHead>
                  <TableHead className="h-8">備註</TableHead>
                  <TableHead className="h-8 w-12 text-right">刪除</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayLines.map((line) => (
                  <TableRow key={line.key}>
                    <TableCell className="py-1.5 text-sm text-muted-foreground">
                      {formatTime(line.createdAt)}
                    </TableCell>
                    <TableCell className="py-1.5 text-sm">{line.number}</TableCell>
                    <TableCell className="py-1.5 text-base font-medium">
                      {line.name}
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-base font-semibold tabular-nums">
                      {line.qty}
                    </TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">
                      {twd(line.unitPrice)}
                    </TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">
                      {twd(line.unitCost)}
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-base font-semibold tabular-nums">
                      {twd(line.amount)}
                    </TableCell>
                    <TableCell className="py-1.5 text-sm">
                      {line.note || "—"}
                    </TableCell>
                    <TableCell className="py-1.5 text-right">
                      <button
                        type="button"
                        className="text-xs text-destructive underline"
                        onClick={() =>
                          deleteOnePurchase(line.purchaseId, line.number)
                        }
                      >
                        刪除
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
