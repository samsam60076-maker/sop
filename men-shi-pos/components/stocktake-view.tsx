"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChipListManager } from "@/components/chip-list-manager";
import { YmdPicker } from "@/components/ymd-picker";
import {
  monthStocktakeTitle,
  stocktakeCountedAt,
  stocktakeSummary,
} from "@/lib/engine";
import {
  formatDateTime,
  formatDateYmd,
  inputDateToIso,
  toInputDate,
  ymdParts,
} from "@/lib/format";
import {
  displayBin,
  displayShopName,
  listedBins,
  listedCategories,
  normalizeSettings,
} from "@/lib/shop";
import { useStore } from "@/lib/store";
import type { StocktakeLine } from "@/lib/types";
import { cn } from "@/lib/utils";

type RowFilter = "all" | "pending" | "missing" | "surplus";
type PrintMode = "none" | "blank" | "check" | "audit";
type PrintSize = "small" | "mid";
type PrintCols = 1 | 2;
type PrintScope = "all" | "shown";
const UNMARKED = "未註明";

const FILTERS: { value: RowFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending", label: "未盤" },
  { value: "missing", label: "缺失" },
  { value: "surplus", label: "盤盈" },
];

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

export function StocktakeView() {
  const {
    state,
    startStocktake,
    saveStocktakeCounts,
    confirmStocktake,
    discardStocktake,
    refreshStocktakeCatalog,
    saveStocktakeBins,
    setStocktakeCountedAt,
    addBin,
    renameBin,
    removeBin,
  } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RowFilter>("all");
  const [binFilter, setBinFilter] = useState("all");
  const [reviewing, setReviewing] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>("none");
  const [printSize, setPrintSize] = useState<PrintSize>("small");
  const [printCols, setPrintCols] = useState<PrintCols>(2);
  const [printScope, setPrintScope] = useState<PrintScope>("all");
  const [draftCounts, setDraftCounts] = useState<Record<string, string>>({});
  const [takeDate, setTakeDate] = useState(toInputDate);

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

  const binOptions = listedBins(normalizeSettings(state.settings));
  const printing = printMode !== "none";
  const printBlank = printMode === "blank";
  const printAudit = printMode === "audit";

  const visible = useMemo(() => {
    if (!current) return [];
    const source = printing ? current.lines : current.lines;
    const q = query.trim().toLowerCase();
    return source.filter((line) => {
      if (printing && printScope === "all") return true;
      const editing = Object.prototype.hasOwnProperty.call(
        draftCounts,
        line.productId,
      );
      const status = lineStatus(line);
      const bin = line.bin?.trim() ? line.bin : UNMARKED;
      if (binFilter !== "all" && bin !== binFilter && !editing) return false;
      if (filter !== "all" && status !== filter && !editing) return false;
      if (!q) return true;
      return (
        line.name.toLowerCase().includes(q) ||
        line.sku.toLowerCase().includes(q)
      );
    });
  }, [current, query, filter, binFilter, draftCounts, printing, printScope]);

  const grouped = useMemo(() => {
    if (printAudit) {
      const order = listedBins(normalizeSettings(state.settings), visible);
      const groups = order
        .map((bin) => ({
          title: bin,
          lines: visible.filter((line) => displayBin(line.bin) === bin),
        }))
        .filter((group) => group.lines.length > 0);
      const leftover = visible.filter((line) => !line.bin?.trim());
      if (leftover.length > 0) {
        groups.push({ title: UNMARKED, lines: leftover });
      }
      return groups;
    }
    const order = listedCategories(normalizeSettings(state.settings), visible);
    const groups = order
      .map((category) => ({
        title: category,
        lines: visible.filter((line) => line.category === category),
      }))
      .filter((group) => group.lines.length > 0);
    const seen = new Set(
      groups.flatMap((group) => group.lines.map((line) => line.productId)),
    );
    const leftover = visible.filter((line) => !seen.has(line.productId));
    if (leftover.length > 0) {
      groups.push({ title: "未分類", lines: leftover });
    }
    return groups;
  }, [state.settings, visible, printAudit]);

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
    setDraftCounts({});
    toast.success(`已開立 ${result.data.number}，帳面數量已凍結`);
  }

  function countValue(line: StocktakeLine) {
    if (Object.prototype.hasOwnProperty.call(draftCounts, line.productId)) {
      return draftCounts[line.productId];
    }
    return line.countedQty == null ? "" : String(line.countedQty);
  }

  function setCountDraft(productId: string, value: string) {
    if (!current || locked) return;
    if (value !== "" && !/^\d*$/.test(value)) return;
    setDraftCounts((currentDraft) => ({
      ...currentDraft,
      [productId]: value,
    }));
  }

  function commitCount(productId: string) {
    if (!current || locked) return;
    if (!Object.prototype.hasOwnProperty.call(draftCounts, productId)) return;
    const value = draftCounts[productId] ?? "";
    const countedQty = value.trim() === "" ? null : Number(value);
    if (countedQty != null && (!Number.isFinite(countedQty) || countedQty < 0)) {
      setDraftCounts((currentDraft) => {
        const next = { ...currentDraft };
        delete next[productId];
        return next;
      });
      return;
    }
    const result = saveStocktakeCounts({
      id: current.id,
      counts: { [productId]: countedQty },
    });
    setDraftCounts((currentDraft) => {
      const next = { ...currentDraft };
      delete next[productId];
      return next;
    });
    if (!result.ok) toast.error(result.error);
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

  function changeLineBin(productId: string, bin: string) {
    if (!current || locked) return;
    const result = saveStocktakeBins({
      id: current.id,
      bins: { [productId]: bin },
    });
    if (!result.ok) toast.error(result.error);
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
      <div className="border-b bg-card px-4 py-4 md:px-6 print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-heading flex items-center gap-2 text-3xl font-semibold">
              <ClipboardCheck className="size-8" />
              盤點單
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">盤點日期</span>
              <YmdPicker
                compact
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
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => printSheet("blank")}>
              <Printer data-icon="inline-start" />
              列印空白單
            </Button>
            <Button
              variant="outline"
              onClick={() => printSheet("check")}
              disabled={!current}
            >
              <Printer data-icon="inline-start" />
              列印核對
            </Button>
            <Button
              variant="outline"
              onClick={() => printSheet("audit")}
              disabled={!current}
            >
              <Printer data-icon="inline-start" />
              列印抽查表
            </Button>
            {current ? (
              <Button type="button" variant="outline" onClick={removeSheet}>
                刪除此單
              </Button>
            ) : null}
            <Button onClick={openMonthSheet}>開立本月盤點單</Button>
          </div>
        </div>
        {current ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>列印</span>
            <PrintChoice
              value={printSize}
              onChange={setPrintSize}
              options={[
                { value: "small", label: "小字" },
                { value: "mid", label: "中字" },
              ]}
            />
            <PrintChoice
              value={printCols}
              onChange={setPrintCols}
              options={[
                { value: 1, label: "一欄" },
                { value: 2, label: "兩欄" },
              ]}
            />
            <PrintChoice
              value={printScope}
              onChange={setPrintScope}
              options={[
                { value: "all", label: "全部" },
                { value: "shown", label: "畫面上的" },
              ]}
            />
          </div>
        ) : null}

        {sheets.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto print:hidden">
            {sheets.map((sheet) => (
              <button
                key={sheet.id}
                type="button"
                onClick={() => {
                  setSelectedId(sheet.id);
                  setReviewing(false);
                  setDraftCounts({});
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm whitespace-nowrap",
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
                {sheet.status === "draft" ? " · 未入帳" : " · 已入帳"}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 print:hidden">
          <ChipListManager
            label="櫃位"
            items={normalizeSettings(state.settings).bins}
            addPlaceholder="新櫃位"
            onAdd={(name) => {
              const result = addBin(name);
              if (!result.ok) {
                toast.error(result.error);
                return false;
              }
              return true;
            }}
            onRename={(from, to) => {
              const result = renameBin(from, to);
              if (!result.ok) {
                toast.error(result.error);
                return false;
              }
              return true;
            }}
            onRemove={(name) => {
              if (!window.confirm(`確定刪除櫃位「${name}」？`)) return false;
              const result = removeBin(name);
              if (!result.ok) {
                toast.error(result.error);
                return false;
              }
              return true;
            }}
          />
        </div>

        {current && summary && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 print:hidden">
            <SummaryCard label="應盤" value={`${summary.total} 項`} />
            <SummaryCard label="已盤" value={`${summary.counted} 項`} />
            <SummaryCard label="未盤" value={`${summary.pending} 項`} />
            <SummaryCard
              label="缺失"
              value={`${summary.missing} 項 / ${summary.missingQty} 件`}
              tone={summary.missing > 0 ? "bad" : undefined}
            />
            <SummaryCard
              label="盤盈"
              value={`${summary.surplus} 項 / ${summary.surplusQty} 件`}
            />
          </div>
        )}

        {current && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row print:hidden">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋名稱"
              className="sm:max-w-xs"
            />
            <div className="flex gap-1 overflow-x-auto">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm whitespace-nowrap",
                    filter === item.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {current && (
          <div className="mt-2 flex gap-1 overflow-x-auto print:hidden">
            {["全部", ...binOptions, UNMARKED].map((item) => {
              const value = item === "全部" ? "all" : item;
              const count =
                item === "全部"
                  ? current.lines.length
                  : item === UNMARKED
                    ? current.lines.filter((line) => !line.bin?.trim()).length
                    : current.lines.filter((line) => line.bin === item).length;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setBinFilter(value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm whitespace-nowrap",
                    binFilter === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {item} {count}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!current ? (
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <p className="text-2xl font-semibold">還沒有盤點單</p>
          {state.products.length > 0 ? (
            <Button onClick={openMonthSheet}>開立本月盤點單</Button>
          ) : (
            <p className="text-muted-foreground">還沒有商品</p>
          )}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          沒有符合的商品
        </p>
      ) : (
        <div className="overflow-x-auto print:hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">項</TableHead>
                <TableHead>商品名稱</TableHead>
                <TableHead className="w-40">在哪一櫃</TableHead>
                <TableHead className="text-right">帳面</TableHead>
                <TableHead className="text-right">實盤</TableHead>
                <TableHead className="text-right">差異</TableHead>
                <TableHead className={printAudit ? "print:hidden" : ""}>
                  核對
                </TableHead>
              </TableRow>
            </TableHeader>
            {grouped.map((group) => (
              <TableBody key={group.title}>
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="bg-muted/60 font-semibold"
                  >
                    {group.title}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {group.lines.length} 項 · 帳面{" "}
                      {group.lines.reduce(
                        (sum, line) => sum + line.bookQty,
                        0,
                      )}
                    </span>
                  </TableCell>
                </TableRow>
                {group.lines.map((line, index) => {
                  const diff = lineDiff(line);
                  const status = lineStatus(line);
                  return (
                    <TableRow
                      key={line.productId}
                      className={cn(
                        status === "missing" && "bg-red-50 dark:bg-red-950/30",
                        status === "surplus" &&
                          "bg-amber-50 dark:bg-amber-950/20",
                      )}
                    >
                      <TableCell className="text-muted-foreground tabular-nums">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{line.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {line.sku} · {line.unit}
                        </div>
                      </TableCell>
                      <TableCell>
                        {printBlank ? (
                          <span className="block h-8 border-b border-foreground" />
                        ) : locked || printing ? (
                          <span>{line.bin?.trim() || UNMARKED}</span>
                        ) : (
                          <select
                            value={line.bin ?? ""}
                            onChange={(event) =>
                              changeLineBin(line.productId, event.target.value)
                            }
                            aria-label={`${line.name} 在哪一櫃`}
                            className="h-9 w-full max-w-[11rem] rounded-md border bg-background px-1.5 text-sm"
                          >
                            <option value="">{UNMARKED}</option>
                            {binOptions.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.bookQty}
                      </TableCell>
                      <TableCell className="text-right">
                        {locked ? (
                          <span className="tabular-nums">
                            {line.countedQty ?? "—"}
                          </span>
                        ) : (
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="off"
                            value={countValue(line)}
                            onChange={(event) =>
                              setCountDraft(line.productId, event.target.value)
                            }
                            onBlur={() => commitCount(line.productId)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.currentTarget.blur();
                              }
                            }}
                            placeholder="打數量"
                            aria-label={`${line.name} 實盤`}
                            className={cn(
                              "h-11 w-24 rounded-md border bg-background px-2 text-right text-base tabular-nums outline-none focus:border-primary",
                              "print:h-8 print:border-foreground",
                              printBlank &&
                                "print:text-transparent print:placeholder:text-transparent",
                            )}
                          />
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          diff != null &&
                            diff < 0 &&
                            "font-semibold text-destructive",
                        )}
                      >
                        {printBlank
                          ? ""
                          : diff == null
                            ? "—"
                            : diff > 0
                              ? `+${diff}`
                              : String(diff)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-sm",
                          printAudit && "print:hidden",
                        )}
                      >
                        {printBlank
                          ? ""
                          : status === "pending"
                            ? "未盤"
                            : status === "missing"
                              ? "缺失"
                              : status === "surplus"
                                ? "盤盈"
                                : "相符"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            ))}
          </Table>
        </div>
      )}

      {current && (
        <StocktakePrintSheet
          shopName={displayShopName(normalizeSettings(state.settings))}
          title={printAudit ? "冰箱抽查表" : current.title}
          number={current.number}
          countedOn={formatDateYmd(stocktakeCountedAt(current))}
          confirmedAt={
            current.confirmedAt ? formatDateTime(current.confirmedAt) : ""
          }
          groups={grouped}
          printBlank={printBlank}
          printAudit={printAudit}
          printSize={printSize}
          printCols={printCols}
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
                  ? `已盤 ${summary.counted}/${summary.total} · 缺失 ${summary.missing} 項`
                  : ""}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={removeSheet}>
                  刪除此單
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (!summary || summary.counted === 0) {
                      toast.error("請先填實盤數量");
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

function PrintChoice<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <span className="inline-flex rounded-md border bg-background p-0.5">
      {options.map((item) => (
        <button
          key={String(item.value)}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            "rounded px-2 py-0.5",
            value === item.value
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted",
          )}
        >
          {item.label}
        </button>
      ))}
    </span>
  );
}

function StocktakePrintSheet({
  shopName,
  title,
  number,
  countedOn,
  confirmedAt,
  groups,
  printBlank,
  printAudit,
  printSize,
  printCols,
}: {
  shopName: string;
  title: string;
  number: string;
  countedOn: string;
  confirmedAt: string;
  groups: { title: string; lines: StocktakeLine[] }[];
  printBlank: boolean;
  printAudit: boolean;
  printSize: PrintSize;
  printCols: PrintCols;
}) {
  const total = groups.reduce((sum, group) => sum + group.lines.length, 0);
  return (
    <div
      className={cn(
        "stocktake-print hidden print:block",
        printSize === "mid" && "stocktake-print-mid",
      )}
    >
      <p className="font-semibold">
        {shopName} · {title} · {number} · {total}項
      </p>
      <p className="text-[0.95em] text-muted-foreground">
        盤點日 {countedOn}
        {confirmedAt ? ` · 入帳 ${confirmedAt}` : " · 草稿"}
      </p>
      <div
        className={cn(
          "mt-2",
          printCols === 2 && "stocktake-print-cols",
        )}
      >
        {groups.map((group) => (
          <section
            key={group.title}
            className="stocktake-print-group mb-2"
          >
            <h3 className="border-b border-foreground font-semibold">
              {group.title}
              <span className="ml-1 font-normal">
                {group.lines.length}項 · 帳
                {group.lines.reduce((sum, line) => sum + line.bookQty, 0)}
              </span>
            </h3>
            <ul>
              {group.lines.map((line, index) => {
                const diff = lineDiff(line);
                return (
                  <li
                    key={line.productId}
                    className="stocktake-print-line grid items-center gap-x-1 border-b border-foreground/25 py-px"
                    style={{
                      gridTemplateColumns: printAudit
                        ? "1.15rem minmax(0,1fr) 1.5rem 2.1rem 1.4rem"
                        : "1.15rem minmax(0,1fr) 2.4rem 1.5rem 2.1rem 1.4rem",
                    }}
                  >
                    <span className="tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 truncate">{line.name}</span>
                    {printAudit ? null : (
                      <span className="min-w-0 truncate">
                        {line.bin?.trim() || "—"}
                      </span>
                    )}
                    <span className="text-right tabular-nums">
                      {line.bookQty}
                    </span>
                    <span className="min-h-[1.1em] border-b border-foreground text-right tabular-nums">
                      {printBlank ? "" : (line.countedQty ?? "")}
                    </span>
                    <span className="text-right tabular-nums">
                      {printBlank || diff == null
                        ? ""
                        : diff > 0
                          ? `+${diff}`
                          : String(diff)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-3">
        {printAudit
          ? "抽查人：__________　覆核：__________　日期：__________"
          : "盤點人：__________　覆核：__________　日期：__________"}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bad";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-background px-3 py-2",
        tone === "bad" && "border-destructive/40 bg-red-50 dark:bg-red-950/20",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
