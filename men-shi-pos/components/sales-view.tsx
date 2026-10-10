"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
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
import { SaleNoteField } from "@/components/sale-note-field";
import { ProductTypeahead } from "@/components/product-typeahead";
import { YmdPicker } from "@/components/ymd-picker";
import { formatDateTime, inputDateToIso, toInputDate, twd } from "@/lib/format";
import { lineAmount } from "@/lib/pricing";
import { parseTypedEntry, resolveProduct } from "@/lib/lookup";
import { saleOriginOf } from "@/lib/report";
import { useStore } from "@/lib/store";
import type { CartLine, Product, Sale } from "@/lib/types";

export function SalesView() {
  const { state, checkout, removeSale, removeSales } = useStore();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Sale | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [entryQuery, setEntryQuery] = useState("");
  const [entryQty, setEntryQty] = useState("1");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<CartLine[]>([]);
  const [saleDate, setSaleDate] = useState(toInputDate);

  const rows = state.sales.filter((sale) => {
    if (sale.status !== "completed") return false;
    if (saleOriginOf(sale) !== "writeoff") return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      sale.number.toLowerCase().includes(q) ||
      sale.note.toLowerCase().includes(q) ||
      sale.items.some((item) => item.name.toLowerCase().includes(q))
    );
  });
  const visibleSaleIds = rows.map((sale) => sale.id);

  const draftLines = useMemo(
    () =>
      draft
        .map((line) => {
          const product = state.products.find((item) => item.id === line.productId);
          if (!product) return null;
          return { ...line, product, amount: (line.unitPrice ?? product.price) * line.qty };
        })
        .filter((line): line is NonNullable<typeof line> => Boolean(line)),
    [draft, state.products],
  );
  const draftTotal = draftLines.reduce((sum, line) => sum + line.amount, 0);

  function addSaleLine(product: Product, parsedQty: number | null) {
    const qty = parsedQty ?? (Number(entryQty) || 1);
    if (product.stock < qty) {
      toast.error(`${product.name} 庫存不足（現有 ${product.stock}）`);
      return;
    }
    setDraft((current) => {
      const existing = current.find(
        (line) =>
          line.productId === product.id && line.unitPrice === product.price,
      );
      if (!existing) {
        return [
          ...current,
          {
            id: crypto.randomUUID(),
            productId: product.id,
            qty,
            unitPrice: product.price,
          },
        ];
      }
      return current.map((line) =>
        line.id === existing.id ? { ...line, qty: line.qty + qty } : line,
      );
    });
    setEntryQuery("");
    setEntryQty("1");
    toast.success(`已加入 ${product.name} × ${qty}`);
  }

  function submitTypedSale(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseTypedEntry(entryQuery);
    const product = resolveProduct(state.products, parsed.query, {
      activeOnly: true,
    });
    if (!product) {
      toast.error("找不到商品，請打編號或名稱");
      return;
    }
    addSaleLine(product, parsed.qty);
  }

  function confirmTypedSale() {
    const reason = note.trim();
    if (!reason) {
      toast.error("請填備註，寫這筆銷貨的原因");
      return;
    }
    const result = checkout({
      items: draft,
      paymentMethod: "cash",
      received: draftTotal,
      note: reason,
      createdAt: inputDateToIso(saleDate),
      origin: "writeoff",
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDraft([]);
    setNote("");
    toast.success(`已報廢扣庫存 ${result.data.number}`);
  }

  function deleteSaleRecord(saleId: string, number: string) {
    if (
      !window.confirm(
        `確定刪除銷貨 ${number}？這張報廢單會從銷貨、總表拿掉，庫存加回，可再重打。`,
      )
    ) {
      return;
    }
    const result = removeSale(saleId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPicked((current) => dropIds(current, [saleId]));
    if (selected?.id === saleId) setSelected(null);
    toast.success(`已刪除 ${number}`);
  }

  function deletePickedSales() {
    const ids = [...picked];
    if (ids.length === 0) {
      toast.error("請先勾選要刪的銷貨");
      return;
    }
    if (
      !window.confirm(
        `確定刪除已勾選的 ${ids.length} 張報廢銷貨？總表會一起拿掉，庫存加回。`,
      )
    ) {
      return;
    }
    const result = removeSales(ids);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPicked(new Set());
    if (selected && ids.includes(selected.id)) setSelected(null);
    toast.success(`已刪除 ${result.data.count} 張銷貨`);
  }

  function openSale(sale: Sale) {
    setSelected(sale);
  }

  return (
    <div className="flex flex-col">
      <div className="border-b bg-card px-4 py-3 md:px-6">
        <h1 className="font-heading text-xl font-semibold">銷貨</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          只記壞掉、過期、報廢，確認後扣庫存。收銀結帳不會出現在這裡。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">年月日</span>
          <YmdPicker compact value={saleDate} onChange={setSaleDate} />
        </div>
        <form
          onSubmit={submitTypedSale}
          className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_90px_auto]"
        >
          <ProductTypeahead
            products={state.products}
            value={entryQuery}
            onChange={setEntryQuery}
            onPick={addSaleLine}
            autoFocus
            activeOnly
            placeholder="打 FD001 或 茶葉蛋*2"
          />
          <Input
            type="number"
            min={1}
            value={entryQty}
            onChange={(event) => setEntryQty(event.target.value)}
            placeholder="數量"
            aria-label="數量"
            className="h-10"
          />
          <Button type="submit" className="h-10">
            加入
          </Button>
        </form>
        {draftLines.length > 0 && (
          <div className="mt-3 rounded-xl border bg-muted/40 p-3">
            <ul className="space-y-2">
              {draftLines.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {line.product.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {line.product.sku}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={line.qty}
                      onChange={(event) =>
                        setDraft((current) =>
                          current.map((item) =>
                            item.id === line.id
                              ? {
                                  ...item,
                                  qty: Number(event.target.value) || 1,
                                }
                              : item,
                          ),
                        )
                      }
                      className="h-8 w-16 text-center"
                    />
                    <span className="w-20 text-right tabular-nums">
                      {twd(line.amount)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setDraft((current) =>
                          current.filter((item) => item.id !== line.id),
                        )
                      }
                      aria-label={`移除 ${line.product.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between">
              <p className="font-semibold tabular-nums">{twd(draftTotal)}</p>
              <Button onClick={confirmTypedSale}>確認報廢扣庫存</Button>
            </div>
            <div className="mt-3">
              <SaleNoteField required value={note} onChange={setNote} />
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Input
            className="sm:max-w-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋單號、商品或備註"
          />
          <PickBar
            count={picked.size}
            onDelete={deletePickedSales}
            onClear={() => setPicked(new Set())}
            deleteLabel="刪除已勾選"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            還沒有報廢銷貨。收銀結帳不會出現在這裡。
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <HeaderCheck
                    ids={visibleSaleIds}
                    selected={picked}
                    onToggle={() =>
                      setPicked((current) => toggleAll(current, visibleSaleIds))
                    }
                    label="全選銷貨"
                  />
                </TableHead>
                <TableHead>單號</TableHead>
                <TableHead>時間</TableHead>
                <TableHead>原因</TableHead>
                <TableHead>商品</TableHead>
                <TableHead className="text-right">數量</TableHead>
                <TableHead className="text-right">金額</TableHead>
                <TableHead className="w-12 text-right">刪除</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((sale) => (
                <TableRow
                  key={sale.id}
                  className="cursor-pointer"
                  onClick={() => openSale(sale)}
                >
                  <TableCell
                    className="w-8"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 align-middle"
                      checked={picked.has(sale.id)}
                      onChange={() =>
                        setPicked((current) => toggleId(current, sale.id))
                      }
                      aria-label={`勾選 ${sale.number}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{sale.number}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(sale.createdAt)}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate">
                    {sale.note || "—"}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate">
                    {sale.items.map((item) => item.name).join("、") || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {sale.items.reduce((sum, item) => sum + item.qty, 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {twd(sale.total)}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="text-xs text-destructive underline"
                      onClick={() => deleteSaleRecord(sale.id, sale.number)}
                    >
                      刪除
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.number}</DialogTitle>
                <DialogDescription>
                  {formatDateTime(selected.createdAt)} · 報廢扣庫存
                </DialogDescription>
              </DialogHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>商品</TableHead>
                    <TableHead className="text-right">數量</TableHead>
                    <TableHead className="text-right">售價</TableHead>
                    <TableHead className="text-right">小計</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.items.map((item, index) => (
                    <TableRow key={`${item.productId}-${index}`}>
                      <TableCell>
                        <div>{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.sku}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.qty}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {twd(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {twd(lineAmount(item))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between text-sm">
                <span>合計</span>
                <span className="font-semibold tabular-nums">
                  {twd(selected.total)}
                </span>
              </div>
              {selected.note ? (
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  備註／原因：{selected.note}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">沒有備註</p>
              )}
              <DialogFooter>
                {selected.status === "completed" ? (
                  <Button
                    variant="destructive"
                    onClick={() =>
                      deleteSaleRecord(selected.id, selected.number)
                    }
                  >
                    刪除這張單
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => setSelected(null)}>
                  關閉
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
