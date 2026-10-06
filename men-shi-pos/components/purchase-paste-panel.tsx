"use client";

import { useState } from "react";
import { toast } from "sonner";
import { parsePurchasePaste, type NoticeItem } from "@/lib/notice-parse";
import { twd } from "@/lib/format";
import type { Product } from "@/lib/types";

export function PurchasePastePanel({
  products,
  onAdd,
}: {
  products: Product[];
  onAdd: (items: NoticeItem[]) => void;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<NoticeItem[] | null>(null);

  function split(nextText = text) {
    const next = parsePurchasePaste(nextText, products);
    setRows(next);
    if (next.length === 0) {
      toast.error("認不出商品。可貼 香煎雞腿排20包，一行一項");
    }
  }

  const known = (rows ?? []).filter((row) => row.productId);
  const missing = (rows ?? []).filter((row) => !row.productId);

  return (
    <div className="mt-1.5 rounded-md border bg-amber-50 px-2 py-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-xs font-semibold">貼上進貨文字</p>
        <button
          type="button"
          className="h-6 rounded bg-primary px-2 text-xs text-primary-foreground"
          onClick={() => split()}
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
              toast.success(`已加入 ${known.length} 項，可改數量批價再確認入庫`);
            }}
          >
            加入本次進貨（{known.length} 項）
          </button>
        ) : null}
      </div>
      <textarea
        value={text}
        onChange={(event) => {
          const value = event.target.value;
          setText(value);
          const next = parsePurchasePaste(value, products);
          setRows(next.length > 0 ? next : null);
        }}
        rows={2}
        className="mt-1 w-full resize-y rounded border bg-background px-1.5 py-1 text-xs leading-snug"
        placeholder={"香煎雞腿排20包\n國王白蝦14盒\n魷魚翅10包"}
      />
      {rows && rows.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-xs">
          {rows.map((row, index) => (
            <li
              key={`${row.name}-${index}`}
              className="flex flex-wrap items-baseline gap-x-2"
            >
              <span className="font-medium">{row.matchedName ?? row.name}</span>
              <span>×{row.qty}</span>
              <span className="tabular-nums">
                批價 {twd(row.unitPrice)}
              </span>
              {row.productId ? (
                <span className="text-muted-foreground">已對到總商品</span>
              ) : (
                <span className="text-destructive">總商品沒有這項</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {missing.length > 0 ? (
        <p className="mt-1 text-xs text-destructive">
          有 {missing.length} 項對不到總商品，不會加入。
        </p>
      ) : null}
    </div>
  );
}
