"use client";

import { useEffect, useMemo, useState } from "react";
import { twd } from "@/lib/format";

export type DayPaperLine = {
  id: string;
  time: string;
  label: string;
  hint?: string;
  qty?: number;
  amount: number;
  pending?: boolean;
  refund?: boolean;
  onOpen?: () => void;
  onDelete?: () => void;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatInputDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return `${year}年${month}月${date}日`;
}

export function openDayPaperPreview(opts: {
  shopName: string;
  kind: string;
  day: string;
  lines: DayPaperLine[];
  showQty: boolean;
}) {
  const dayLabel = formatInputDay(opts.day);
  const qtyTotal = opts.lines.reduce((sum, line) => sum + (line.qty ?? 0), 0);
  const amountTotal = opts.lines.reduce(
    (sum, line) => sum + (line.refund ? -Math.abs(line.amount) : line.amount),
    0,
  );
  const rows = opts.lines
    .map((line) => {
      const amount = line.refund ? -Math.abs(line.amount) : line.amount;
      return `<tr>
        <td>${escapeHtml(line.time || "—")}</td>
        <td>${escapeHtml(line.label)}${line.hint ? ` <span class="hint">${escapeHtml(line.hint)}</span>` : ""}${line.pending ? " <span class=\"hint\">未入帳</span>" : ""}</td>
        ${opts.showQty ? `<td class="num">${line.qty ?? ""}</td>` : ""}
        <td class="num">${escapeHtml(twd(amount))}</td>
      </tr>`;
    })
    .join("");
  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(opts.shopName)} ${escapeHtml(dayLabel)} ${escapeHtml(opts.kind)}核對</title>
  <style>
    body { font: 13px/1.35 "Microsoft JhengHei", sans-serif; color: #111; margin: 16px; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .meta { color: #444; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #ccc; padding: 4px 6px; text-align: left; }
    th { font-size: 12px; color: #333; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .hint { color: #666; font-size: 11px; }
    tfoot td { font-weight: 700; border-top: 2px solid #111; border-bottom: 0; }
    @media print { body { margin: 8px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(opts.shopName)} · ${escapeHtml(opts.kind)}當日核對</h1>
  <p class="meta">${escapeHtml(dayLabel)} · 對紙本用 · ${opts.lines.length} 筆</p>
  <table>
    <thead>
      <tr>
        <th>時間</th>
        <th>項目</th>
        ${opts.showQty ? "<th class=\"num\">數量</th>" : ""}
        <th class="num">金額</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="${opts.showQty ? 4 : 3}">這天還沒打進資料</td></tr>`}</tbody>
    <tfoot>
      <tr>
        <td colspan="${opts.showQty ? 2 : 1}">合計</td>
        ${opts.showQty ? `<td class="num">${qtyTotal || ""}</td>` : ""}
        <td class="num">${escapeHtml(twd(amountTotal))}</td>
      </tr>
    </tfoot>
  </table>
</body>
</html>`;
  const popup = window.open("", "_blank", "width=720,height=900");
  if (!popup) {
    window.alert("瀏覽器擋住預覽視窗。請允許這個網站的彈出視窗後再按一次。");
    return;
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
}

export function DayPaperCheck({
  kind,
  shopName,
  day,
  lines,
  defaultOpen = false,
}: {
  kind: string;
  shopName: string;
  day: string;
  lines: DayPaperLine[];
  defaultOpen?: boolean;
}) {
  const storageKey = `corner-pos-day-paper-${kind}`;
  const [open, setOpen] = useState(defaultOpen);
  const [find, setFind] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === "open") setOpen(true);
      else if (raw === "hide") setOpen(false);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  function setHidden(nextOpen: boolean) {
    setOpen(nextOpen);
    try {
      window.localStorage.setItem(storageKey, nextOpen ? "open" : "hide");
    } catch {
      /* ignore */
    }
  }
  const showQty = lines.some((line) => line.qty != null);
  const shown = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter(
      (line) =>
        line.label.toLowerCase().includes(q) ||
        (line.hint ?? "").toLowerCase().includes(q) ||
        line.time.includes(q),
    );
  }, [find, lines]);
  const qtyTotal = shown.reduce((sum, line) => sum + (line.qty ?? 0), 0);
  const amountTotal = shown.reduce(
    (sum, line) => sum + (line.refund ? -Math.abs(line.amount) : line.amount),
    0,
  );
  const pendingCount = shown.filter((line) => line.pending).length;
  const summary = [
    `${shown.length} 筆`,
    showQty ? `${qtyTotal} 件` : "",
    pendingCount > 0 ? `${pendingCount} 筆未入帳` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1">
        <h2 className="text-[13px] font-semibold">當日{kind}核對</h2>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {formatInputDay(day)}
          {lines.length > 0 ? ` · ${summary}` : ""}
        </span>
        <span className="ml-auto text-[11px] font-semibold tabular-nums">
          {lines.length > 0 ? twd(amountTotal) : ""}
        </span>
        <button
          type="button"
          className="h-6 rounded border bg-background px-2 text-[11px]"
          onClick={() => setHidden(!open)}
        >
          {open ? "隱藏" : "打開"}
        </button>
        <button
          type="button"
          className="h-6 rounded border bg-background px-2 text-[11px]"
          onClick={() =>
            openDayPaperPreview({
              shopName,
              kind,
              day,
              lines: shown,
              showQty,
            })
          }
        >
          預覽核對
        </button>
      </div>
      {open ? (
        <>
          <div className="border-t px-2 py-1">
            <input
              value={find}
              onChange={(event) => setFind(event.target.value)}
              placeholder={`找${kind}／對紙本`}
              className="h-6 w-full rounded border bg-background px-1.5 text-[11px] sm:max-w-48"
            />
          </div>
          {lines.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-muted-foreground">
              這天還沒打進{kind}。打進去後會列在這裡，方便對紙本。
            </p>
          ) : shown.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-muted-foreground">
              找不到「{find.trim()}」
            </p>
          ) : (
            <ul className="max-h-48 overflow-y-auto border-t px-1 py-0.5">
              {shown.map((line) => {
                const amount = line.refund
                  ? -Math.abs(line.amount)
                  : line.amount;
                const row = (
                  <span className="grid min-w-0 flex-1 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-baseline gap-x-1 text-[11px] sm:grid-cols-[2.75rem_minmax(0,1fr)_2.25rem_auto]">
                    <span className="tabular-nums text-muted-foreground">
                      {line.time || "—"}
                    </span>
                    <span className="min-w-0 truncate">
                      {line.label}
                      {line.hint ? (
                        <span className="ml-1 text-muted-foreground">
                          {line.hint}
                        </span>
                      ) : null}
                      {line.pending ? (
                        <span className="ml-1 text-amber-800">未入帳</span>
                      ) : null}
                      {line.refund ? (
                        <span className="ml-1 text-destructive">退</span>
                      ) : null}
                    </span>
                    {showQty ? (
                      <span className="hidden text-right tabular-nums sm:block">
                        {line.qty ?? ""}
                      </span>
                    ) : (
                      <span className="hidden sm:block" />
                    )}
                    <span className="text-right font-medium tabular-nums">
                      {twd(amount)}
                    </span>
                  </span>
                );
                return (
                  <li
                    key={line.id}
                    className="flex items-center gap-1 border-b border-dashed last:border-b-0"
                  >
                    {line.onOpen ? (
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 px-1 py-0.5 text-left hover:bg-muted/60"
                        onClick={line.onOpen}
                      >
                        {row}
                      </button>
                    ) : (
                      <div className="flex min-w-0 flex-1 px-1 py-0.5">
                        {row}
                      </div>
                    )}
                    {line.onDelete ? (
                      <button
                        type="button"
                        className="shrink-0 px-1 text-[10px] text-destructive underline"
                        onClick={line.onDelete}
                      >
                        刪除
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}
