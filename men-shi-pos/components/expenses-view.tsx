"use client";

import { useMemo, useState } from "react";
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
import {
  HeaderCheck,
  PickBar,
  dropIds,
  toggleAll,
  toggleId,
} from "@/components/record-pick";
import { YmdPicker } from "@/components/ymd-picker";
import {
  formatTime,
  inputDateToIso,
  toInputDate,
  twd,
  ymdParts,
} from "@/lib/format";
import { buildExpenseDetails, expenseTotals } from "@/lib/report";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const fieldClass =
  "h-8 min-w-0 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export function ExpensesView() {
  const { state, addExpense, removeExpense, removeExpenses } = useStore();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [day, setDay] = useState(toInputDate);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const monthLines = useMemo(
    () => buildExpenseDetails(state, "month", day),
    [state, day],
  );
  const dayLines = useMemo(
    () => buildExpenseDetails(state, "day", day),
    [state, day],
  );
  const monthTotal = expenseTotals(monthLines);
  const dayTotal = expenseTotals(dayLines);
  const [year, month, date] = day.split("-").map(Number);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = addExpense({
      title,
      category: "",
      amount: Number(amount),
      note,
      createdAt: inputDateToIso(day),
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`已記入 ${result.data.number}`);
    setTitle("");
    setAmount("");
    setNote("");
  }

  const visibleExpenseIds = monthLines.map((item) => item.id);

  function deleteOneExpense(id: string, titleText: string) {
    if (!window.confirm(`確定刪除支出「${titleText}」？支出表與總表會一起拿掉。`)) {
      return;
    }
    const result = removeExpense(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPicked((current) => dropIds(current, [id]));
    toast.success("已刪除這筆支出");
  }

  function deletePickedExpenses() {
    const ids = [...picked];
    if (ids.length === 0) {
      toast.error("請先勾選要刪的支出");
      return;
    }
    if (!window.confirm(`確定刪除已勾選的 ${ids.length} 筆支出？總表會一起拿掉。`)) {
      return;
    }
    const result = removeExpenses(ids);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPicked(new Set());
    toast.success(`已刪除 ${result.data.count} 筆支出`);
  }

  return (
    <div className="flex flex-col">
      <div className="border-b bg-card px-3 py-2 md:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-heading text-lg font-semibold">支出表</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="tabular-nums">
              {month}月{date}日{" "}
              <span className="font-semibold">{twd(dayTotal)}</span>
              <span className="ml-1 text-xs text-muted-foreground">
                {dayLines.length} 筆
              </span>
            </span>
            <span className="tabular-nums">
              {month}月合計{" "}
              <span className="font-semibold">{twd(monthTotal)}</span>
              <span className="ml-1 text-xs text-muted-foreground">
                {monthLines.length} 筆
              </span>
            </span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">年月日</span>
          <YmdPicker compact id="expense-date" value={day} onChange={setDay} />
        </div>

        <form
          onSubmit={submit}
          className="mt-2 rounded-lg border bg-background px-2.5 py-2"
        >
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[9rem] flex-1 space-y-0.5">
              <span className="text-[11px] text-muted-foreground">項目</span>
              <input
                id="expense-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例如 店面租金、電費"
                autoComplete="off"
                className={cn(fieldClass, "w-full")}
              />
            </label>
            <label className="w-24 space-y-0.5">
              <span className="text-[11px] text-muted-foreground">金額</span>
              <input
                id="expense-amount"
                type="number"
                min={1}
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="25000"
                className={cn(fieldClass, "w-full tabular-nums")}
              />
            </label>
            <label className="min-w-[8rem] flex-[1.2] space-y-0.5">
              <span className="text-[11px] text-muted-foreground">備註</span>
              <input
                id="expense-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="可留空"
                autoComplete="off"
                className={cn(fieldClass, "w-full")}
              />
            </label>
            <button
              type="submit"
              className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
            >
              加入
            </button>
          </div>
        </form>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-3 py-1.5 md:px-4">
        <h2 className="text-sm font-semibold">
          {year}年{month}月支出明細
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <PickBar
            count={picked.size}
            onDelete={deletePickedExpenses}
            onClear={() => setPicked(new Set())}
            deleteLabel="刪除已勾選"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        {monthLines.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            這個月還沒有支出。上面填項目與金額後加入。
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 w-8">
                  <HeaderCheck
                    ids={visibleExpenseIds}
                    selected={picked}
                    onToggle={() =>
                      setPicked((current) =>
                        toggleAll(current, visibleExpenseIds),
                      )
                    }
                    label="全選支出"
                  />
                </TableHead>
                <TableHead className="h-8">年月日</TableHead>
                <TableHead className="h-8">時間</TableHead>
                <TableHead className="h-8">單號</TableHead>
                <TableHead className="h-8">項目</TableHead>
                <TableHead className="h-8 text-right">金額</TableHead>
                <TableHead className="h-8">備註</TableHead>
                <TableHead className="h-8 w-14 text-right">刪除</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthLines.map((item) => {
                const ymd = ymdParts(item.createdAt);
                const sameDay =
                  ymd.year === year &&
                  ymd.month === month &&
                  ymd.day === date;
                return (
                  <TableRow
                    key={item.id}
                    className={cn(sameDay && "bg-amber-50/70 dark:bg-amber-950/20")}
                  >
                    <TableCell className="w-8 py-1.5">
                      <input
                        type="checkbox"
                        className="size-3.5 align-middle"
                        checked={picked.has(item.id)}
                        onChange={() =>
                          setPicked((current) => toggleId(current, item.id))
                        }
                        aria-label={`勾選 ${item.title}`}
                      />
                    </TableCell>
                    <TableCell className="py-1.5 text-base tabular-nums">
                      {ymd.year}/{ymd.month}/{ymd.day}
                    </TableCell>
                    <TableCell className="py-1.5 text-sm text-muted-foreground">
                      {formatTime(item.createdAt)}
                    </TableCell>
                    <TableCell className="py-1.5 text-sm text-muted-foreground">
                      {item.number}
                    </TableCell>
                    <TableCell className="py-1.5 text-base font-medium">
                      {item.title}
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-base font-semibold tabular-nums">
                      {twd(item.amount)}
                    </TableCell>
                    <TableCell className="max-w-[18rem] py-1.5 whitespace-normal text-sm">
                      {item.note || "—"}
                    </TableCell>
                    <TableCell className="py-1.5 text-right">
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
                <TableCell colSpan={5} className="py-2 font-semibold">
                  {year}年{month}月合計
                </TableCell>
                <TableCell className="py-2 text-right text-base font-semibold tabular-nums">
                  {twd(monthTotal)}
                </TableCell>
                <TableCell />
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </div>
    </div>
  );
}
