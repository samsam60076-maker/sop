import type { AppState } from "@/lib/types";

export const BRANCHES = [
  { id: "xiluo", name: "西螺" },
  { id: "dounan", name: "斗南" },
  { id: "huwei", name: "虎尾" },
  { id: "douliu", name: "斗六" },
  { id: "nantou", name: "南投" },
  { id: "minxiong", name: "民雄" },
  { id: "beigang", name: "北港" },
] as const;

export type BranchId = (typeof BRANCHES)[number]["id"];

export type Workspace = {
  version: 6;
  currentStoreId: BranchId;
  stores: Record<BranchId, AppState>;
};

export function isBranchId(value: string): value is BranchId {
  return BRANCHES.some((item) => item.id === value);
}

export function branchName(id: BranchId) {
  return BRANCHES.find((item) => item.id === id)?.name ?? id;
}
