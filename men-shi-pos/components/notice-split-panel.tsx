"use client";

import { useState } from "react";
import { toast } from "sonner";
import { parseArrivalNotice, type NoticeItem } from "@/lib/notice-parse";
import { twd } from "@/lib/format";
import type { Product } from "@/lib/types";

export function NoticeSplitPanel({
  products,
  onAdd,
}: {
  products: Product[];
  onAdd: (items: NoticeItem[]) => void;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<NoticeItem[] | null>(null);

  function split() {
    const next = parseArrivalNotice(text, products);
    setRows(next);
    if (next.length === 0) {
      toast.error("認不出商品。請關掉網頁翻譯，再從 LINE 複製一次");
    }
  }

  const known = (rows ?? []).filter((row) => row.productId);
  const missing = (rows ?? []).filter((row) => !row.productId);

  return (
    <div className="border-b bg-amber-50 px-2 py-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-xs font-semibold">貼上取貨訊息</p>
        <button
          type="button"
          className="h-6 rounded bg-primary px-2 text-xs text-primary-foreground"
          onClick={split}
        >
          幫我拆開
        </button>
        {known.length > 0 ? (
          <button
            type="button"
            className="h-6 rounded border bg-background px-2 text-xs"
            onClick={() => {
              onAdd(known);
              setText("");
              setRows(null);
            }}
          >
            加入收銀（{known.length} 項）
          </button>
        ) : null}
      </div>
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setRows(null);
        }}
        rows={2}
        className="mt-1 w-full resize-y rounded border bg-background px-1.5 py-1 text-xs leading-snug"
        placeholder={"到貨商品：糙米腸\n單價：80\n數量：+1"}
      />
      {rows && rows.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-xs">
          {rows.map((row, index) => (
            <li
              key={`${row.name}-${index}`}
              className="flex flex-wrap items-baseline gap-x-2"
            >
              <span className="font-medium">{row.matchedName ?? row.name}</span>
              <span className="tabular-nums">{twd(row.unitPrice)}</span>
              <span>×{row.qty}</span>
              {row.productId ? (
                <span className="text-xs text-muted-foreground">已對到總商品</span>
              ) : (
                <span className="text-xs text-destructive">
                  總商品沒有這項，請先建檔或改名稱
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {rows && rows.length === 0 ? (
        <p className="mt-1 text-xs text-destructive">
          系統實際讀到：{text.replace(/\s+/g, " ").slice(0, 80) || "（空白）"}
        </p>
      ) : null}
      {missing.length > 0 ? (
        <p className="mt-1 text-xs text-destructive">
          有 {missing.length} 項對不到總商品，不會加入收銀。
        </p>
      ) : null}
    </div>
  );
}
