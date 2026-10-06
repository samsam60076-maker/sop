"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { parsePurchasePaste, type NoticeItem } from "@/lib/notice-parse";
import { twd } from "@/lib/format";
import type { Product } from "@/lib/types";

function dropAddedLines(
  raw: string,
  addedIds: Set<string>,
  products: Product[],
) {
  return raw
    .split(/\r?\n/)
    .filter((line) => {
      if (!line.trim()) return false;
      const parsed = parsePurchasePaste(line, products);
      const id = parsed[0]?.productId;
      if (id && addedIds.has(id)) return false;
      return true;
    })
    .join("\n");
}

export function PurchasePastePanel({
  products,
  inCartIds = [],
  onAdd,
}: {
  products: Product[];
  inCartIds?: string[];
  onAdd: (items: NoticeItem[]) => void;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<NoticeItem[] | null>(null);
  const [find, setFind] = useState("");
  const inCart = useMemo(() => new Set(inCartIds), [inCartIds]);

  function applyText(value: string) {
    setText(value);
    const next = parsePurchasePaste(value, products);
    setRows(next.length > 0 ? next : null);
  }

  function split(nextText = text) {
    const next = parsePurchasePaste(nextText, products);
    setRows(next);
    if (next.length === 0) {
      toast.error("認不出商品。可貼 香煎雞腿排20包，一行一項");
    }
  }

  function addItems(items: NoticeItem[]) {
    const known = items.filter((row) => row.productId);
    if (known.length === 0) return;
    onAdd(known);
    const ids = new Set(known.map((row) => row.productId as string));
    applyText(dropAddedLines(text, ids, products));
    toast.success(`已加入 ${known.length} 項，可改數量批價再確認入庫`);
  }

  const known = (rows ?? []).filter((row) => row.productId);
  const missing = (rows ?? []).filter((row) => !row.productId);
  const pending = known.filter((row) => !inCart.has(row.productId as string));
  const q = find.trim().toLowerCase();
  const shown = (rows ?? []).filter((row) => {
    if (!q) return true;
    return (
      row.name.toLowerCase().includes(q) ||
      (row.matchedName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="mt-1.5 rounded-md border bg-amber-50 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-[11px] font-semibold">貼上進貨文字</p>
        <button
          type="button"
          className="h-6 rounded bg-primary px-2 text-[11px] text-primary-foreground"
          onClick={() => split()}
        >
          幫我拆開
        </button>
        {pending.length > 0 ? (
          <button
            type="button"
            className="h-6 rounded border bg-background px-2 text-[11px]"
            onClick={() => addItems(pending)}
          >
            加入本次進貨（{pending.length} 項）
          </button>
        ) : null}
        {rows && rows.length > 0 ? (
          <span className="text-[11px] text-muted-foreground">
            明細 {rows.length} 項
            {missing.length > 0 ? ` · ${missing.length} 項對不到` : ""}
          </span>
        ) : null}
      </div>
      <div className="mt-1 grid gap-1 sm:grid-cols-2">
        <textarea
          value={text}
          onChange={(event) => applyText(event.target.value)}
          rows={3}
          className="max-h-24 min-h-16 w-full resize-y rounded border bg-background px-1.5 py-1 text-[11px] leading-snug"
          placeholder={"香煎雞腿排20包\n國王白蝦14盒\n魷魚翅10包"}
        />
        <div className="flex max-h-24 min-h-16 flex-col rounded border bg-background">
          <div className="flex items-center gap-1 border-b px-1.5 py-1">
            <p className="shrink-0 text-[11px] font-semibold">今天到貨明細</p>
            <input
              value={find}
              onChange={(event) => setFind(event.target.value)}
              placeholder="找商品"
              className="h-5 min-w-0 flex-1 rounded border bg-card px-1 text-[11px]"
            />
          </div>
          {!rows || rows.length === 0 ? (
            <p className="px-1.5 py-2 text-[11px] text-muted-foreground">
              貼左邊文字後，這裡列出名稱與數量，方便對貨。
            </p>
          ) : shown.length === 0 ? (
            <p className="px-1.5 py-2 text-[11px] text-muted-foreground">
              明細裡沒有「{find.trim()}」
            </p>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto px-1 py-0.5">
              {shown.map((row, index) => {
                const added = Boolean(
                  row.productId && inCart.has(row.productId),
                );
                return (
                  <li
                    key={`${row.productId ?? row.name}-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_2.25rem_auto] items-center gap-x-1 border-b border-dashed py-px text-[11px] last:border-b-0"
                  >
                    <span className="truncate font-medium">
                      {row.matchedName ?? row.name}
                    </span>
                    <span className="text-right tabular-nums">{row.qty}</span>
                    {row.productId ? (
                      added ? (
                        <span className="text-muted-foreground">已加入</span>
                      ) : (
                        <button
                          type="button"
                          className="h-5 rounded bg-primary px-1.5 text-[10px] text-primary-foreground"
                          onClick={() => addItems([row])}
                        >
                          加入
                        </button>
                      )
                    ) : (
                      <span className="text-destructive">沒有</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {rows && rows.some((row) => row.unitPrice > 0) ? (
            <p className="border-t px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              有單價的會帶入批價 {twd(rows.reduce((sum, row) => sum + row.unitPrice * row.qty, 0))}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
