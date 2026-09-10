"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { defaultSop, displayShopName, normalizeSettings } from "@/lib/shop";
import { useStore } from "@/lib/store";
import type { ShopSettings } from "@/lib/types";

function cloneSettings(settings: ShopSettings): ShopSettings {
  return {
    shopName: settings.shopName,
    branchName: settings.branchName,
    categories: [...settings.categories],
    bins: [...settings.bins],
    sop: settings.sop.map((section) => ({ ...section })),
  };
}

export function ShopView() {
  const {
    state,
    storeId,
    storeName,
    updateSettings,
    exportBackup,
    importBackup,
    spreadCatalogNow,
    exportCatalog,
    importCatalog,
  } = useStore();
  const saved = normalizeSettings(state.settings);
  const [draft, setDraft] = useState<ShopSettings>(() => cloneSettings(saved));
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    setDraft(cloneSettings(normalizeSettings(state.settings)));
  }, [storeId, state.settings]);

  function save() {
    const shopName = draft.shopName.trim();
    if (!shopName) {
      toast.error("請填店名");
      return;
    }
    const next = normalizeSettings({ ...draft, shopName });
    updateSettings(next);
    setDraft(cloneSettings(next));
    toast.success(`左上角已改成「${displayShopName(next)}」`);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6 md:px-6">
      <h1 className="font-heading text-2xl font-semibold">總部 · {storeName}</h1>

      <div className="mt-6 space-y-2">
        <Label htmlFor="shop-name">這一間的顯示名稱</Label>
        <Input
          id="shop-name"
          value={draft.shopName}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              shopName: event.target.value,
            }))
          }
          placeholder="例如 巷口商行"
        />
      </div>

      <Button className="mt-6" onClick={save}>
        儲存店名
      </Button>

      <p className="mt-6 text-sm leading-6 text-muted-foreground">
        總商品名稱、售價存在這台電腦的瀏覽器，不會自己跑到別間門市的電腦。
        同一台電腦請先按「把總商品套到七間門市」，再在上面點斗南／虎尾。
        別間門市的電腦或手機請用「匯出總商品」傳到那台，再按「匯入總商品」。不要按下面的「匯入備份」，那會把這一間的銷貨蓋過去。
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => {
            spreadCatalogNow();
            toast.success("七間門市已套上同一套名稱售價，庫存仍各店分開");
            window.location.reload();
          }}
        >
          把總商品套到七間門市
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const blob = new Blob([exportCatalog()], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const stamp = new Date().toISOString().slice(0, 10);
            link.href = url;
            link.download = `總商品-${stamp}.json`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success("已下載總商品，傳給別間門市的電腦");
          }}
        >
          匯出總商品
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "application/json,.json";
            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file) return;
              const raw = await file.text();
              const result = importCatalog(raw);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("總商品已匯入，七間門市名稱售價相同");
              window.location.reload();
            };
            input.click();
          }}
        >
          匯入總商品
        </Button>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const blob = new Blob([exportBackup()], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const stamp = new Date().toISOString().slice(0, 10);
            link.href = url;
            link.download = `${storeName}-備份-${stamp}.json`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success(`已下載${storeName}備份`);
          }}
        >
          匯出本店備份
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "application/json,.json";
            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file) return;
              const raw = await file.text();
              const result = importBackup(raw);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("備份已還原");
              window.location.reload();
            };
            input.click();
          }}
        >
          匯入備份
        </Button>
      </div>

      <div className="mt-10 border-t pt-5">
        <button
          type="button"
          className="text-sm text-muted-foreground underline"
          onClick={() => setShowGuide((current) => !current)}
        >
          {showGuide ? "收起作業說明" : "作業說明"}
        </button>
        {showGuide && (
          <div className="mt-4 space-y-4">
            {draft.sop.map((section) => (
              <div key={section.id} className="space-y-2">
                <Input
                  value={section.title}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sop: current.sop.map((item) =>
                        item.id === section.id
                          ? { ...item, title: event.target.value }
                          : item,
                      ),
                    }))
                  }
                />
                <Textarea
                  value={section.body}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sop: current.sop.map((item) =>
                        item.id === section.id
                          ? { ...item, body: event.target.value }
                          : item,
                      ),
                    }))
                  }
                  className="min-h-24"
                />
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    sop: defaultSop(current.shopName.trim() || saved.shopName),
                  }))
                }
              >
                還原標準說明
              </Button>
              <Button type="button" variant="outline" onClick={() => window.print()}>
                列印說明
              </Button>
              <Button type="button" onClick={save}>
                儲存說明
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
