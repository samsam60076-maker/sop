"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { YmdPicker } from "@/components/ymd-picker";
import {
  monthStocktakeTitle,
  stocktakeCountedAt,
  stocktakeLineKey,
  stocktakeSummary,
} from "@/lib/engine";
import {
  formatDateTime,
  formatDateYmd,
  inputDateToIso,
  toInputDate,
  twd,
  ymdParts,
} from "@/lib/format";
import {
  displayShopName,
  listedBins,
  normalizeSettings,
} from "@/lib/shop";
import { useStore } from "@/lib/store";
import type { StocktakeLine } from "@/lib/types";
import { cn } from "@/lib/utils";

type PrintMode = "none" | "blank" | "check" | "audit";
const UNMARKED = "未註明";
const TOTALS = "盤點總計";

function lineDiff(line: StocktakeLine) {
  if (line.countedQty == null) return null;
  return line.countedQty - line.bookQty;
}

function lineStatus(line: StocktakeLine) {
  const diff = lineDiff(line);
  if (diff == null) return "pending";
  if (diff < 0) return "missing";
  if (diff > 0) return "surplus";
  return "match";
}

function lineSellPrice(
  line: StocktakeLine,
  products: { id: string; price: number; cost: number }[],
) {
  if (typeof line.unitPrice === "number") return line.unitPrice;
  return products.find((item) => item.id === line.productId)?.price ?? 0;
}

function lineBin(line: StocktakeLine) {
  return line.bin?.trim() ? line.bin : UNMARKED;
}

function lineQty(line: StocktakeLine) {
  return line.countedQty ?? line.bookQty;
}

function lineAmount(
  line: StocktakeLine,
  products: { id: string; price: number; cost: number }[],
) {
  return lineQty(line) * lineSellPrice(line, products);
}

function groupStat(
  lines: StocktakeLine[],
  products: { id: string; price: number; cost: number }[],
) {
  return lines.reduce(
    (acc, line) => {
      const qty = lineQty(line);
      return {
        items: acc.items + 1,
        qty: acc.qty + qty,
        amount: acc.amount + qty * lineSellPrice(line, products),
      };
    },
    { items: 0, qty: 0, amount: 0 },
  );
}

function parseExpiryInput(raw: string, today = new Date()) {
  const text = raw.trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const digits = text.replace(/\D/g, "");
  let year = 0;
  let month = 0;
  let day = 0;
  if (digits.length === 8) {
    year = Number(digits.slice(0, 4));
    month = Number(digits.slice(4, 6));
    day = Number(digits.slice(6, 8));
  } else if (digits.length === 7) {
    year = Number(digits.slice(0, 3)) + 1911;
    month = Number(digits.slice(3, 5));
    day = Number(digits.slice(5, 7));
  } else if (digits.length === 6) {
    const yy = Number(digits.slice(0, 2));
    year = yy >= 70 ? 1900 + yy : 2000 + yy;
    month = Number(digits.slice(2, 4));
    day = Number(digits.slice(4, 6));
  } else if (digits.length === 4) {
    year = today.getFullYear();
    month = Number(digits.slice(0, 2));
    day = Number(digits.slice(2, 4));
  } else {
    return digits || text;
  }
  if (
    !year ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return digits || text;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function displayExpiry(raw: string) {
  const iso = parseExpiryInput(raw);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return raw.replace(/\D/g, "") || raw;
  }
  const [year, month, day] = iso.split("-");
  return `${String(year).slice(-2)}${month}${day}`;
}

function isThisYearExpiry(raw: string, today = new Date()) {
  const iso = parseExpiryInput(raw, today);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return Number(iso.slice(0, 4)) === today.getFullYear();
}

function expiryThisYearClass(raw: string) {
  return isThisYearExpiry(raw)
    ? "border-red-500 bg-red-100 font-semibold text-red-800"
    : "bg-background";
}

function chunkLines<T>(list: T[], cols: number): T[][] {
  if (cols <= 1) return [list];
  if (list.length === 0) return Array.from({ length: cols }, () => []);
  const size = Math.ceil(list.length / cols);
  return Array.from({ length: cols }, (_, index) =>
    list.slice(index * size, index * size + size),
  );
}

export function StocktakeView() {
  const {
    state,
    startStocktake,
    confirmStocktake,
    discardStocktake,
    refreshStocktakeCatalog,
    upsertStocktakeLine,
    removeStocktakeLine,
    setStocktakeCountedAt,
    addBin,
    removeBin,
  } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [binFilter, setBinFilter] = useState("");
  const [binEditing, setBinEditing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>("none");
  const [takeDate, setTakeDate] = useState(toInputDate);
  const [newBin, setNewBin] = useState("");
  const [draftRow, setDraftRow] = useState({
    name: "",
    date: "",
    qty: "",
    price: "",
  });

  const sheets = state.stocktakes ?? [];

  useEffect(() => {
    refreshStocktakeCatalog();
  }, [refreshStocktakeCatalog, state.products]);

  const current =
    sheets.find((item) => item.id === selectedId) ??
    sheets.find((item) => item.status === "draft") ??
    sheets[0] ??
    null;
  const locked = current?.status === "confirmed";
  const summary = current ? stocktakeSummary(current.lines) : null;

  useEffect(() => {
    if (!current) return;
    setTakeDate(toInputDate(new Date(stocktakeCountedAt(current))));
  }, [current]);

  const settings = normalizeSettings(state.settings);
  const binOptions = listedBins(settings);
  const printing = printMode !== "none";
  const printBlank = printMode === "blank";
  const printAudit = printMode === "audit";
  const activeBin = binFilter === TOTALS ? "" : binFilter;

  useEffect(() => {
    if (!binFilter && binOptions[0]) setBinFilter(binOptions[0]);
  }, [binFilter, binOptions]);

  const visible = useMemo(() => {
    if (!current) return [];
    return current.lines.filter((line) => {
      if (printing) return Boolean(line.bin?.trim());
      if (binFilter === TOTALS) return Boolean(line.bin?.trim());
      return lineBin(line) === binFilter;
    });
  }, [current, binFilter, printing]);

  const grouped = useMemo(() => {
    const order = [...binOptions, UNMARKED];
    return order
      .map((bin) => ({
        title: bin,
        lines: visible.filter((line) => lineBin(line) === bin),
      }))
      .filter((group) => group.lines.length > 0);
  }, [binOptions, visible]);

  const cabinetStats = useMemo(() => {
    if (!current) return [];
    const order = [...binOptions, UNMARKED];
    return order
      .map((bin) => ({
        title: bin,
        ...groupStat(
          current.lines.filter((line) => lineBin(line) === bin),
          state.products,
        ),
      }))
      .filter((item) => item.items > 0);
  }, [binOptions, current, state.products]);

  const cabinetGrand = useMemo(
    () =>
      cabinetStats.reduce(
        (acc, item) => ({
          items: acc.items + item.items,
          qty: acc.qty + item.qty,
          amount: acc.amount + item.amount,
        }),
        { items: 0, qty: 0, amount: 0 },
      ),
    [cabinetStats],
  );

  const variances = current
    ? current.lines.filter((line) => {
        const diff = lineDiff(line);
        return diff != null && diff !== 0;
      })
    : [];

  function openMonthSheet() {
    const countedAt = inputDateToIso(takeDate);
    const title = monthStocktakeTitle(new Date(countedAt));
    const existing = sheets.find(
      (item) =>
        item.status === "draft" &&
        toInputDate(new Date(stocktakeCountedAt(item))) === takeDate,
    );
    if (existing) {
      const before = existing.lines.length;
      const next = refreshStocktakeCatalog();
      const sheet = (next.stocktakes ?? []).find((item) => item.id === existing.id);
      const added = (sheet?.lines.length ?? before) - before;
      setSelectedId(existing.id);
      setBinFilter(binOptions[0] ?? TOTALS);
      if (added > 0) {
        toast.success(`已補上 ${added} 項`);
      }
      return;
    }
    const result = startStocktake({ title, countedAt });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSelectedId(result.data.id);
    setReviewing(false);
    setBinFilter(binOptions[0] ?? TOTALS);
    setDraftRow({ name: "", date: "", qty: "", price: "" });
    toast.success(`已開立 ${result.data.number}，選櫃子打名稱`);
  }

  function lineExpiryValue(line: StocktakeLine) {
    return displayExpiry(line.expiresOn || "");
  }

  function saveLine(
    lineId: string | undefined,
    next: {
      name: string;
      date: string;
      qty: string;
      price: string;
    },
  ) {
    if (!current || locked || !activeBin) return;
    if (!next.name.trim()) return;
    const qtyRaw = next.qty.trim();
    const priceRaw = next.price.trim();
    const result = upsertStocktakeLine({
      id: current.id,
      lineId,
      bin: activeBin,
      name: next.name,
      expiresOn: parseExpiryInput(next.date),
      countedQty: qtyRaw === "" ? null : Number(qtyRaw),
      unitPrice: priceRaw === "" ? undefined : Number(priceRaw),
    });
    if (!result.ok) toast.error(result.error);
    return result;
  }

  function parkSheet() {
    if (locked || !current) return;
    if (draftRow.name.trim()) {
      const result = saveLine(undefined, draftRow);
      if (result?.ok) {
        setDraftRow({ name: "", date: "", qty: "", price: "" });
      }
    }
    toast.success("已暫存。這張單還在，數量可以晚點再填。");
  }

  function printSheet(mode: Exclude<PrintMode, "none">) {
    setPrintMode(mode);
    const done = () => {
      setPrintMode("none");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.setTimeout(() => window.print(), 50);
  }

  function applySheet() {
    if (!current) return;
    const result = confirmStocktake({ id: current.id });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setReviewing(false);
    toast.success(
      `${result.data.number} 已入帳，庫存已改成實盤數量`,
    );
  }

  function removeSheet() {
    if (!current) return;
    const posted = current.status === "confirmed";
    const ok = window.confirm(
      posted
        ? `確定刪除 ${current.number}？這張已入帳的盤點單會拿掉，庫存改回入帳前，可再開單重盤。`
        : `確定刪除 ${current.number}？這張未入帳的盤點單會拿掉，可再開一張重盤。`,
    );
    if (!ok) return;
    const result = discardStocktake({ id: current.id });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSelectedId(null);
    setReviewing(false);
    toast.success(`已刪除 ${current.number}`);
  }

  return (
    <div className="flex flex-col pb-36 print:pb-0">
      <div className="border-b bg-card px-3 py-2 md:px-4 print:hidden">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="font-heading flex items-center gap-1 text-sm font-semibold">
            <ClipboardCheck className="size-3.5" />
            盤點單
          </h1>
          <span className="text-[11px] text-muted-foreground">盤點日</span>
          <YmdPicker
            tiny
            id="stocktake-date"
            value={takeDate}
            onChange={(value) => {
              setTakeDate(value);
              if (!current) return;
              const result = setStocktakeCountedAt({
                id: current.id,
                countedAt: inputDateToIso(value),
              });
              if (!result.ok) toast.error(result.error);
            }}
          />
          <div className="ml-auto flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => printSheet("check")}
              disabled={!current}
            >
              <Printer data-icon="inline-start" />
              列印當月盤點表
            </Button>
            {current ? (
              <Button size="sm" type="button" variant="outline" onClick={removeSheet}>
                刪除此單
              </Button>
            ) : null}
            <Button size="sm" onClick={openMonthSheet}>
              開立本月盤點單
            </Button>
          </div>
        </div>

        {sheets.length > 0 && (
          <div className="mt-1.5 flex gap-1 overflow-x-auto print:hidden">
            {sheets.map((sheet) => (
              <button
                key={sheet.id}
                type="button"
                onClick={() => {
                  setSelectedId(sheet.id);
                  setReviewing(false);
                  setBinFilter(binOptions[0] ?? TOTALS);
                }}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap",
                  current?.id === sheet.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {sheet.number}{" "}
                {(() => {
                  const ymd = ymdParts(stocktakeCountedAt(sheet));
                  return `${ymd.month}/${ymd.day}`;
                })()}{" "}
                {sheet.title}
                {sheet.status === "draft" ? " · 未入帳 · 可補數量" : " · 已入帳"}
              </button>
            ))}
          </div>
        )}

        {current && (
          <div className="mt-2 flex flex-wrap items-center gap-1 print:hidden">
            {[...binOptions, TOTALS].map((item) => {
              const value = item;
              const count =
                item === TOTALS
                  ? cabinetGrand.amount
                  : current.lines.filter((line) => line.bin === item).length;
              const canRemove = item !== TOTALS;
              return (
                <span
                  key={item}
                  className={cn(
                    "inline-flex items-center rounded-full border text-sm whitespace-nowrap",
                    binFilter === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setBinFilter(value)}
                    className="px-2.5 py-1"
                  >
                    {item === TOTALS ? TOTALS : `${item} ${count}`}
                  </button>
                  {canRemove && binEditing ? (
                    <button
                      type="button"
                      className="pr-2 text-[11px] opacity-80 hover:opacity-100"
                      aria-label={`減少櫃位 ${item}`}
                      onClick={() => {
                        if (!window.confirm(`確定減少櫃位「${item}」？商品會變成未註明，可再選別櫃。`))
                          return;
                        const result = removeBin(item);
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        if (binFilter === item) setBinFilter(binOptions[0] ?? TOTALS);
                        toast.success(`已減少 ${item}`);
                      }}
                    >
                      減
                    </button>
                  ) : null}
                </span>
              );
            })}
            <form
              className="inline-flex items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                const result = addBin(newBin);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                setBinFilter(result.data);
                setNewBin("");
                toast.success(`已新增 ${result.data}`);
              }}
            >
              <input
                value={newBin}
                onChange={(event) => setNewBin(event.target.value)}
                placeholder="第三櫃冷凍冰箱"
                className="h-7 w-36 rounded-full border bg-background px-2 text-xs"
                aria-label="新櫃位名稱"
              />
              <button
                type="submit"
                className="h-7 rounded-full border bg-primary px-2.5 text-xs text-primary-foreground"
              >
                新增
              </button>
            </form>
            <button
              type="button"
              onClick={() => setBinEditing((open) => !open)}
              className={cn(
                "h-7 rounded-full border px-2.5 text-xs",
                binEditing
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground",
              )}
            >
              {binEditing ? "完成" : "減少"}
            </button>
          </div>
        )}
      </div>

      {!current ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <p className="text-sm font-semibold">還沒有盤點單</p>
          <Button onClick={openMonthSheet}>開立本月盤點單</Button>
        </div>
      ) : binFilter === TOTALS ? (
        <div className="overflow-x-auto px-3 py-3 print:hidden">
          <h2 className="text-sm font-semibold">盤點總計</h2>
          <CabinetTotals
            stats={cabinetStats}
            grand={cabinetGrand}
          />
        </div>
      ) : !activeBin ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          請選櫃子開始打
        </p>
      ) : (
        <div className="overflow-x-auto print:hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-10 px-2 py-1.5 text-left text-xs font-semibold">
                  項
                </th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold">
                  品項
                </th>
                <th className="w-36 px-2 py-1.5 text-left text-xs font-semibold">
                  保存期限
                </th>
                <th className="w-20 px-2 py-1.5 text-right text-xs font-semibold">
                  數量
                </th>
                <th className="w-24 px-2 py-1.5 text-right text-xs font-semibold">
                  金額
                </th>
                <th className="w-24 px-2 py-1.5 text-right text-xs font-semibold">
                  總計
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {visible.map((line, index) => {
                const sell = lineSellPrice(line, state.products);
                const qty = line.countedQty ?? 0;
                const key = stocktakeLineKey(line);
                const expiryRaw = line.expiresOn || "";
                return (
                  <tr key={key} className="border-b border-dashed">
                    <td className="px-2 py-1 text-xs tabular-nums text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="px-2 py-1">
                      <input
                        list="stocktake-product-names"
                        defaultValue={line.name}
                        disabled={locked}
                        onBlur={(event) =>
                          saveLine(key, {
                            name: event.target.value,
                            date: lineExpiryValue(line),
                            qty: line.countedQty == null ? "" : String(line.countedQty),
                            price: String(sell),
                          })
                        }
                        className="h-8 w-full rounded border bg-background px-1.5 text-sm outline-none focus:border-primary"
                        aria-label={`${activeBin} 品項`}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        inputMode="numeric"
                        defaultValue={lineExpiryValue(line)}
                        disabled={locked}
                        onBlur={(event) =>
                          saveLine(key, {
                            name: line.name,
                            date: event.target.value,
                            qty: line.countedQty == null ? "" : String(line.countedQty),
                            price: String(sell),
                          })
                        }
                        className={cn(
                          "h-8 w-full rounded border px-1.5 text-sm tabular-nums outline-none focus:border-primary",
                          expiryThisYearClass(expiryRaw),
                        )}
                        aria-label={`${line.name} 保存期限`}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        inputMode="numeric"
                        defaultValue={line.countedQty == null ? "" : String(line.countedQty)}
                        disabled={locked}
                        onBlur={(event) =>
                          saveLine(key, {
                            name: line.name,
                            date: lineExpiryValue(line),
                            qty: event.target.value,
                            price: String(sell),
                          })
                        }
                        className="h-8 w-full rounded border bg-background px-1.5 text-right text-sm tabular-nums outline-none focus:border-primary"
                        aria-label={`${line.name} 數量`}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        inputMode="numeric"
                        defaultValue={sell ? String(sell) : ""}
                        disabled={locked}
                        onBlur={(event) =>
                          saveLine(key, {
                            name: line.name,
                            date: lineExpiryValue(line),
                            qty: line.countedQty == null ? "" : String(line.countedQty),
                            price: event.target.value,
                          })
                        }
                        className="h-8 w-full rounded border bg-background px-1.5 text-right text-sm tabular-nums outline-none focus:border-primary"
                        aria-label={`${line.name} 金額`}
                      />
                    </td>
                    <td className="px-2 py-1 text-right text-sm tabular-nums">
                      {twd(qty * sell)}
                    </td>
                    <td className="px-1 py-1">
                      {locked ? null : (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            const result = removeStocktakeLine({
                              id: current.id,
                              lineId: key,
                            });
                            if (!result.ok) toast.error(result.error);
                          }}
                        >
                          刪
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {locked ? null : (
                <tr className="border-b">
                  <td className="px-2 py-1 text-xs text-muted-foreground">
                    {visible.length + 1}
                  </td>
                  <td className="px-2 py-1">
                    <input
                      list="stocktake-product-names"
                      value={draftRow.name}
                      placeholder="打名稱"
                      onChange={(event) =>
                        setDraftRow((row) => ({ ...row, name: event.target.value }))
                      }
                      onBlur={() => {
                        if (!draftRow.name.trim()) return;
                        const hit = state.products.find(
                          (item) => item.name === draftRow.name.trim(),
                        );
                        const next = {
                          ...draftRow,
                          date: draftRow.date,
                          price:
                            draftRow.price ||
                            (hit ? String(hit.price) : draftRow.price),
                        };
                        const result = saveLine(undefined, next);
                        if (result?.ok) {
                          setDraftRow({
                            name: "",
                            date: "",
                            qty: "",
                            price: "",
                          });
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.currentTarget.blur();
                      }}
                      className="h-8 w-full rounded border bg-background px-1.5 text-sm outline-none focus:border-primary"
                      aria-label={`${activeBin} 新品項`}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      inputMode="numeric"
                      value={draftRow.date}
                      onChange={(event) =>
                        setDraftRow((row) => ({ ...row, date: event.target.value }))
                      }
                      className={cn(
                        "h-8 w-full rounded border px-1.5 text-sm tabular-nums outline-none focus:border-primary",
                        expiryThisYearClass(draftRow.date),
                      )}
                      aria-label="新保存期限"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      inputMode="numeric"
                      value={draftRow.qty}
                      placeholder="數量"
                      onChange={(event) =>
                        setDraftRow((row) => ({ ...row, qty: event.target.value }))
                      }
                      className="h-8 w-full rounded border bg-background px-1.5 text-right text-sm tabular-nums outline-none focus:border-primary"
                      aria-label="新數量"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      inputMode="numeric"
                      value={draftRow.price}
                      placeholder="價錢"
                      onChange={(event) =>
                        setDraftRow((row) => ({ ...row, price: event.target.value }))
                      }
                      className="h-8 w-full rounded border bg-background px-1.5 text-right text-sm tabular-nums outline-none focus:border-primary"
                      aria-label="新金額"
                    />
                  </td>
                  <td className="px-2 py-1 text-right text-sm tabular-nums text-muted-foreground">
                    {twd(
                      (Number(draftRow.qty) || 0) * (Number(draftRow.price) || 0),
                    )}
                  </td>
                  <td />
                </tr>
              )}
              {(() => {
                const stat = groupStat(visible, state.products);
                return (
                  <tr>
                    <td className="px-2 py-2 text-xs font-semibold" colSpan={3}>
                      {activeBin}合計
                    </td>
                    <td className="px-2 py-2 text-right text-xs font-semibold tabular-nums">
                      {stat.qty}
                    </td>
                    <td />
                    <td className="px-2 py-2 text-right text-xs font-semibold tabular-nums">
                      {twd(stat.amount)}
                    </td>
                    <td />
                  </tr>
                );
              })()}
            </tbody>
          </table>
          <datalist id="stocktake-product-names">
            {state.products.map((item) => (
              <option key={item.id} value={item.name} />
            ))}
          </datalist>
          <p className="px-3 py-2 text-[11px] text-muted-foreground">
            保存期限只打數字，不用斜線。今年的紅底，2027以後不標色。數量可以先空白，按「暫時存檔」。
          </p>
        </div>
      )}

      {current && (
        <StocktakePrintSheet
          shopName={displayShopName(normalizeSettings(state.settings))}
          title={`${current.title}盤點表`}
          number={current.number}
          countedOn={formatDateYmd(stocktakeCountedAt(current))}
          confirmedAt={
            current.confirmedAt ? formatDateTime(current.confirmedAt) : ""
          }
          groups={grouped}
          products={state.products}
          printBlank={printBlank}
          printAudit={printAudit}
        />
      )}

      {current && !locked && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur print:hidden">
          {reviewing ? (
            <div className="mx-auto max-w-3xl">
              <p className="font-semibold">
                即將把 {summary?.counted ?? 0} 項實盤寫入庫存
              </p>
              {summary && summary.pending > 0 && (
                <p className="mt-1 text-sm text-amber-800">
                  還有 {summary.pending} 項未盤
                </p>
              )}
              {variances.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  已盤項目都和帳面相符。
                </p>
              ) : (
                <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-sm">
                  {variances.map((line) => {
                    const diff = lineDiff(line) ?? 0;
                    return (
                      <li key={line.productId}>
                        <span className="font-medium">{line.name}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          帳面 {line.bookQty} → 實盤 {line.countedQty}
                          {diff < 0
                            ? ` · 缺失 ${-diff}`
                            : ` · 盤盈 +${diff}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" onClick={applySheet}>
                  確定入帳
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReviewing(false)}
                >
                  返回繼續盤
                </Button>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                {summary
                  ? summary.pending > 0
                    ? `已記下 ${summary.total} 項 · 數量未填 ${summary.pending} 項`
                    : `已盤 ${summary.counted}/${summary.total} · 缺失 ${summary.missing} 項`
                  : ""}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={removeSheet}>
                  刪除此單
                </Button>
                <Button
                  type="button"
                  variant={summary && summary.pending > 0 ? "default" : "outline"}
                  onClick={parkSheet}
                >
                  暫時存檔
                </Button>
                <Button
                  type="button"
                  variant={summary && summary.pending > 0 ? "outline" : "default"}
                  onClick={() => {
                    if (!summary || summary.counted === 0) {
                      toast.error("數量可以晚點填。現在請按「暫時存檔」。要入帳再填數量。");
                      return;
                    }
                    setReviewing(true);
                  }}
                >
                  核對後入帳
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {current && locked && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-end">
            <Button type="button" variant="outline" onClick={removeSheet}>
              刪除此單
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CabinetTotals({
  stats,
  grand,
}: {
  stats: { title: string; items: number; qty: number; amount: number }[];
  grand: { items: number; qty: number; amount: number };
}) {
  return (
    <table className="mt-1 w-full max-w-xl text-xs">
      <thead>
        <tr className="border-b">
          <th className="py-1 text-left font-semibold">品項</th>
          <th className="py-1 text-right font-semibold">項數</th>
          <th className="py-1 text-right font-semibold">數量</th>
          <th className="py-1 text-right font-semibold">金額</th>
          <th className="py-1 text-right font-semibold">總計</th>
        </tr>
      </thead>
      <tbody>
        {stats.length === 0 ? (
          <tr>
            <td colSpan={5} className="py-3 text-muted-foreground">
              各櫃還沒有打品項
            </td>
          </tr>
        ) : (
          stats.map((item) => (
            <tr key={item.title} className="border-b border-dashed">
              <td className="py-0.5">{item.title}</td>
              <td className="py-0.5 text-right tabular-nums">{item.items}</td>
              <td className="py-0.5 text-right tabular-nums">{item.qty}</td>
              <td className="py-0.5 text-right tabular-nums">{twd(item.amount)}</td>
              <td className="py-0.5 text-right tabular-nums">{twd(item.amount)}</td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot>
        <tr className="border-t">
          <td className="py-1 font-semibold">合計</td>
          <td className="py-1 text-right font-semibold tabular-nums">{grand.items}</td>
          <td className="py-1 text-right font-semibold tabular-nums">{grand.qty}</td>
          <td className="py-1 text-right font-semibold tabular-nums">
            {twd(grand.amount)}
          </td>
          <td className="py-1 text-right font-semibold tabular-nums">
            {twd(grand.amount)}
          </td>
        </tr>
        <tr>
          <td className="py-1 font-semibold">總計</td>
          <td />
          <td />
          <td />
          <td className="py-1 text-right font-semibold tabular-nums">
            {twd(grand.amount)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function StocktakePrintSheet({
  shopName,
  title,
  number,
  countedOn,
  confirmedAt,
  groups,
  products,
  printBlank,
  printAudit,
}: {
  shopName: string;
  title: string;
  number: string;
  countedOn: string;
  confirmedAt: string;
  groups: { title: string; lines: StocktakeLine[] }[];
  products: { id: string; price: number; cost: number }[];
  printBlank: boolean;
  printAudit: boolean;
}) {
  const stats = groups.map((group) => ({
    title: group.title,
    ...groupStat(group.lines, products),
  }));
  const grand = stats.reduce(
    (acc, item) => ({
      items: acc.items + item.items,
      qty: acc.qty + item.qty,
      amount: acc.amount + item.amount,
    }),
    { items: 0, qty: 0, amount: 0 },
  );
  return (
    <div className="stocktake-print hidden print:block">
      <p className="font-semibold">
        {shopName} · {title} · {number} · {countedOn}
      </p>
      <p className="text-[0.95em] text-muted-foreground">
        {confirmedAt ? `入帳 ${confirmedAt}` : "草稿"}
      </p>
      {groups.map((group) => {
        const cols = chunkLines(group.lines, 2);
        const stat = groupStat(group.lines, products);
        return (
          <section
            key={group.title}
            className="stocktake-print-group st-excel-sheet mb-3"
          >
            <h3 className="mb-1 text-center font-semibold">
              {group.title}盤點
            </h3>
            <div className="st-excel-grid">
              {cols.map((col, colIndex) => {
                const colStat = groupStat(col, products);
                return (
                  <table key={colIndex}>
                    <thead>
                      <tr>
                        <th>品項</th>
                        <th>保存期限</th>
                        <th className="num">數量</th>
                        <th className="num">金額</th>
                        <th className="num">總計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {col.map((line) => {
                        const sell = lineSellPrice(line, products);
                        const qty = lineQty(line);
                        return (
                          <tr key={line.productId || line.id}>
                            <td>{line.name}</td>
                            <td
                              className={
                                isThisYearExpiry(line.expiresOn || "")
                                  ? "st-exp-expired"
                                  : undefined
                              }
                            >
                              {displayExpiry(line.expiresOn || "")}
                            </td>
                            <td className="num">
                              {printBlank ? "" : qty}
                            </td>
                            <td className="num">{Math.round(sell)}</td>
                            <td className="num">
                              {printBlank ? "" : Math.round(qty * sell)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>合計</td>
                        <td />
                        <td className="num">
                          {printBlank ? "" : colStat.qty}
                        </td>
                        <td />
                        <td className="num">
                          {printBlank ? "" : Math.round(colStat.amount)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                );
              })}
            </div>
            <p className="mt-1 font-semibold tabular-nums">
              總計 {printBlank ? "" : Math.round(stat.amount)}
            </p>
          </section>
        );
      })}
      <section className="st-excel-sheet mt-4">
        <h3 className="mb-1 text-center font-semibold">盤點總計</h3>
        <table className="st-excel-summary">
          <thead>
            <tr>
              <th>品項</th>
              <th className="num">項數</th>
              <th className="num">數量</th>
              <th className="num">金額</th>
              <th className="num">總計</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((item) => (
              <tr key={item.title}>
                <td>{item.title}</td>
                <td className="num">{item.items}</td>
                <td className="num">{printBlank ? "" : item.qty}</td>
                <td className="num">
                  {printBlank ? "" : Math.round(item.amount)}
                </td>
                <td className="num">
                  {printBlank ? "" : Math.round(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>合計</td>
              <td className="num">{grand.items}</td>
              <td className="num">{printBlank ? "" : grand.qty}</td>
              <td className="num">
                {printBlank ? "" : Math.round(grand.amount)}
              </td>
              <td className="num">
                {printBlank ? "" : Math.round(grand.amount)}
              </td>
            </tr>
            <tr>
              <td>總計</td>
              <td />
              <td />
              <td />
              <td className="num">
                {printBlank ? "" : Math.round(grand.amount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>
      <p className="mt-3">
        {printAudit
          ? "抽查人：__________　覆核：__________　日期：__________"
          : "盤點人：__________　覆核：__________　日期：__________"}
      </p>
    </div>
  );
}
