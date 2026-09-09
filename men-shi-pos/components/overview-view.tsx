"use client";

import { useMemo } from "react";
import { AlertTriangle, TrendingDown, TrendingUp, Wallet, Warehouse } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { inventoryValue, lowStockProducts, profitOf } from "@/lib/engine";
import { formatTime, isSameDay, twd } from "@/lib/format";
import { useStore } from "@/lib/store";

export function OverviewView() {
  const { state } = useStore();

  const stats = useMemo(() => {
    const todaySales = state.sales.filter(
      (sale) => sale.status === "completed" && isSameDay(sale.createdAt),
    );
    const todayPurchases = state.purchases.filter((purchase) =>
      isSameDay(purchase.createdAt),
    );
    const revenue = todaySales.reduce((sum, sale) => sum + sale.total, 0);
    const profit = todaySales.reduce((sum, sale) => sum + profitOf(sale), 0);
    const inbound = todayPurchases.reduce(
      (sum, purchase) => sum + purchase.totalCost,
      0,
    );
    return {
      revenue,
      profit,
      tickets: todaySales.length,
      inbound,
      inboundCount: todayPurchases.length,
      stockValue: inventoryValue(state),
      low: lowStockProducts(state),
      todaySales,
      todayPurchases,
    };
  }, [state]);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold">今日總覽</h1>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>今日銷貨</CardDescription>
            <CardTitle className="font-heading text-2xl tabular-nums">
              {twd(stats.revenue)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {stats.tickets} 筆交易 · 毛利 {twd(stats.profit)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>今日進貨</CardDescription>
            <CardTitle className="font-heading text-2xl tabular-nums">
              {twd(stats.inbound)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {stats.inboundCount} 張進貨單
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>庫存金額</CardDescription>
            <CardTitle className="font-heading text-2xl tabular-nums">
              {twd(stats.stockValue)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-1 text-sm text-muted-foreground">
            <Warehouse className="size-3.5" />
            依批價計算
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>庫存預警</CardDescription>
            <CardTitle className="font-heading text-2xl tabular-nums">
              {stats.low.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            低於安全庫存或已缺貨
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>今日銷貨</CardTitle>
            <CardDescription>最新完成的收銀紀錄</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.todaySales.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                今天還沒有銷貨
              </p>
            ) : (
              <ul className="divide-y">
                {stats.todaySales.map((sale) => (
                  <li
                    key={sale.id}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium">{sale.number}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(sale.createdAt)} · {sale.items.length} 項
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{twd(sale.total)}</p>
                      <p className="flex items-center justify-end gap-1 text-xs text-emerald-700">
                        <TrendingUp className="size-3" />
                        {twd(profitOf(sale))}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>庫存預警</CardTitle>
            <CardDescription>請盡快安排進貨</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.low.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                目前沒有低庫存商品
              </p>
            ) : (
              <ul className="divide-y">
                {stats.low.map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        安全庫存 {product.minStock}
                        {product.unit}
                      </p>
                    </div>
                    <p
                      className={
                        product.stock <= 0
                          ? "flex items-center gap-1 font-semibold text-destructive"
                          : "flex items-center gap-1 font-semibold text-amber-700"
                      }
                    >
                      {product.stock <= 0 ? (
                        <AlertTriangle className="size-3.5" />
                      ) : (
                        <TrendingDown className="size-3.5" />
                      )}
                      {product.stock}
                      {product.unit}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4" />
            今日進貨
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.todayPurchases.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              今天還沒有進貨單
            </p>
          ) : (
            <ul className="divide-y">
              {stats.todayPurchases.map((purchase) => (
                <li
                  key={purchase.id}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <div>
                    <p className="font-medium">{purchase.number}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(purchase.createdAt)} · {purchase.items.length}{" "}
                      項
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">
                    {twd(purchase.totalCost)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
