"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { ProductTypeahead } from "@/components/product-typeahead";
import { parseTypedEntry, resolveProduct } from "@/lib/lookup";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { YmdPicker } from "@/components/ymd-picker";
import { listedCategories, normalizeSettings } from "@/lib/shop";
import {
  type CartLine,
  type PriceReason,
  type Product,
  type Sale,
  type SaleReturn,
} from "@/lib/types";
import {
  formatDateYmd,
  formatTime,
  inputDateToIso,
  toInputDate,
  twd,
} from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const DEFAULT_NOTE = "正常販售";
const STAFF_NOTE = "員工價";

function composeLineNote(line: {
  priceReason?: PriceReason;
  note?: string;
}) {
  return [line.priceReason, line.note?.trim()].filter(Boolean).join("、");
}

export function CheckoutView() {
  const { state, checkout, refundCash, removeSale, removeReturn } = useStore();
  const categories = listedCategories(
    normalizeSettings(state.settings),
    state.products,
  );
  const [query, setQuery] = useState("");
  const [qtyInput, setQtyInput] = useState("1");
  const [category, setCategory] = useState<string>("全部");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [openSale, setOpenSale] = useState<Sale | null>(null);
  const [openRefund, setOpenRefund] = useState<SaleReturn | null>(null);
  const [received, setReceived] = useState("");
  const [saleDate, setSaleDate] = useState(toInputDate);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const [staffBuy, setStaffBuy] = useState(false);

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.products
      .filter((product) => {
        if (!product.active) return false;
        if (category !== "全部" && product.category !== category) return false;
        if (!q) return true;
        return (
          product.name.toLowerCase().includes(q) ||
          product.sku.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  }, [state.products, query, category]);

  const lines = cart
    .map((line) => {
      const product = state.products.find((item) => item.id === line.productId);
      if (!product) return null;
      return { ...line, product, amount: line.unitPrice * line.qty };
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line));

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const cashReceived = Number(received) || 0;
  const change = cashReceived - total;
  const dayRefunds = useMemo(
    () =>
      (state.saleReturns ?? []).filter(
        (item) => toInputDate(new Date(item.createdAt)) === saleDate,
      ),
    [state.saleReturns, saleDate],
  );
  const daySales = useMemo(
    () =>
      state.sales.filter(
        (sale) =>
          sale.status === "completed" &&
          toInputDate(new Date(sale.createdAt)) === saleDate,
      ),
    [state.sales, saleDate],
  );
  const dayRefundTotal = dayRefunds.reduce((sum, item) => sum + item.total, 0);

  function cartQtyOf(current: CartLine[], productId: string) {
    return current
      .filter((line) => line.productId === productId)
      .reduce((sum, line) => sum + line.qty, 0);
  }

  function salePrice(product: Product, staff = staffBuy) {
    return staff ? product.cost : product.price;
  }

  function retagCart(current: CartLine[], staff: boolean) {
    const priced = current.map((line) => {
      const product = state.products.find((item) => item.id === line.productId);
      if (!product) return line;
      return { ...line, unitPrice: salePrice(product, staff) };
    });
    const merged: CartLine[] = [];
    for (const line of priced) {
      const twin = merged.find(
        (item) =>
          item.productId === line.productId && item.unitPrice === line.unitPrice,
      );
      if (twin) {
        twin.qty += line.qty;
      } else {
        merged.push({ ...line });
      }
    }
    return merged;
  }

  function toggleStaffBuy(next: boolean) {
    setStaffBuy(next);
    setCart((current) => retagCart(current, next));
  }

  function addProduct(product: Product, qty = 1) {
    const amount = Math.max(1, Math.round(qty) || 1);
    const unitPrice = salePrice(product);
    if (product.stock <= 0) {
      toast.error(`${product.name} 目前無法加入`);
      return;
    }
    setCart((current) => {
      const nextQty = cartQtyOf(current, product.id) + amount;
      if (nextQty > product.stock) {
        toast.error(`${product.name} 無法再加`);
        return current;
      }
      const existing = current.find(
        (line) =>
          line.productId === product.id && line.unitPrice === unitPrice,
      );
      if (!existing) {
        return [
          ...current,
          {
            id: crypto.randomUUID(),
            productId: product.id,
            qty: amount,
            unitPrice,
          },
        ];
      }
      return current.map((line) =>
        line.id === existing.id ? { ...line, qty: line.qty + amount } : line,
      );
    });
  }

  function pickSaleProduct(product: Product, parsedQty: number | null) {
    const qty = parsedQty ?? (Number(qtyInput) || 1);
    addProduct(product, qty);
    setQuery("");
    setQtyInput("1");
  }

  function setQty(lineId: string, qty: number) {
    const line = cart.find((item) => item.id === lineId);
    const product = state.products.find((item) => item.id === line?.productId);
    if (!line || !product) return;
    if (qty <= 0) {
      setCart((current) => current.filter((item) => item.id !== lineId));
      return;
    }
    const others = cartQtyOf(
      cart.filter((item) => item.id !== lineId),
      product.id,
    );
    if (others + qty > product.stock) {
      toast.error(`${product.name} 無法再加`);
      qty = product.stock - others;
    }
    setCart((current) =>
      current.map((item) =>
        item.id === lineId ? { ...item, qty } : item,
      ),
    );
  }

  function setLinePrice(lineId: string, raw: string) {
    const next = Math.max(0, Math.round(Number(raw) || 0));
    setCart((current) => {
      const target = current.find((item) => item.id === lineId);
      if (!target) return current;
      const twin = current.find(
        (item) =>
          item.id !== lineId &&
          item.productId === target.productId &&
          item.unitPrice === next,
      );
      if (twin) {
        return current
          .filter((item) => item.id !== lineId)
          .map((item) =>
            item.id === twin.id
              ? { ...item, qty: item.qty + target.qty }
              : item,
          );
      }
      return current.map((item) =>
        item.id === lineId ? { ...item, unitPrice: next } : item,
      );
    });
  }

  function restorePrice(lineId: string) {
    const line = cart.find((item) => item.id === lineId);
    const product = state.products.find((item) => item.id === line?.productId);
    if (!product) return;
    setLinePrice(lineId, String(product.price));
    setCart((current) =>
      current.map((item) =>
        item.id === lineId ? { ...item, priceReason: undefined } : item,
      ),
    );
  }

  function markPriceReason(lineId: string, reason: PriceReason) {
    setCart((current) =>
      current.map((item) => {
        if (item.id !== lineId) return item;
        return {
          ...item,
          priceReason: item.priceReason === reason ? undefined : reason,
        };
      }),
    );
  }

  function cartNote(current: CartLine[] = cart) {
    const parts = [
      ...new Set(current.map(composeLineNote).filter(Boolean)),
    ];
    if (staffBuy) {
      return parts.length > 0 ? `${STAFF_NOTE}；${parts.join("；")}` : STAFF_NOTE;
    }
    return parts.length > 0 ? parts.join("；") : DEFAULT_NOTE;
  }

  function setLineNote(lineId: string, note: string) {
    setCart((current) =>
      current.map((item) =>
        item.id === lineId ? { ...item, note } : item,
      ),
    );
  }

  function splitDefect(lineId: string) {
    setCart((current) => {
      const line = current.find((item) => item.id === lineId);
      if (!line || line.qty < 2) return current;
      return [
        ...current.map((item) =>
          item.id === lineId ? { ...item, qty: item.qty - 1 } : item,
        ),
        {
          id: crypto.randomUUID(),
          productId: line.productId,
          qty: 1,
          unitPrice: line.unitPrice,
          priceReason: line.priceReason,
          note: line.note,
        },
      ];
    });
  }

  function onSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseTypedEntry(query);
    const product = resolveProduct(state.products, parsed.query, {
      activeOnly: true,
    });
    if (!product) {
      toast.error("找不到商品，請打名稱");
      return;
    }
    pickSaleProduct(product, parsed.qty);
  }

  function openPay() {
    if (lines.length === 0) {
      toast.error("請先加入商品");
      return;
    }
    setRefundOpen(false);
    setReceived(String(total));
    setPayOpen(true);
  }

  function confirmRefund() {
    const result = refundCash({
      amount: Number(refundAmount),
      note: refundNote,
      createdAt: inputDateToIso(saleDate),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `已退費 ${twd(result.data.total)} · ${result.data.number}`,
    );
    setRefundAmount("");
    setRefundNote("");
    setRefundOpen(false);
  }

  function deleteDaySale(saleId: string, number: string) {
    if (
      !window.confirm(
        `確定刪除銷貨 ${number}？收銀、銷貨、總表會一起拿掉，庫存加回。`,
      )
    ) {
      return;
    }
    const result = removeSale(saleId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`已刪除 ${number}`);
  }

  function deleteDayRefund(returnId: string, number: string) {
    if (
      !window.confirm(
        `確定刪除 ${number}？收銀與總表這筆退費會一起拿掉。`,
      )
    ) {
      return;
    }
    const result = removeReturn(returnId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`已刪除 ${number}`);
  }

  function confirmPay() {
    const reason = cartNote();
    const result = checkout({
      items: lines.map((line) => ({
        productId: line.productId,
        qty: line.qty,
        unitPrice: line.unitPrice,
        note: composeLineNote(line),
      })),
      paymentMethod: "cash",
      received: cashReceived,
      note: reason,
      createdAt: inputDateToIso(saleDate),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPayOpen(false);
    setCart([]);
    setReceipt(result.data);
  }

  const cartPanel = (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col lg:max-w-none">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-base font-semibold">
          {itemCount === 0 ? "購物車" : `購物車 · ${itemCount} 件`}
        </p>
        {cart.length > 0 && (
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setCart([])}
          >
            清空
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        {lines.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <ShoppingCart className="size-10 opacity-40" />
            <p className="text-base font-medium">還沒有商品</p>
          </div>
        ) : (
          <ul className="divide-y">
            {lines.map((line) => {
              const discounted = line.unitPrice !== line.product.price;
              return (
                <li key={line.id} className="space-y-2 py-2.5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-medium leading-snug">
                        {line.product.name}
                      </p>
                      <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                        小計 {twd(line.amount)}
                        {staffBuy
                          ? " · 批價"
                          : discounted
                            ? " · 已改價"
                            : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="flex size-10 items-center justify-center rounded-md border bg-background text-lg"
                        onClick={() => setQty(line.id, line.qty - 1)}
                        aria-label="減少"
                      >
                        <Minus className="size-4" />
                      </button>
                      <input
                        name={`cart-qty-${line.id}`}
                        type="number"
                        min={1}
                        value={line.qty}
                        onChange={(event) =>
                          setQty(line.id, Number(event.target.value) || 0)
                        }
                        className="h-10 w-12 rounded-md border bg-background text-center text-base tabular-nums"
                        aria-label={`${line.product.name} 數量`}
                      />
                      <button
                        type="button"
                        className="flex size-10 items-center justify-center rounded-md border bg-background text-lg"
                        onClick={() => setQty(line.id, line.qty + 1)}
                        aria-label="增加"
                      >
                        <Plus className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="ml-0.5 flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                        onClick={() => setQty(line.id, 0)}
                        aria-label={`移除 ${line.product.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  {staffBuy ? (
                    <p className="text-xs tabular-nums text-muted-foreground">
                      批價 {twd(line.unitPrice)}
                      {line.product.price !== line.product.cost
                        ? ` · 售價 ${twd(line.product.price)}`
                        : ""}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">售價</span>
                      <input
                        name={`cart-price-${line.id}`}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={line.unitPrice}
                        onChange={(event) =>
                          setLinePrice(line.id, event.target.value)
                        }
                        className="h-8 w-16 rounded-md border bg-background px-1 text-center text-base tabular-nums"
                        aria-label={`${line.product.name} 售價`}
                      />
                      {discounted ? (
                        <span className="text-xs text-muted-foreground">
                          原價 {twd(line.product.price)}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        aria-pressed={line.priceReason === "瑕疵"}
                        className={cn(
                          "rounded-md px-2 py-1 text-sm font-medium",
                          line.priceReason === "瑕疵"
                            ? "bg-red-600 text-white"
                            : "border text-muted-foreground",
                        )}
                        onClick={() => markPriceReason(line.id, "瑕疵")}
                      >
                        瑕疵
                      </button>
                      {discounted ? (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline"
                          onClick={() => restorePrice(line.id)}
                        >
                          原價
                        </button>
                      ) : null}
                      {line.qty > 1 ? (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline"
                          onClick={() => splitDefect(line.id)}
                        >
                          拆1件
                        </button>
                      ) : null}
                    </div>
                  )}
                  <label className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 text-sm text-muted-foreground">
                      備註
                    </span>
                    <input
                      name={`cart-note-${line.id}`}
                      value={line.note ?? ""}
                      onChange={(event) =>
                        setLineNote(line.id, event.target.value)
                      }
                      placeholder="可自己打"
                      className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring"
                      aria-label={`${line.product.name} 備註`}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="border-t bg-card p-3">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {staffBuy ? "應收（員工批價）" : "應收（現金）"}
          </span>
          <span className="font-heading text-2xl font-semibold tabular-nums">
            {twd(total)}
          </span>
        </div>
        {payOpen ? (
          <form
            className="mb-2 space-y-1.5 rounded-lg border bg-background p-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (change >= 0) confirmPay();
            }}
          >
            <p className="text-xs font-medium">現金收款</p>
            <label className="block space-y-0.5">
              <span className="text-[11px] text-muted-foreground">實收</span>
              <input
                id="received"
                type="number"
                min={0}
                inputMode="numeric"
                value={received}
                onChange={(event) => setReceived(event.target.value)}
                autoFocus
                className="h-8 w-full rounded-md border border-input bg-card px-2 text-base font-semibold tabular-nums outline-none focus-visible:border-ring"
              />
            </label>
            <div className="flex gap-1">
              {[100, 500, 1000].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="h-7 flex-1 rounded-md border text-xs"
                  onClick={() => setReceived(String(amount))}
                >
                  {amount}
                </button>
              ))}
            </div>
            <p
              className={cn(
                "text-xs",
                change < 0 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {change < 0 ? "收款不足" : `找零 ${twd(change)}`}
            </p>
            <div className="flex gap-1.5">
              <button
                type="submit"
                disabled={change < 0}
                className="h-8 flex-1 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                確認收款
              </button>
              <button
                type="button"
                className="h-8 rounded-md border px-2 text-xs"
                onClick={() => setPayOpen(false)}
              >
                取消
              </button>
            </div>
          </form>
        ) : null}
        {refundOpen ? (
          <form
            className="mb-3 space-y-2 rounded-xl border bg-background p-3"
            onSubmit={(event) => {
              event.preventDefault();
              confirmRefund();
            }}
          >
            <p className="text-sm font-medium">退費</p>
            <div className="space-y-1">
              <label htmlFor="refund-amount" className="text-sm">
                退費金額
              </label>
              <input
                id="refund-amount"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
                placeholder="自己打，例如 50"
                autoFocus
                className="h-12 w-full rounded-lg border border-input bg-card px-3 text-2xl font-semibold tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="refund-note" className="text-sm">
                備註
              </label>
              <div className="mb-1 flex flex-wrap gap-1">
                {["商品不佳", "多收", "客人要求", "退費"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs",
                      refundNote === item
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground",
                    )}
                    onClick={() => setRefundNote(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <textarea
                id="refund-note"
                value={refundNote}
                onChange={(event) => setRefundNote(event.target.value)}
                placeholder="自己寫原因，例如 茶葉蛋不好吃退 50 元"
                className="min-h-16 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="h-11 flex-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
              >
                確認退費
              </button>
              <button
                type="button"
                className="h-11 rounded-lg border px-3 text-sm"
                onClick={() => setRefundOpen(false)}
              >
                取消
              </button>
            </div>
          </form>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            className="h-12 flex-1 rounded-lg border bg-background text-base"
            onClick={() => {
              setPayOpen(false);
              setRefundOpen(true);
            }}
          >
            退費
          </button>
          <button
            type="button"
            className="h-12 flex-1 rounded-lg bg-primary text-base font-medium text-primary-foreground disabled:opacity-50"
            disabled={lines.length === 0}
            onClick={openPay}
          >
            結帳（現金）
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100svh-2.25rem)] flex-col lg:flex-row">
      <section className="min-w-0 flex-1">
        <div className="border-b bg-card px-3 py-2">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">銷貨年月日</span>
            <YmdPicker compact value={saleDate} onChange={setSaleDate} />
            <div className="flex rounded-md border p-0.5">
              <button
                type="button"
                className={cn(
                  "rounded px-2 py-1 text-xs",
                  !staffBuy
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
                onClick={() => toggleStaffBuy(false)}
              >
                一般
              </button>
              <button
                type="button"
                className={cn(
                  "rounded px-2 py-1 text-xs",
                  staffBuy
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
                onClick={() => toggleStaffBuy(true)}
              >
                員工購買
              </button>
            </div>
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
          <form
            onSubmit={onSearchSubmit}
            className="flex items-stretch gap-2"
          >
            <ProductTypeahead
              className="flex-1"
              products={state.products}
              value={query}
              onChange={setQuery}
              onPick={pickSaleProduct}
              autoFocus
              activeOnly
              pricesOnly
              showCost={staffBuy}
              placeholder="打名稱找商品，例如 茶葉蛋*3"
            />
            <Input
              name="add-qty"
              type="number"
              min={1}
              value={qtyInput}
              onChange={(event) => setQtyInput(event.target.value)}
              aria-label="數量"
              className="h-9 w-12 shrink-0 px-1 text-center text-sm"
            />
            <Button type="submit" className="h-9 shrink-0 px-3 text-sm">
              加入
            </Button>
          </form>
          {daySales.length > 0 || dayRefunds.length > 0 ? (
            <div className="mt-2 max-h-36 space-y-0.5 overflow-y-auto rounded-md border bg-background px-2 py-1.5">
              <p className="text-[11px] text-muted-foreground">
                本日已入帳 {daySales.length + dayRefunds.length} 筆 · 點開看明細
                {dayRefundTotal > 0 ? ` · 退費 ${twd(dayRefundTotal)}` : ""}
              </p>
              {daySales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-baseline gap-1 rounded px-0.5 py-0.5 text-left hover:bg-muted"
                    onClick={() => setOpenSale(sale)}
                  >
                    <span className="min-w-0 truncate">
                      {formatTime(sale.createdAt)} {sale.number}{" "}
                      {sale.items[0]?.name ?? "銷貨"}
                      {sale.items.length > 1
                        ? ` 等${sale.items.length}項`
                        : ""}{" "}
                      {twd(sale.total)}
                    </span>
                    <span className="shrink-0 text-muted-foreground">明細</span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 text-destructive underline"
                    onClick={() => deleteDaySale(sale.id, sale.number)}
                  >
                    刪除
                  </button>
                </div>
              ))}
              {dayRefunds.map((refund) => (
                <div
                  key={refund.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-baseline gap-1 rounded px-0.5 py-0.5 text-left hover:bg-muted"
                    onClick={() => setOpenRefund(refund)}
                  >
                    <span className="min-w-0 truncate">
                      {formatTime(refund.createdAt)} {refund.number} 退費{" "}
                      {twd(refund.total)}
                    </span>
                    <span className="shrink-0 text-muted-foreground">明細</span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 text-destructive underline"
                    onClick={() => deleteDayRefund(refund.id, refund.number)}
                  >
                    刪除
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {state.products.length === 0 ? (
            <div className="col-span-full flex flex-col items-center gap-4 rounded-2xl border bg-card px-6 py-16 text-center">
              <p className="text-xl font-semibold">還沒有商品</p>
              <Link href="/products" className="text-sm underline">
                總商品
              </Link>
            </div>
          ) : products.length === 0 ? (
            <div className="col-span-full py-16 text-center text-muted-foreground">
              找不到符合的商品
            </div>
          ) : (
            products.map((product) => {
              const left = product.stock - cartQtyOf(cart, product.id);
              return (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product)}
                className="flex min-h-16 flex-col justify-between rounded-lg border bg-card px-3 py-2 text-left transition hover:border-primary/50 hover:bg-muted/40"
              >
                <p className="line-clamp-2 text-sm font-medium leading-snug">
                  {product.name}
                </p>
                <p className="mt-1 font-heading text-lg font-semibold tabular-nums">
                  {twd(staffBuy ? product.cost : product.price)}
                </p>
                <p
                  className={cn(
                    "text-[11px] tabular-nums",
                    left <= 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  庫存 {left}
                </p>
                {staffBuy && product.price !== product.cost ? (
                  <p className="text-[11px] text-muted-foreground">
                    售價 {twd(product.price)}
                  </p>
                ) : null}
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

      <Dialog
        open={Boolean(receipt)}
        onOpenChange={(open) => !open && setReceipt(null)}
      >
        <DialogContent className="sm:max-w-sm">
          {receipt && (
            <>
              <DialogHeader>
                <DialogTitle>銷貨完成</DialogTitle>
                <DialogDescription>
                  {formatDateYmd(receipt.createdAt)} · {receipt.number} · 現金
                  {receipt.note.includes(STAFF_NOTE) ? " · 員工價" : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-xl border bg-muted/40 p-3 text-sm">
                {receipt.items.map((item, index) => (
                  <div
                    key={`${item.productId}-${index}`}
                    className="flex justify-between py-1"
                  >
                    <span className="min-w-0">
                      {item.name} × {item.qty}
                      <span className="ml-1 text-muted-foreground">
                        · {twd(item.unitPrice)}
                      </span>
                      {item.note ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.note}
                        </span>
                      ) : null}
                    </span>
                    <span className="tabular-nums">
                      {twd(item.qty * item.unitPrice)}
                    </span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
                  <span>合計</span>
                  <span className="tabular-nums">{twd(receipt.total)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>實收</span>
                  <span className="tabular-nums">
                    {twd(receipt.received)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>找零</span>
                  <span className="tabular-nums">
                    {twd(receipt.change)}
                  </span>
                </div>
                {receipt.note && (
                  <div className="mt-2 border-t pt-2 text-muted-foreground">
                    備註：{receipt.note}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => setReceipt(null)}>關閉</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(openSale)}
        onOpenChange={(open) => !open && setOpenSale(null)}
      >
        <DialogContent className="sm:max-w-sm">
          {openSale && (
            <>
              <DialogHeader>
                <DialogTitle>銷貨 {openSale.number}</DialogTitle>
                <DialogDescription>
                  {formatDateYmd(openSale.createdAt)}{" "}
                  {formatTime(openSale.createdAt)} · {openSale.items.length}項
                  {openSale.note.includes(STAFF_NOTE) ? " · 員工價" : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-72 overflow-y-auto rounded-xl border bg-muted/40 p-3 text-sm">
                {openSale.items.map((item, index) => (
                  <div
                    key={`${item.productId}-${index}`}
                    className="flex justify-between gap-2 py-1"
                  >
                    <span className="min-w-0">
                      {item.name} × {item.qty}
                      <span className="ml-1 text-muted-foreground">
                        · {twd(item.unitPrice)}
                      </span>
                      {item.note ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.note}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {twd(item.qty * item.unitPrice)}
                    </span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
                  <span>合計</span>
                  <span className="tabular-nums">{twd(openSale.total)}</span>
                </div>
                {openSale.note && openSale.note !== DEFAULT_NOTE ? (
                  <div className="mt-2 border-t pt-2 text-muted-foreground">
                    {openSale.note}
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    const sale = openSale;
                    setOpenSale(null);
                    deleteDaySale(sale.id, sale.number);
                  }}
                >
                  刪除
                </Button>
                <Button onClick={() => setOpenSale(null)}>關閉</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(openRefund)}
        onOpenChange={(open) => !open && setOpenRefund(null)}
      >
        <DialogContent className="sm:max-w-sm">
          {openRefund && (
            <>
              <DialogHeader>
                <DialogTitle>退費 {openRefund.number}</DialogTitle>
                <DialogDescription>
                  {formatDateYmd(openRefund.createdAt)}{" "}
                  {formatTime(openRefund.createdAt)}
                  {openRefund.saleNumber && openRefund.saleNumber !== "收銀退費"
                    ? ` · ${openRefund.saleNumber}`
                    : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-72 overflow-y-auto rounded-xl border bg-muted/40 p-3 text-sm">
                {openRefund.items.map((item, index) => (
                  <div
                    key={`${item.productId}-${index}`}
                    className="flex justify-between gap-2 py-1"
                  >
                    <span className="min-w-0">
                      {item.name} × {item.qty}
                      <span className="ml-1 text-muted-foreground">
                        · {twd(item.unitPrice)}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {twd(item.qty * item.unitPrice)}
                    </span>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
                  <span>合計</span>
                  <span className="tabular-nums">{twd(openRefund.total)}</span>
                </div>
                {openRefund.note ? (
                  <div className="mt-2 border-t pt-2 text-muted-foreground">
                    {openRefund.note}
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    const refund = openRefund;
                    setOpenRefund(null);
                    deleteDayRefund(refund.id, refund.number);
                  }}
                >
                  刪除
                </Button>
                <Button onClick={() => setOpenRefund(null)}>關閉</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
