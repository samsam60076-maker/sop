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

export type BranchId = string;

export type Branch = {
  id: BranchId;
  name: string;
};

export type Workspace = {
  version: 6;
  currentStoreId: BranchId;
  stores: Record<string, AppState>;
  branches: Branch[];
};

export function isBranchId(value: string): value is BranchId {
  return typeof value === "string" && value.length > 0;
}

export function listedBranches(workspace: Pick<Workspace, "branches">): Branch[] {
  if (workspace.branches?.length) return workspace.branches;
  return BRANCHES.map((item) => ({ id: item.id, name: item.name }));
}

export function branchName(
  id: BranchId,
  workspace?: Pick<Workspace, "branches" | "stores">,
) {
  const fromList = workspace
    ? listedBranches(workspace).find((item) => item.id === id)?.name
    : BRANCHES.find((item) => item.id === id)?.name;
  const fromShop = workspace?.stores[id]?.settings.shopName?.trim();
  return fromList || fromShop || id;
}

export function makeBranchId(used: Set<string>) {
  let id = `shop-${Date.now().toString(36)}`;
  while (used.has(id)) {
    id = `shop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  }
  return id;
}
