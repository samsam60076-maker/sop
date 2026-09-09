import type { AppState, Product } from "@/lib/types";

export type ReportPeriod = "day" | "month" | "all";

export type StockReportRow = {
  product: Product;
  inQty: number;
  inAmount: number;
  saleQty: number;
  returnQty: number;
  takeQty: number;
  outQty: number;
  outAmount: number;
  outCost: number;
  profit: number;
  stock: number;
  stockValue: number;
};

export type SaleDetailLine = {
  saleId: string;
  number: string;
  createdAt: string;
  note: string;
  saleNote: string;
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  listPrice: number | null;
  unitCost: number;
  amount: number;
  costAmount: number;
};

export type SaleTicket = {
  saleId: string;
  number: string;
  createdAt: string;
  note: string;
  lines: SaleDetailLine[];
  qty: number;
  amount: number;
  costAmount: number;
};

export type PurchaseDetailLine = {
  purchaseId: string;
  number: string;
  createdAt: string;
  note: string;
  productId: string;
  name: string;
  qty: number;
  unitCost: number;
  unitPrice: number;
  amount: number;
  retailAmount: number;
};

function parseInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

export function periodBounds(period: ReportPeriod, day: string) {
  if (period === "all") return { from: null as Date | null, to: null as Date | null };
  const selected = parseInputDate(day);
  if (period === "month") {
    const from = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const to = new Date(selected.getFullYear(), selected.getMonth() + 1, 1);
    return { from, to };
  }
  const from = new Date(
    selected.getFullYear(),
    selected.getMonth(),
    selected.getDate(),
  );
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

function inPeriod(iso: string, from: Date | null, to: Date | null) {
  const time = new Date(iso);
  if (from && time < from) return false;
  if (to && time >= to) return false;
  return true;
}

export function stockChangeNote(row: StockReportRow) {
  const parts: string[] = [];
  if (row.saleQty) parts.push(`銷貨 ${row.saleQty}`);
  if (row.returnQty) parts.push(`退貨 ${row.returnQty}`);
  if (row.takeQty < 0) parts.push(`盤點少 ${-row.takeQty}`);
  if (row.takeQty > 0) parts.push(`盤點多 ${row.takeQty}`);
  if (row.inQty) parts.push(`進貨 ${row.inQty}`);
  return parts.join(" · ") || "—";
}

export function buildStockReport(
  state: AppState,
  period: ReportPeriod,
  day: string,
): StockReportRow[] {
  const { from, to } = periodBounds(period, day);
  const inbound = new Map<string, { qty: number; amount: number }>();
  const sold = new Map<
    string,
    { qty: number; amount: number; cost: number; profit: number; name: string; sku: string }
  >();
  const returned = new Map<string, number>();
  const counted = new Map<string, number>();
  const names = new Map<string, { name: string; sku: string }>();

  for (const purchase of state.purchases) {
    if (!inPeriod(purchase.createdAt, from, to)) continue;
    for (const item of purchase.items) {
      const current = inbound.get(item.productId) ?? { qty: 0, amount: 0 };
      inbound.set(item.productId, {
        qty: current.qty + item.qty,
        amount: current.amount + item.qty * item.unitCost,
      });
      names.set(item.productId, { name: item.name, sku: item.sku });
    }
  }

  for (const sale of state.sales) {
    if (sale.status !== "completed" || !inPeriod(sale.createdAt, from, to)) {
      continue;
    }
    for (const item of sale.items) {
      const current = sold.get(item.productId) ?? {
        qty: 0,
        amount: 0,
        cost: 0,
        profit: 0,
        name: item.name,
        sku: item.sku,
      };
      sold.set(item.productId, {
        qty: current.qty + item.qty,
        amount: current.amount + item.qty * item.unitPrice,
        cost: current.cost + item.qty * item.unitCost,
        profit: current.profit + (item.unitPrice - item.unitCost) * item.qty,
        name: item.name,
        sku: item.sku,
      });
      names.set(item.productId, { name: item.name, sku: item.sku });
    }
  }

  for (const refund of state.saleReturns ?? []) {
    if (!inPeriod(refund.createdAt, from, to)) continue;
    for (const item of refund.items) {
      if (!item.productId) continue;
      returned.set(item.productId, (returned.get(item.productId) ?? 0) + item.qty);
      names.set(item.productId, { name: item.name, sku: item.sku });
    }
  }

  for (const sheet of state.stocktakes ?? []) {
    if (sheet.status !== "confirmed") continue;
    const when = sheet.countedAt || sheet.createdAt;
    if (!inPeriod(when, from, to)) continue;
    for (const line of sheet.lines) {
      if (line.countedQty == null) continue;
      const delta = line.countedQty - line.bookQty;
      if (delta === 0) continue;
      counted.set(line.productId, (counted.get(line.productId) ?? 0) + delta);
      names.set(line.productId, { name: line.name, sku: line.sku });
    }
  }

  const ids = new Set([
    ...state.products.map((product) => product.id),
    ...inbound.keys(),
    ...sold.keys(),
    ...returned.keys(),
    ...counted.keys(),
  ]);

  return [...ids]
    .map((id) => {
      const product =
        state.products.find((row) => row.id === id) ??
        ({
          id,
          sku: names.get(id)?.sku ?? "",
          name: names.get(id)?.name ?? "已刪商品",
          category: "",
          unit: "個",
          cost: 0,
          price: 0,
          stock: 0,
          minStock: 0,
          active: false,
        } satisfies Product);
      const inn = inbound.get(id) ?? { qty: 0, amount: 0 };
      const out = sold.get(id) ?? {
        qty: 0,
        amount: 0,
        cost: 0,
        profit: 0,
        name: product.name,
        sku: product.sku,
      };
      const returnQty = returned.get(id) ?? 0;
      const takeQty = counted.get(id) ?? 0;
      const saleQty = out.qty;
      return {
        product,
        inQty: inn.qty,
        inAmount: inn.amount,
        saleQty,
        returnQty,
        takeQty,
        outQty: saleQty - returnQty,
        outAmount: out.amount,
        outCost: out.cost,
        profit: out.profit,
        stock: product.stock,
        stockValue: product.stock * product.cost,
      };
    })
    .sort((a, b) => {
      if (a.saleQty !== b.saleQty) return b.saleQty - a.saleQty;
      if (a.takeQty !== b.takeQty) return Math.abs(b.takeQty) - Math.abs(a.takeQty);
      return a.product.name.localeCompare(b.product.name, "zh-Hant");
    });
}

export function buildSaleDetails(
  state: AppState,
  period: ReportPeriod,
  day: string,
): SaleDetailLine[] {
  const { from, to } = periodBounds(period, day);
  const lines: SaleDetailLine[] = [];
  for (const sale of state.sales) {
    if (sale.status !== "completed" || !inPeriod(sale.createdAt, from, to)) {
      continue;
    }
    for (const item of sale.items) {
      const product = state.products.find((row) => row.id === item.productId);
      lines.push({
        saleId: sale.id,
        number: sale.number,
        createdAt: sale.createdAt,
        note: item.note != null ? item.note : sale.note,
        saleNote: sale.note,
        productId: item.productId,
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        listPrice: product?.price ?? null,
        unitCost: item.unitCost,
        amount: item.qty * item.unitPrice,
        costAmount: item.qty * item.unitCost,
      });
    }
  }
  return lines.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function groupSaleTickets(lines: SaleDetailLine[]): SaleTicket[] {
  const order: string[] = [];
  const tickets = new Map<string, SaleTicket>();
  for (const line of lines) {
    let ticket = tickets.get(line.saleId);
    if (!ticket) {
      ticket = {
        saleId: line.saleId,
        number: line.number,
        createdAt: line.createdAt,
        note: line.saleNote || line.note,
        lines: [],
        qty: 0,
        amount: 0,
        costAmount: 0,
      };
      tickets.set(line.saleId, ticket);
      order.push(line.saleId);
    }
    ticket.lines.push(line);
    ticket.qty += line.qty;
    ticket.amount += line.amount;
    ticket.costAmount += line.costAmount;
  }
  return order.map((id) => tickets.get(id)!);
}

export function buildPurchaseDetails(
  state: AppState,
  period: ReportPeriod,
  day: string,
): PurchaseDetailLine[] {
  const { from, to } = periodBounds(period, day);
  const lines: PurchaseDetailLine[] = [];
  for (const purchase of state.purchases) {
    if (!inPeriod(purchase.createdAt, from, to)) continue;
    for (const item of purchase.items) {
      const product = state.products.find((row) => row.id === item.productId);
      const unitPrice =
        item.unitPrice != null && Number.isFinite(item.unitPrice)
          ? item.unitPrice
          : (product?.price ?? 0);
      lines.push({
        purchaseId: purchase.id,
        number: purchase.number,
        createdAt: purchase.createdAt,
        note: purchase.note,
        productId: item.productId,
        name: item.name,
        qty: item.qty,
        unitCost: item.unitCost,
        unitPrice,
        amount: item.qty * item.unitCost,
        retailAmount: item.qty * unitPrice,
      });
    }
  }
  return lines.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function reportTotals(rows: StockReportRow[]) {
  return rows.reduce(
    (sum, row) => ({
      inQty: sum.inQty + row.inQty,
      inAmount: sum.inAmount + row.inAmount,
      saleQty: sum.saleQty + row.saleQty,
      returnQty: sum.returnQty + row.returnQty,
      takeQty: sum.takeQty + row.takeQty,
      outQty: sum.outQty + row.outQty,
      outAmount: sum.outAmount + row.outAmount,
      outCost: sum.outCost + row.outCost,
      profit: sum.profit + row.profit,
      stock: sum.stock + row.stock,
      stockValue: sum.stockValue + row.stockValue,
    }),
    {
      inQty: 0,
      inAmount: 0,
      saleQty: 0,
      returnQty: 0,
      takeQty: 0,
      outQty: 0,
      outAmount: 0,
      outCost: 0,
      profit: 0,
      stock: 0,
      stockValue: 0,
    },
  );
}

export function saleDetailTotals(lines: SaleDetailLine[]) {
  return lines.reduce(
    (sum, line) => ({
      qty: sum.qty + line.qty,
      amount: sum.amount + line.amount,
      costAmount: sum.costAmount + line.costAmount,
    }),
    { qty: 0, amount: 0, costAmount: 0 },
  );
}

export type ReturnDetailLine = {
  returnId: string;
  number: string;
  saleNumber: string;
  createdAt: string;
  note: string;
  restock: boolean;
  name: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  amount: number;
  costAmount: number;
};

export function buildReturnDetails(
  state: AppState,
  period: ReportPeriod,
  day: string,
): ReturnDetailLine[] {
  const { from, to } = periodBounds(period, day);
  const lines: ReturnDetailLine[] = [];
  for (const refund of state.saleReturns ?? []) {
    if (!inPeriod(refund.createdAt, from, to)) continue;
    for (const item of refund.items) {
      lines.push({
        returnId: refund.id,
        number: refund.number,
        saleNumber: refund.saleNumber,
        createdAt: refund.createdAt,
        note: refund.note,
        restock: refund.restock,
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        amount: item.qty * item.unitPrice,
        costAmount: item.qty * item.unitCost,
      });
    }
  }
  return lines.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function returnDetailTotals(lines: ReturnDetailLine[]) {
  return lines.reduce(
    (sum, line) => ({
      qty: sum.qty + line.qty,
      amount: sum.amount + line.amount,
      costAmount: sum.costAmount + line.costAmount,
    }),
    { qty: 0, amount: 0, costAmount: 0 },
  );
}

export function buildExpenseDetails(
  state: AppState,
  period: ReportPeriod,
  day: string,
) {
  const { from, to } = periodBounds(period, day);
  return (state.expenses ?? [])
    .filter((item) => inPeriod(item.createdAt, from, to))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export function expenseTotals(lines: { amount: number }[]) {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

export function purchaseDetailTotals(lines: PurchaseDetailLine[]) {
  return lines.reduce(
    (sum, line) => ({
      qty: sum.qty + line.qty,
      amount: sum.amount + line.amount,
      retailAmount: sum.retailAmount + line.retailAmount,
    }),
    { qty: 0, amount: 0, retailAmount: 0 },
  );
}

export function grossMargin(revenue: number, cost: number) {
  if (revenue <= 0) return null;
  return (revenue - cost) / revenue;
}

export function marginLabel(rate: number | null) {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}
