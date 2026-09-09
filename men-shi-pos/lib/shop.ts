import {
  DEFAULT_BINS,
  DEFAULT_CATEGORIES,
  UNASSIGNED_BIN,
  type ShopSettings,
  type SopSection,
} from "@/lib/types";

export function uniqueCategories(names: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function normalizeCategories(list?: string[] | null): string[] {
  if (!Array.isArray(list)) return [...DEFAULT_CATEGORIES];
  const out = uniqueCategories(list);
  return out.length > 0 ? out : [...DEFAULT_CATEGORIES];
}

export function listedCategories(
  settings: ShopSettings,
  extras: { category?: string }[] = [],
): string[] {
  return uniqueCategories([
    ...normalizeCategories(settings.categories),
    ...extras.map((item) => item.category ?? ""),
  ]);
}

export function normalizeBins(list?: string[] | null): string[] {
  if (!Array.isArray(list) || list.length === 0) return [...DEFAULT_BINS];
  const out = uniqueCategories(list);
  return out.length > 0 ? out : [...DEFAULT_BINS];
}

export function listedBins(
  settings: ShopSettings,
  extras: { bin?: string }[] = [],
): string[] {
  return uniqueCategories([
    ...normalizeBins(settings.bins),
    ...extras.map((item) => item.bin ?? ""),
  ]);
}

export function displayBin(bin?: string | null) {
  const name = bin?.trim() ?? "";
  return name || UNASSIGNED_BIN;
}

export const DEFAULT_SHOP_NAME = "巷口商行";

export function defaultSop(shopName: string): SopSection[] {
  const name = shopName.trim() || DEFAULT_SHOP_NAME;
  return [
    {
      id: "open",
      title: "開店",
      body: `1. 打開「${name}」收銀頁，確認商品名稱與售價看得到。\n2. 若是空的，到總商品新增商品。\n3. 備註預設「正常販售」，開店後即可收銀。`,
    },
    {
      id: "checkout",
      title: "收銀",
      body: `1. 先選銷貨年月日，再點商品加入購物車。\n2. 客人一次買很多件時，直接連點，再改數量。\n3. 打名稱也可搜尋，例如「茶葉蛋*2」。\n4. 要改價：在購物車改售價，備註欄自己打原因。今日全店都特價，到總商品改售價，結束再改回來。\n5. 瑕疵同名但較便宜：改售價，按「瑕疵」。正常與瑕疵一起賣時按「拆1件」。\n6. 收銀退費：按「退費」，自己填金額並寫備註，會從當日營收扣除。商品不好的退貨也可到銷貨頁點單據。\n7. 員工買東西：切「員工購買」，全部以批價計，總表會標員工價。\n8. 按結帳，只收現金，填實收後確認。會記入所選的年月日。`,
    },
    {
      id: "products",
      title: "總商品",
      body: `1. 新增：填名稱、售價、批價後加入列表。\n2. 分類可自己新增、改名、刪除，不必沿用飲料／食品。\n3. 整理資料：在表格一次改多項名稱、分類、售價、批價。\n4. 改完按「確定更改」，看過清單再套用。\n5. 加盟店可依自己的商品改。`,
    },
    {
      id: "purchase",
      title: "進貨",
      body: `1. 先選進貨年月日。\n2. 打商品名稱，售價與批價會帶入，數量自己填。\n3. 不用填供應商。\n4. 可一次加入多項，再按確認入庫。`,
    },
    {
      id: "stocktake",
      title: "月底盤點",
      body: `1. 到盤點，先選盤點日期，再按「開立本月盤點單」，帳面數量會先凍結。日期可之後再改，列印與總表依這一天。\n2. 數實物，填實盤。也可先列印空白單。列印可改小字／中字、一欄／兩欄，或只印畫面上的櫃。\n3. 實盤少於帳面就是缺失，要查少貨原因。\n4. 核對後一次入帳，未盤的項目不會改庫存。`,
    },
    {
      id: "report",
      title: "年月日總表",
      body: `1. 到總表，用年、月、日查看當日營收與當月營收統計。\n2. 上面四格是當日營收、當月營收、當月支出、結餘，營收已扣除退貨。\n3. 接著是該期間銷貨明細（每一張單的每一項）、退貨、進貨、支出。\n4. 下面商品總表可看庫存。列印本店會印出銷貨每一項，交給店長。`,
    },
    {
      id: "expenses",
      title: "支出",
      body: `1. 到支出表，先選年月日。\n2. 填項目、金額，備註可寫原因。\n3. 房租、水電、薪資等走這裡，進貨不要記在支出。\n4. 總表會把當月支出與營收對起來。`,
    },
    {
      id: "close",
      title: "打烊",
      body: `1. 總表核對當日營收、當月營收、退貨與支出是否齊。\n2. 現金結帳的找零與實收已在各筆銷貨單。\n3. 資料存在這台電腦的瀏覽器，換店或換電腦要重新設定店名。\n4. 加盟店更換店名、門市名稱與本 SOP 後即可獨立使用。`,
    },
  ];
}

export function defaultSettings(): ShopSettings {
  return {
    shopName: DEFAULT_SHOP_NAME,
    branchName: "",
    categories: [...DEFAULT_CATEGORIES],
    bins: [...DEFAULT_BINS],
    sop: defaultSop(DEFAULT_SHOP_NAME),
  };
}

export function normalizeSettings(
  value?: Partial<ShopSettings> | null,
): ShopSettings {
  const base = defaultSettings();
  const shopName = value?.shopName?.trim() || base.shopName;
  const sop =
    Array.isArray(value?.sop) && value.sop.length > 0
      ? value.sop.map((section, index) => ({
          id: section.id || `s-${index}`,
          title: section.title?.trim() || `步驟 ${index + 1}`,
          body: section.body ?? "",
        }))
      : defaultSop(shopName);
  return {
    shopName,
    branchName: value?.branchName?.trim() ?? "",
    categories: normalizeCategories(value?.categories),
    bins: normalizeBins(value?.bins),
    sop,
  };
}

export function displayShopName(settings: ShopSettings) {
  return settings.shopName;
}
