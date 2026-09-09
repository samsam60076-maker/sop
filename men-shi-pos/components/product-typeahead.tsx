"use client";

import { useMemo, useState, type Ref } from "react";
import { Input } from "@/components/ui/input";
import { twd } from "@/lib/format";
import { matchProducts, parseTypedEntry } from "@/lib/lookup";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type ProductTypeaheadProps = {
  id?: string;
  products: Product[];
  value: string;
  onChange: (value: string) => void;
  onPick: (product: Product, qty: number | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  activeOnly?: boolean;
  /** 收銀用：下拉只顯示名稱與售價，方便快速找商品 */
  pricesOnly?: boolean;
  showCost?: boolean;
  compact?: boolean;
  className?: string;
  inputRef?: Ref<HTMLInputElement>;
};

export function ProductTypeahead({
  id,
  products,
  value,
  onChange,
  onPick,
  placeholder = "打商品名稱，例如 茶葉蛋",
  autoFocus,
  activeOnly,
  pricesOnly,
  showCost,
  compact,
  className,
  inputRef,
}: ProductTypeaheadProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const { query } = parseTypedEntry(value);
  const matches = useMemo(
    () =>
      matchProducts(products, query, {
        activeOnly,
        emptyAll: !pricesOnly,
      }).slice(0, pricesOnly ? 12 : 8),
    [products, query, activeOnly, pricesOnly],
  );

  function pick(product: Product) {
    const { qty } = parseTypedEntry(value);
    onChange(product.name);
    onPick(product, qty);
    setOpen(false);
    setHighlight(0);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((index) =>
        Math.min(index + 1, Math.max(matches.length - 1, 0)),
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const product = matches[highlight] ?? matches[0];
      if (product) pick(product);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        ref={inputRef}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        placeholder={placeholder}
        className={pricesOnly || compact ? "h-9 text-sm" : "h-14"}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          if (value.trim()) setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {query ? `找不到「${query}」` : "還沒有商品"}
            </li>
          ) : (
            matches.map((product, index) => (
              <li key={product.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm",
                    index === highlight ? "bg-muted" : "hover:bg-muted/60",
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(product)}
                >
                  <span className="min-w-0 truncate font-medium">
                    {product.name}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">
                    {pricesOnly ? (
                      twd(showCost ? product.cost : product.price)
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        售價 {twd(product.price)} · 批價 {twd(product.cost)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
