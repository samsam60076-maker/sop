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
      toast.error("認不出商品。請確認有「到貨商品、單價、數量」");
    }
  }

  const known = (rows ?? []).filter((row) => row.productId);
  const missing = (rows ?? []).filter((row) => !row.productId);

  return (
    <div className="border-b bg-amber-50 px-3 py-2">
      <p className="text-sm font-semibold">貼上給客人的取貨訊息</p>
      <p className="text-xs text-muted-foreground">
        複製你傳出去的文字，貼在下面，按「幫我拆開」。會分開每一項商品。
      </p>
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setRows(null);
        }}
        rows={5}
        className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        placeholder={"到貨商品：糙米腸\n單價：80\n數量：+1"}
      />
      <div className="mt-1.5 flex flex-wrap gap-2">
        <button
          type="button"
          className="h-8 rounded-md bg-primary px-3 text-sm text-primary-foreground"
          onClick={split}
        >
          幫我拆開
        </button>
        {known.length > 0 ? (
          <button
            type="button"
            className="h-8 rounded-md border px-3 text-sm"
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
      {rows && rows.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm">
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
      {missing.length > 0 ? (
        <p className="mt-1 text-xs text-destructive">
          有 {missing.length} 項對不到總商品，不會加入收銀。
        </p>
      ) : null}
    </div>
  );
}
