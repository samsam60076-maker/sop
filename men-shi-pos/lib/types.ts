export const DEFAULT_CATEGORIES = [
  "冷凍",
  "冷藏",
  "常溫",
  "水果",
  "飲料",
  "食品",
  "零食",
  "日用品",
] as const;
export type Category = string;

export const DEFAULT_BINS = [
  "第一櫃冷凍冰箱",
  "第二櫃冷凍冰箱",
  "常溫",
  "水果",
  "冷藏冰箱",
] as const;
export type Bin = string;

export const UNASSIGNED_BIN = "未分櫃";

export const UNITS = ["個", "瓶", "杯", "包", "盒", "袋", "組", "份", "顆"] as const;
export type Unit = (typeof UNITS)[number];

export const SALE_REASONS = [
  "正常販售",
  "特價",
  "外帶",
  "員工餐",
  "贈品",
  "瑕疵",
  "損壞",
  "試吃",
  "調帳",
] as const;

export const EXPENSE_KINDS = [
  "房租",
  "水電",
  "薪資",
  "運費",
  "包裝",
  "雜支",
  "其他",
] as const;

export const PAYMENT_METHODS = [
  { value: "cash", label: "現金" },
  { value: "card", label: "信用卡" },
  { value: "mobile", label: "行動支付" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export type ComboPart = {
  productId: string;
  qty: number;
};

export type PriceTier = {
  qty: number;
  total: number;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: Category;
  bin?: Bin;
  unit: Unit;
  cost: number;
  price: number;
  stock: number;
  minStock: number;
  active: boolean;
  comboParts?: ComboPart[];
  priceTiers?: PriceTier[];
};

export type PurchaseItem = {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unitCost: number;
  unitPrice?: number;
};

export type Purchase = {
  id: string;
  number: string;
  supplier: string;
  createdAt: string;
  items: PurchaseItem[];
  totalCost: number;
  note: string;
};

export type SaleItem = {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  lineTotal?: number;
  note?: string;
};

export type Sale = {
  id: string;
  number: string;
  createdAt: string;
  items: SaleItem[];
  paymentMethod: PaymentMethod;
  received: number;
  change: number;
  total: number;
  note: string;
  status: "completed" | "voided";
};

export type MovementType = "in" | "out" | "adjust";

export type Movement = {
  id: string;
  productId: string;
  type: MovementType;
  qty: number;
  reason: string;
  refId?: string;
  createdAt: string;
};

export type StocktakeLine = {
  productId: string;
  name: string;
  sku: string;
  category: Category;
  bin: Bin;
  unit: Unit;
  bookQty: number;
  countedQty: number | null;
};

export type Stocktake = {
  id: string;
  number: string;
  title: string;
  createdAt: string;
  countedAt: string;
  confirmedAt?: string;
  note: string;
  status: "draft" | "confirmed";
  lines: StocktakeLine[];
};

export type SopSection = {
  id: string;
  title: string;
  body: string;
};

export type Expense = {
  id: string;
  number: string;
  createdAt: string;
  title: string;
  category: string;
  amount: number;
  note: string;
};

export type SaleReturnItem = {
  saleItemIndex: number;
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
};

export type SaleReturn = {
  id: string;
  number: string;
  saleId: string;
  saleNumber: string;
  createdAt: string;
  items: SaleReturnItem[];
  total: number;
  restock: boolean;
  note: string;
};

export type ShopSettings = {
  shopName: string;
  branchName: string;
  categories: string[];
  bins: string[];
  sop: SopSection[];
};

export type PreorderSource = "facebook" | "line" | "phone" | "other";

export type PreorderStatus =
  | "ordered"
  | "arrived"
  | "notified"
  | "picked"
  | "cancelled";

export type PreorderItem = {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unitPrice: number;
};

export type Preorder = {
  id: string;
  number: string;
  createdAt: string;
  customerName: string;
  contact: string;
  source: PreorderSource;
  items: PreorderItem[];
  status: PreorderStatus;
  arrivedAt?: string;
  notifiedAt?: string;
  pickedAt?: string;
  saleId?: string;
  saleNumber?: string;
  note: string;
};

export type AppState = {
  products: Product[];
  purchases: Purchase[];
  sales: Sale[];
  movements: Movement[];
  stocktakes: Stocktake[];
  expenses: Expense[];
  saleReturns: SaleReturn[];
  preorders: Preorder[];
  checkoutOrder: string[];
  settings: ShopSettings;
};

export type PriceReason = "瑕疵";

export type CartLine = {
  id: string;
  productId: string;
  qty: number;
  unitPrice: number;
  priceReason?: PriceReason;
  note?: string;
};
