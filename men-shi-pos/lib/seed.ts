import { addExpense, applyPurchase, applySale, emptyState } from "@/lib/engine";
import type { AppState, Category, Product, Unit } from "@/lib/types";

const CATALOG: Omit<Product, "id" | "stock" | "active">[] = [
  {
    sku: "DRK001",
    name: "麥香紅茶 600ml",
    category: "飲料",
    bin: "冷藏冰箱",
    unit: "瓶",
    cost: 15,
    price: 25,
    minStock: 10,
  },
  {
    sku: "DRK002",
    name: "純水 600ml",
    category: "飲料",
    bin: "常溫",
    unit: "瓶",
    cost: 8,
    price: 20,
    minStock: 12,
  },
  {
    sku: "DRK003",
    name: "美式咖啡",
    category: "飲料",
    bin: "常溫",
    unit: "杯",
    cost: 18,
    price: 45,
    minStock: 8,
  },
  {
    sku: "FD001",
    name: "茶葉蛋",
    category: "食品",
    bin: "常溫",
    unit: "顆",
    cost: 8,
    price: 15,
    minStock: 15,
  },
  {
    sku: "FD002",
    name: "御飯糰（鮭魚）",
    category: "食品",
    bin: "冷藏冰箱",
    unit: "個",
    cost: 22,
    price: 39,
    minStock: 6,
  },
  {
    sku: "FD003",
    name: "每日鮮奶 936ml",
    category: "飲料",
    bin: "冷藏冰箱",
    unit: "瓶",
    cost: 28,
    price: 42,
    minStock: 6,
  },
  {
    sku: "FD004",
    name: "起司漢堡",
    category: "食品",
    bin: "第一櫃冷凍冰箱",
    unit: "個",
    cost: 32,
    price: 59,
    minStock: 4,
  },
  {
    sku: "FD005",
    name: "關東煮組合",
    category: "食品",
    bin: "冷藏冰箱",
    unit: "份",
    cost: 35,
    price: 65,
    minStock: 5,
  },
  {
    sku: "SN001",
    name: "海苔洋芋片",
    category: "零食",
    bin: "常溫",
    unit: "包",
    cost: 18,
    price: 35,
    minStock: 8,
  },
  {
    sku: "SN002",
    name: "薄荷口香糖",
    category: "零食",
    bin: "常溫",
    unit: "盒",
    cost: 12,
    price: 25,
    minStock: 6,
  },
  {
    sku: "HD001",
    name: "鹼性電池 4 入",
    category: "日用品",
    bin: "常溫",
    unit: "組",
    cost: 32,
    price: 59,
    minStock: 4,
  },
  {
    sku: "HD002",
    name: "衛生紙 6 包",
    category: "日用品",
    bin: "常溫",
    unit: "袋",
    cost: 48,
    price: 89,
    minStock: 4,
  },
];

function atTime(hour: number, minute: number, daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export function createDemoState(): AppState {
  const products: Product[] = CATALOG.map((item, index) => ({
    ...item,
    id: `demo-product-${index + 1}`,
    stock: 0,
    active: true,
    category: item.category as Category,
    unit: item.unit as Unit,
  }));

  let state: AppState = { ...emptyState, products };

  const purchase = applyPurchase(state, {
    note: "開幕進貨",
    createdAt: atTime(8, 10),
    items: products.map((product) => ({
      productId: product.id,
      qty:
        product.category === "飲料"
          ? 24
          : product.category === "食品"
            ? 16
            : product.category === "零食"
              ? 12
              : 8,
      unitCost: product.cost,
    })),
  });
  if (!purchase.ok) return state;
  state = purchase.state;

  const bySku = (sku: string) =>
    state.products.find((product) => product.sku === sku)!;

  const saleOne = applySale(state, {
    paymentMethod: "cash",
    received: 100,
    note: "正常販售",
    createdAt: atTime(9, 18),
    items: [
      { productId: bySku("DRK001").id, qty: 2 },
      { productId: bySku("FD001").id, qty: 3 },
      { productId: bySku("SN001").id, qty: 1 },
    ],
  });
  if (saleOne.ok) state = saleOne.state;

  const saleTwo = applySale(state, {
    paymentMethod: "mobile",
    received: 0,
    note: "正常販售",
    createdAt: atTime(10, 42),
    items: [
      { productId: bySku("DRK003").id, qty: 1 },
      { productId: bySku("FD002").id, qty: 1 },
      { productId: bySku("FD004").id, qty: 1 },
    ],
  });
  if (saleTwo.ok) state = saleTwo.state;

  const saleThree = applySale(state, {
    paymentMethod: "card",
    received: 0,
    note: "外帶",
    createdAt: atTime(11, 5),
    items: [
      { productId: bySku("HD002").id, qty: 1 },
      { productId: bySku("DRK002").id, qty: 2 },
    ],
  });
  if (saleThree.ok) state = saleThree.state;

  const rent = addExpense(state, {
    title: "店面租金",
    category: "房租",
    amount: 25000,
    note: "本月",
    createdAt: atTime(8, 5),
  });
  if (rent.ok) state = rent.state;

  const power = addExpense(state, {
    title: "電費",
    category: "水電",
    amount: 1860,
    note: "",
    createdAt: atTime(9, 40),
  });
  if (power.ok) state = power.state;

  return state;
}
