"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { YmdPicker } from "@/components/ymd-picker";
import { formatTime, toInputDate, twd, ymdParts } from "@/lib/format";
import {
  buildExpenseDetails,
  buildPurchaseDetails,
  buildReturnDetails,
  buildSaleDetails,
  buildStockReport,
  expenseTotals,
  groupSaleTickets,
  purchaseDetailTotals,
  reportTotals,
  returnDetailTotals,
  saleDetailTotals,
  grossMargin,
  marginLabel,
  stockChangeNote,
  type ReportPeriod,
  type SaleDetailLine,
} from "@/lib/report";
import {
  HeaderCheck,
  PickBar,
  dropIds,
  toggleAll,
  toggleId,
} from "@/components/record-pick";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { BranchId } from "@/lib/branches";

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: "day", label: "當日" },
  { value: "month", label: "該月" },
  { value: "all", label: "全部" },
];

export function StockReportView() {
  const {
    state,
    storeId,
    storeName,
    allStores,
    switchStore,
    removeSale,
    removeSales,
    removePurchase,
    removePurchases,
    removeReturn,
    removeReturns,
    removeExpense,
    removeExpenses,
  } = useStore();
  const [period, setPeriod] = useState<ReportPeriod>("day");
  const [day, setDay] = useState(toInputDate());
  const [query, setQuery] = useState("");
  const [pickedSales, setPickedSales] = useState<Set<string>>(new Set());
  const [pickedPurchases, setPickedPurchases] = useState<Set<string>>(
    new Set(),
  );
  const [pickedReturns, setPickedReturns] = useState<Set<string>>(new Set());
  const [pickedExpenses, setPickedExpenses] = useState<Set<string>>(new Set());
  const pendingPrint = useRef(false);

  const allRows = useMemo(
    () => buildStockReport(state, period, day),
    [state, period, day],
  );
  const details = useMemo(
    () => buildSaleDetails(state, period, day),
    [state, period, day],
  );
  const allPurchaseLines = useMemo(
    () => buildPurchaseDetails(state, period, day),
    [state, period, day],
  );
  const expenseLines = useMemo(
    () => buildExpenseDetails(state, period, day),
    [state, period, day],
  );
  const returnLines = useMemo(
    () => buildReturnDetails(state, period, day),
    [state, period, day],
  );
  const daySales = useMemo(
    () => buildSaleDetails(state, "day", day),
    [state, day],
  );
  const dayReturns = useMemo(
    () => buildReturnDetails(state, "day", day),
    [state, day],
  );
  const monthSales = useMemo(
    () => buildSaleDetails(state, "month", day),
    [state, day],
  );
  const monthReturns = useMemo(
    () => buildReturnDetails(state, "month", day),
    [state, day],
  );
  const monthExpenses = useMemo(
    () => buildExpenseDetails(state, "month", day),
    [state, day],
  );
  const monthPurchases = useMemo(
    () => buildPurchaseDetails(state, "month", day),
    [state, day],
  );
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter(
      (row) =>
        row.product.name.toLowerCase().includes(q) ||
        row.product.sku.toLowerCase().includes(q),
    );
  }, [allRows, query]);

  const visibleDetails = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return details;
    return details.filter(
      (line) =>
        line.name.toLowerCase().includes(q) ||
        line.number.toLowerCase().includes(q) ||
        line.note.toLowerCase().includes(q) ||
        line.saleNote.toLowerCase().includes(q) ||
        saleKind(line).toLowerCase().includes(q),
    );
  }, [details, query]);

  const totals = useMemo(() => reportTotals(rows), [rows]);
  const purchaseLines = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allPurchaseLines;
    return allPurchaseLines.filter(
      (line) =>
        line.name.toLowerCase().includes(q) ||
        line.number.toLowerCase().includes(q),
    );
  }, [allPurchaseLines, query]);

  const saleTotals = useMemo(
    () => saleDetailTotals(visibleDetails),
    [visibleDetails],
  );
  const saleTickets = useMemo(
    () => groupSaleTickets(visibleDetails),
    [visibleDetails],
  );
  const completedSaleCount = state.sales.filter(
    (sale) => sale.status === "completed",
  ).length;
  const buyTotals = useMemo(
    () => purchaseDetailTotals(purchaseLines),
    [purchaseLines],
  );
  const spendTotal = expenseTotals(expenseLines);
  const refundTotal = returnDetailTotals(returnLines);
  const daySaleTotals = saleDetailTotals(daySales);
  const dayRefund = returnDetailTotals(dayReturns).amount;
  const dayRevenue = daySaleTotals.amount - dayRefund;
  const monthRevenue = saleDetailTotals(monthSales);
  const monthRefund = returnDetailTotals(monthReturns);
  const monthSpend = expenseTotals(monthExpenses);
  const monthNetRevenue = monthRevenue.amount - monthRefund.amount;
  const monthNet = monthNetRevenue - monthSpend;
  const monthCogs = monthRevenue.costAmount - monthRefund.costAmount;
  const monthGross = monthNetRevenue - monthCogs;
  const monthRate = grossMargin(monthNetRevenue, monthCogs);
  const monthBuy = purchaseDetailTotals(monthPurchases);
  const hqRows = useMemo(
    () =>
      allStores.map((store) => {
        const sales = saleDetailTotals(buildSaleDetails(store.state, "month", day));
        const refunds = returnDetailTotals(
          buildReturnDetails(store.state, "month", day),
        );
        const spend = expenseTotals(
          buildExpenseDetails(store.state, "month", day),
        );
        return {
          id: store.id,
          name: store.name,
          revenue: sales.amount - refunds.amount,
          spend,
          net: sales.amount - refunds.amount - spend,
        };
      }),
    [allStores, day],
  );
  const [year, month, date] = day.split("-").map(Number);
  const periodLabel =
    period === "day"
      ? `${year}年${month}月${date}日`
      : period === "month"
        ? `${year}年${month}月`
        : "全部";
  const visibleSaleIds = useMemo(
    () => saleTickets.map((ticket) => ticket.saleId),
    [saleTickets],
  );
  const visiblePurchaseIds = useMemo(
    () => [...new Set(purchaseLines.map((line) => line.purchaseId))],
    [purchaseLines],
  );
  const visibleReturnIds = useMemo(
    () => [...new Set(returnLines.map((line) => line.returnId))],
    [returnLines],
  );
  const visibleExpenseIds = useMemo(
    () => expenseLines.map((item) => item.id),
    [expenseLines],
  );

  function deleteOneSale(saleId: string, number: string) {
    if (
      !window.confirm(
        `確定刪除銷貨 ${number}？整張單與這張單的退貨會一併拿掉，庫存加回，可再到收銀重打。`,
      )
    ) {
      return;
    }
    const result = removeSale(saleId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPickedSales((current) => dropIds(current, [saleId]));
    toast.success(`已刪除 ${number}`);
  }

  function deletePickedSales() {
    const ids = [...pickedSales];
    if (ids.length === 0) {
      toast.error("請先勾選要刪的銷貨");
      return;
    }
    if (
      !window.confirm(
        `確定刪除已勾選的 ${ids.length} 張銷貨單？連退貨一併拿掉，庫存加回，可再重打。`,
      )
    ) {
      return;
    }
    const result = removeSales(ids);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPickedSales(new Set());
    toast.success(`已刪除 ${result.data.count} 張銷貨`);
  }

  function deleteOnePurchase(purchaseId: string, number: string) {
    if (
      !window.confirm(
        `確定刪除進貨 ${number}？整張單會拿掉，庫存扣回，可再到進貨重打。`,
      )
    ) {
      return;
    }
    const result = removePurchase(purchaseId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPickedPurchases((current) => dropIds(current, [purchaseId]));
    toast.success(`已刪除 ${number}`);
  }

  function deletePickedPurchases() {
    const ids = [...pickedPurchases];
    if (ids.length === 0) {
      toast.error("請先勾選要刪的進貨");
      return;
    }
    if (
      !window.confirm(
        `確定刪除已勾選的 ${ids.length} 張進貨單？庫存會扣回，可再重打。`,
      )
    ) {
      return;
    }
    const result = removePurchases(ids);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPickedPurchases(new Set());
    toast.success(`已刪除 ${result.data.count} 張進貨`);
  }

  function deleteOneReturn(returnId: string, number: string) {
    if (
      !window.confirm(
        `確定刪除 ${number}？這筆不再從營收扣除；若已回庫，數量會再扣掉。`,
      )
    ) {
      return;
    }
    const result = removeReturn(returnId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPickedReturns((current) => dropIds(current, [returnId]));
    toast.success(`已刪除 ${number}`);
  }

  function deletePickedReturns() {
    const ids = [...pickedReturns];
    if (ids.length === 0) {
      toast.error("請先勾選要刪的退貨");
      return;
    }
    if (
      !window.confirm(
        `確定刪除已勾選的 ${ids.length} 筆退貨／退費？不再從營收扣除。`,
      )
    ) {
      return;
    }
    const result = removeReturns(ids);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPickedReturns(new Set());
    toast.success(`已刪除 ${result.data.count} 筆`);
  }

  function deleteOneExpense(expenseId: string, title: string) {
    if (!window.confirm(`確定刪除支出「${title}」？可再到支出表重打。`)) {
      return;
    }
    const result = removeExpense(expenseId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPickedExpenses((current) => dropIds(current, [expenseId]));
    toast.success("已刪除這筆支出");
  }

  function deletePickedExpenses() {
    const ids = [...pickedExpenses];
    if (ids.length === 0) {
      toast.error("請先勾選要刪的支出");
      return;
    }
    if (!window.confirm(`確定刪除已勾選的 ${ids.length} 筆支出？`)) {
      return;
    }
    const result = removeExpenses(ids);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPickedExpenses(new Set());
    toast.success(`已刪除 ${result.data.count} 筆支出`);
  }

  function printThisStore() {
    setQuery("");
    const hasSales = state.sales.some((sale) => sale.status === "completed");
    const current = buildSaleDetails(state, period, day);
    if (hasSales && current.length === 0) {
      const monthLines = buildSaleDetails(state, "month", day);
      const next = monthLines.length > 0 ? "month" : "all";
      if (next === period) {
        window.print();
        return;
      }
      pendingPrint.current = true;
      setPeriod(next);
      return;
    }
    window.print();
  }

  useEffect(() => {
    if (!pendingPrint.current) return;
    pendingPrint.current = false;
    window.print();
  }, [period, query, details.length]);

  return (
    <div className="flex flex-col print:p-0">
      <div className="border-b bg-card px-3 py-2 md:px-4 print:border-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-5 print:hidden" />
            <h1 className="font-heading text-lg font-semibold print:hidden">
              總表 · {storeName}
            </h1>
            <div className="hidden print:block">
              <p className="font-semibold">
                {storeName}總表 · {periodLabel}
              </p>
              <p className="text-sm">
                銷貨 {saleTickets.length}張 · {saleTotals.qty}件 ·{" "}
                {twd(saleTotals.amount)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Link href="/expenses" className="text-xs underline">
              支出表
            </Link>
            <select
              value={storeId}
              onChange={(event) =>
                switchStore(event.target.value as BranchId)
              }
              className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
              aria-label="列印門市"
            >
              {allStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-xs underline"
              onClick={printThisStore}
            >
              列印本店
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 print:hidden">
          <span className="text-xs text-muted-foreground">年月日</span>
          <YmdPicker
            compact
            value={day}
            onChange={(value) => {
              setDay(value);
              setPeriod("day");
            }}
          />
          <div className="flex rounded-md border bg-background p-0.5">
            {PERIODS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPeriod(item.value)}
                className={cn(
                  "rounded px-2 py-1 text-xs",
                  period === item.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="找商品／單號／備註"
            className="h-8 w-36 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring md:w-44"
            aria-label="搜尋"
          />
        </div>

        <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7 print:hidden">
          {hqRows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => switchStore(row.id)}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-left",
                storeId === row.id
                  ? "border-primary bg-primary/5"
                  : "bg-background hover:bg-muted/40",
              )}
            >
              <p className="text-[11px] text-muted-foreground">{row.name}本月</p>
              <p className="font-heading text-base font-semibold tabular-nums">
                {twd(row.revenue)}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
          <Summary
            label={`${month}/${date}銷售`}
            value={`${daySaleTotals.qty}件`}
            hint={
              dayRefund
                ? `${twd(dayRevenue)} · 退${twd(dayRefund)}`
                : twd(dayRevenue)
            }
          />
          <Summary
            label={`${month}月營收`}
            value={twd(monthNetRevenue)}
            hint={
              monthRefund.amount
                ? `${monthRevenue.qty}件 · 退${twd(monthRefund.amount)}`
                : `${monthRevenue.qty}件`
            }
          />
          <Summary
            label={`${month}月支出`}
            value={twd(monthSpend)}
            hint={`${monthExpenses.length}筆`}
          />
          <Summary
            label={`${month}月結餘`}
            value={twd(monthNet)}
          />
        </div>
        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
          <Summary
            label={`${month}月進貨售價`}
            value={twd(monthBuy.retailAmount)}
            hint={`${monthBuy.qty}件`}
          />
          <Summary
            label={`${month}月進貨批價`}
            value={twd(monthBuy.amount)}
            hint={`${monthBuy.qty}件`}
          />
          <Summary
            label={`${month}月毛利`}
            value={twd(monthGross)}
            hint={`銷貨批價 ${twd(monthCogs)}`}
          />
          <Summary
            label={`${month}月毛利率`}
            value={marginLabel(monthRate)}
            hint={twd(monthGross)}
          />
        </div>
      </div>

      <section className="border-b px-3 py-2 md:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">
            銷貨明細 · {periodLabel}
          </h2>
          <button
            type="button"
            className="text-xs underline print:hidden"
            onClick={() =>
              setPickedSales((current) => toggleAll(current, visibleSaleIds))
            }
          >
            全選
          </button>
          <PickBar
            count={pickedSales.size}
            onDelete={deletePickedSales}
            onClear={() => setPickedSales(new Set())}
            deleteLabel="刪除已勾選銷貨"
          />
        </div>
      </section>

      {visibleDetails.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-muted-foreground print:hidden">
          <p>這個日期還沒有銷貨。</p>
          {completedSaleCount > 0 ? (
            <p className="mt-2">
              銷貨頁有 {completedSaleCount} 張單。
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => setPeriod("month")}
              >
                看該月
              </button>
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => setPeriod("all")}
              >
                看全部
              </button>
            </p>
          ) : null}
        </div>
      ) : (
        <div className="divide-y border-b">
          {saleTickets.map((ticket) => {
            const ymd = ymdParts(ticket.createdAt);
            return (
              <article
                key={ticket.saleId}
                className="px-3 py-2 print:break-inside-avoid md:px-4"
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1 size-3.5 shrink-0 print:hidden"
                    checked={pickedSales.has(ticket.saleId)}
                    onChange={() =>
                      setPickedSales((current) =>
                        toggleId(current, ticket.saleId),
                      )
                    }
                    aria-label={`勾選 ${ticket.number}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                      <span className="tabular-nums">
                        {ymd.year}/{ymd.month}/{ymd.day}
                      </span>
                      <span className="text-muted-foreground">
                        {formatTime(ticket.createdAt)}
                      </span>
                      <span className="font-semibold">{ticket.number}</span>
                      <span className="text-muted-foreground">
                        {ticket.lines.length}項
                      </span>
                      {saleKind(ticket.lines[0]) ? (
                        <KindMark label={saleKind(ticket.lines[0])} />
                      ) : null}
                      <span className="ml-auto font-semibold tabular-nums">
                        {twd(ticket.amount)}
                      </span>
                    </div>
                    <ul className="mt-1 space-y-0.5 text-sm">
                      {ticket.lines.map((line, index) => {
                        const kind = saleKind(line);
                        const changed =
                          line.listPrice != null &&
                          line.unitPrice !== line.listPrice;
                        return (
                          <li
                            key={`${line.productId}-${index}`}
                            className="flex justify-between gap-2"
                          >
                            <span className="min-w-0">
                              {line.name} × {line.qty}
                              <span className="ml-1 text-muted-foreground">
                                · {twd(line.unitPrice)}
                                {changed
                                  ? `（原${twd(line.listPrice ?? 0)}）`
                                  : ""}
                                {` · 批${twd(line.unitCost)}`}
                              </span>
                              {kind && kind !== saleKind(ticket.lines[0]) ? (
                                <span className="ml-1">
                                  <KindMark label={kind} />
                                </span>
                              ) : null}
                              {line.note.trim() && line.note !== ticket.note ? (
                                <span className="ml-1 text-muted-foreground">
                                  · {line.note}
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {twd(line.amount)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {ticket.note && ticket.note !== "正常販售" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ticket.note}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-xs text-destructive underline print:hidden"
                    onClick={() =>
                      deleteOneSale(ticket.saleId, ticket.number)
                    }
                  >
                    刪除
                  </button>
                </div>
              </article>
            );
          })}
          <div className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm font-semibold md:px-4">
            <span>銷售合計 · {saleTickets.length}張</span>
            <span className="tabular-nums">
              {saleTotals.qty}件 · 批{twd(saleTotals.costAmount)} ·{" "}
              {twd(saleTotals.amount)}
            </span>
          </div>
        </div>
      )}

      <section
        className={cn(
          "border-t px-3 py-2 md:px-4",
          returnLines.length === 0 && "print:hidden",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">退貨 · {periodLabel}</h2>
          <PickBar
            count={pickedReturns.size}
            onDelete={deletePickedReturns}
            onClear={() => setPickedReturns(new Set())}
            deleteLabel="刪除已勾選退貨"
          />
        </div>
      </section>

      <div className="overflow-x-auto">
        {returnLines.length === 0 ? (
          <p className="px-6 py-12 text-center text-muted-foreground print:hidden">
            這個日期還沒有退貨。
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 print:hidden">
                  <HeaderCheck
                    ids={visibleReturnIds}
                    selected={pickedReturns}
                    onToggle={() =>
                      setPickedReturns((current) =>
                        toggleAll(current, visibleReturnIds),
                      )
                    }
                    label="全選退貨"
                  />
                </TableHead>
                <TableHead>年</TableHead>
                <TableHead>月</TableHead>
                <TableHead>日</TableHead>
                <TableHead>時間</TableHead>
                <TableHead>退貨單</TableHead>
                <TableHead>原銷貨</TableHead>
                <TableHead>商品名稱</TableHead>
                <TableHead className="text-right">數量</TableHead>
                <TableHead className="text-right">售價</TableHead>
                <TableHead className="text-right">退貨金額</TableHead>
                <TableHead>庫存</TableHead>
                <TableHead>備註</TableHead>
                <TableHead className="w-12 text-right print:hidden">
                  刪除
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returnLines.map((line, index) => {
                const ymd = ymdParts(line.createdAt);
                return (
                  <TableRow key={`${line.returnId}-${index}`}>
                    <TableCell className="w-8 print:hidden">
                      <input
                        type="checkbox"
                        className="size-3.5 align-middle"
                        checked={pickedReturns.has(line.returnId)}
                        onChange={() =>
                          setPickedReturns((current) =>
                            toggleId(current, line.returnId),
                          )
                        }
                        aria-label={`勾選 ${line.number}`}
                      />
                    </TableCell>
                    <TableCell className="tabular-nums">{ymd.year}</TableCell>
                    <TableCell className="tabular-nums">{ymd.month}</TableCell>
                    <TableCell className="tabular-nums">{ymd.day}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTime(line.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">{line.number}</TableCell>
                    <TableCell>{line.saleNumber}</TableCell>
                    <TableCell>{line.name}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {line.qty}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {twd(line.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {twd(line.amount)}
                    </TableCell>
                    <TableCell className="py-1.5">
                      {line.restock ? (
                        <span className="text-sm">已回庫</span>
                      ) : (
                        <KindMark label="報廢" />
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 whitespace-normal text-sm">
                      {line.note || "—"}
                    </TableCell>
                    <TableCell className="text-right print:hidden">
                      <button
                        type="button"
                        className="text-xs text-destructive underline"
                        onClick={() =>
                          deleteOneReturn(line.returnId, line.number)
                        }
                      >
                        刪除
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={8} className="font-semibold">
                  退貨合計
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {refundTotal.qty}
                </TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold tabular-nums">
                  {twd(refundTotal.amount)}
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="print:hidden" />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>

      <section
        className={cn(
          "border-t px-3 py-2 md:px-4",
          purchaseLines.length === 0 && "print:hidden",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">進貨 · {periodLabel}</h2>
          <PickBar
            count={pickedPurchases.size}
            onDelete={deletePickedPurchases}
            onClear={() => setPickedPurchases(new Set())}
            deleteLabel="刪除已勾選進貨"
          />
        </div>
      </section>

      <div className="overflow-x-auto">
        {purchaseLines.length === 0 ? (
          <p className="px-6 py-12 text-center text-muted-foreground print:hidden">
            這個日期還沒有進貨。
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 print:hidden">
                  <HeaderCheck
                    ids={visiblePurchaseIds}
                    selected={pickedPurchases}
                    onToggle={() =>
                      setPickedPurchases((current) =>
                        toggleAll(current, visiblePurchaseIds),
                      )
                    }
                    label="全選進貨"
                  />
                </TableHead>
                <TableHead>年</TableHead>
                <TableHead>月</TableHead>
                <TableHead>日</TableHead>
                <TableHead>時間</TableHead>
                <TableHead>單號</TableHead>
                <TableHead>商品名稱</TableHead>
                <TableHead className="text-right">數量</TableHead>
                <TableHead className="text-right">售價</TableHead>
                <TableHead className="text-right">批價</TableHead>
                <TableHead className="text-right">進貨批價合計</TableHead>
                <TableHead>備註</TableHead>
                <TableHead className="w-12 text-right print:hidden">
                  刪除
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseLines.map((line, index) => {
                const ymd = ymdParts(line.createdAt);
                return (
                  <TableRow
                    key={`${line.purchaseId}-${line.productId}-${index}`}
                  >
                    <TableCell className="w-8 print:hidden">
                      <input
                        type="checkbox"
                        className="size-3.5 align-middle"
                        checked={pickedPurchases.has(line.purchaseId)}
                        onChange={() =>
                          setPickedPurchases((current) =>
                            toggleId(current, line.purchaseId),
                          )
                        }
                        aria-label={`勾選 ${line.number}`}
                      />
                    </TableCell>
                    <TableCell className="tabular-nums">{ymd.year}</TableCell>
                    <TableCell className="tabular-nums">{ymd.month}</TableCell>
                    <TableCell className="tabular-nums">{ymd.day}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTime(line.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">{line.number}</TableCell>
                    <TableCell>{line.name}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {line.qty}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {twd(line.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {twd(line.unitCost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {twd(line.amount)}
                    </TableCell>
                    <TableCell className="max-w-[10rem] truncate text-sm text-muted-foreground">
                      {line.note || "—"}
                    </TableCell>
                    <TableCell className="text-right print:hidden">
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
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={7} className="font-semibold">
                  進貨合計
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {buyTotals.qty}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {twd(buyTotals.retailAmount)}
                </TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold tabular-nums">
                  {twd(buyTotals.amount)}
                </TableCell>
                <TableCell />
                <TableCell className="print:hidden" />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>

      <section
        className={cn(
          "border-t px-3 py-2 md:px-4",
          expenseLines.length === 0 && "print:hidden",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">支出 · {periodLabel}</h2>
          <PickBar
            count={pickedExpenses.size}
            onDelete={deletePickedExpenses}
            onClear={() => setPickedExpenses(new Set())}
            deleteLabel="刪除已勾選支出"
          />
        </div>
      </section>

      <div className="overflow-x-auto">
        {expenseLines.length === 0 ? (
          <p className="px-6 py-12 text-center text-muted-foreground print:hidden">
            這個日期還沒有支出。
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 print:hidden">
                  <HeaderCheck
                    ids={visibleExpenseIds}
                    selected={pickedExpenses}
                    onToggle={() =>
                      setPickedExpenses((current) =>
                        toggleAll(current, visibleExpenseIds),
                      )
                    }
                    label="全選支出"
                  />
                </TableHead>
                <TableHead>年</TableHead>
                <TableHead>月</TableHead>
                <TableHead>日</TableHead>
                <TableHead>時間</TableHead>
                <TableHead>單號</TableHead>
                <TableHead>項目</TableHead>
                <TableHead className="text-right">金額</TableHead>
                <TableHead>備註</TableHead>
                <TableHead className="w-12 text-right print:hidden">
                  刪除
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenseLines.map((item) => {
                const ymd = ymdParts(item.createdAt);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="w-8 print:hidden">
                      <input
                        type="checkbox"
                        className="size-3.5 align-middle"
                        checked={pickedExpenses.has(item.id)}
                        onChange={() =>
                          setPickedExpenses((current) =>
                            toggleId(current, item.id),
                          )
                        }
                        aria-label={`勾選 ${item.title}`}
                      />
                    </TableCell>
                    <TableCell className="tabular-nums">{ymd.year}</TableCell>
                    <TableCell className="tabular-nums">{ymd.month}</TableCell>
                    <TableCell className="tabular-nums">{ymd.day}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTime(item.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">{item.number}</TableCell>
                    <TableCell>{item.title}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {twd(item.amount)}
                    </TableCell>
                    <TableCell className="max-w-[10rem] truncate text-sm text-muted-foreground">
                      {item.note || "—"}
                    </TableCell>
                    <TableCell className="text-right print:hidden">
                      <button
                        type="button"
                        className="text-xs text-destructive underline"
                        onClick={() => deleteOneExpense(item.id, item.title)}
                      >
                        刪除
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={7} className="font-semibold">
                  支出合計
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {twd(spendTotal)}
                </TableCell>
                <TableCell />
                <TableCell className="print:hidden" />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>

      <section className="border-t px-3 py-2 md:px-4">
        <h2 className="text-sm font-semibold">商品總表 · {periodLabel}</h2>
      </section>

      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="px-6 py-16 text-center text-muted-foreground">
            {state.products.length === 0
              ? "還沒有商品"
              : "這個期間沒有符合的商品"}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>商品名稱</TableHead>
                <TableHead>去向</TableHead>
                <TableHead className="text-right">售價</TableHead>
                <TableHead className="text-right">批價</TableHead>
                <TableHead className="text-right">銷貨</TableHead>
                <TableHead className="text-right">銷售金額</TableHead>
                <TableHead className="text-right">銷售成本</TableHead>
                <TableHead className="text-right">進貨</TableHead>
                <TableHead className="text-right">盤點</TableHead>
                <TableHead className="text-right">庫存</TableHead>
                <TableHead className="text-right">庫存金額</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const idle =
                  row.saleQty === 0 &&
                  row.inQty === 0 &&
                  row.takeQty === 0 &&
                  row.returnQty === 0;
                return (
                <TableRow
                  key={row.product.id}
                  className={idle ? "print:hidden" : undefined}
                >
                  <TableCell>
                    <div className="font-medium">{row.product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.product.sku}
                      {!row.product.active ? " · 已停售" : ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{stockChangeNote(row)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {twd(row.product.price)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {twd(row.product.cost)}
                  </TableCell>
                  <TableCell className="text-right text-lg font-semibold tabular-nums">
                    {row.saleQty}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {twd(row.outAmount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {twd(row.outCost)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.inQty}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.takeQty === 0
                      ? "—"
                      : row.takeQty > 0
                        ? `+${row.takeQty}`
                        : row.takeQty}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {row.stock}
                    {row.product.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {twd(row.stockValue)}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">合計</TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell className="text-right font-semibold tabular-nums">
                  {totals.saleQty}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {twd(totals.outAmount)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {twd(totals.outCost)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {totals.inQty}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {totals.takeQty === 0
                    ? "—"
                    : totals.takeQty > 0
                      ? `+${totals.takeQty}`
                      : totals.takeQty}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {totals.stock}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {twd(totals.stockValue)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>
    </div>
  );
}

function saleKind(line: SaleDetailLine) {
  const note = line.note.trim();
  if (/報廢|損壞/.test(note)) return "報廢";
  if (/員工/.test(note)) return "員工價";
  if (note.includes("特價")) return "特價";
  if (note.includes("瑕疵")) return "瑕疵";
  if (note.includes("贈品")) return "贈品";
  if (line.listPrice != null && line.unitPrice !== line.listPrice) return "改價";
  return "";
}

function KindMark({ label }: { label: string }) {
  const tone =
    label === "報廢"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : label === "特價" || label === "改價"
        ? "border-amber-400/60 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        : label === "員工價"
          ? "border-sky-400/60 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100"
          : "border-border bg-muted text-foreground";
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
        tone,
      )}
    >
      {label}
    </span>
  );
}

function Summary({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-md border bg-background px-2 py-1">
      <p className="truncate text-[11px] leading-none text-muted-foreground">
        {label}
      </p>
      <p className="font-heading truncate text-base font-semibold tabular-nums leading-tight">
        {value}
      </p>
      {hint ? (
        <p className="truncate text-[11px] leading-none text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
