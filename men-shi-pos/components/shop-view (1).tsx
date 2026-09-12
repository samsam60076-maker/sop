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
  const [hqAlignOpen, setHqAlignOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [dragOver, setDragOver] = useState(false);

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

  function downloadJson(filename: string, raw: string) {
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function applyCatalogRaw(raw: string) {
    const result = importCatalog(raw.trim());
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("總商品已匯入");
    window.location.reload();
  }

  async function applyCatalogFile(file: File) {
    applyCatalogRaw(await file.text());
  }

  function pickCatalogFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json,.txt,text/plain";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      await applyCatalogFile(file);
    };
    input.click();
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

      <section className="mt-10 border-t pt-6">
        <h2 className="font-heading text-lg font-semibold">正式作業：傳到別間門市</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          一間把總商品打好。這台按「匯出總商品」，用 LINE 把檔傳過去。
          收到的那台<strong>不必另存新檔</strong>。名稱、售價會出現。庫存不會過去，各店自己進貨。
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
          <li>在 LINE 對話裡點一下那個檔，它會進電腦的「下載」資料夾。</li>
          <li>或把檔從 LINE 直接拖進下面虛線框。</li>
          <li>也可以打開檔後 Ctrl+A 全選、Ctrl+C 複製，再貼在「貼上文字」。</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              const stamp = new Date().toISOString().slice(0, 10);
              downloadJson(`總商品-${stamp}.json`, exportCatalog());
              toast.success("已下載總商品，請用 LINE 傳給別間門市");
            }}
          >
            匯出總商品
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              const raw = exportCatalog();
              try {
                await navigator.clipboard.writeText(raw);
                toast.success("已複製。商品很多時請改傳檔，不要貼在 LINE 聊天");
              } catch {
                setPasteOpen(true);
                setPasteText(raw);
                toast.error("這台不能複製，文字已放在下面，請自己全選複製");
              }
            }}
          >
            複製總商品文字
          </Button>
          <Button type="button" variant="outline" onClick={pickCatalogFile}>
            選檔匯入
          </Button>
        </div>
        <div
          className={`mt-4 rounded-lg border-2 border-dashed px-3 py-6 text-center text-sm ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/30 bg-muted/40"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={async (event) => {
            event.preventDefault();
            setDragOver(false);
            const file = event.dataTransfer.files?.[0];
            if (file) {
              await applyCatalogFile(file);
              return;
            }
            const text = event.dataTransfer.getData("text/plain");
            if (text.trim()) applyCatalogRaw(text);
          }}
        >
          把 LINE 裡的總商品檔拖到這裡
          <div className="mt-2">
            <button
              type="button"
              className="text-xs underline"
              onClick={pickCatalogFile}
            >
              或到「下載」資料夾選檔
            </button>
          </div>
        </div>
        <div className="mt-3">
          <button
            type="button"
            className="text-sm text-muted-foreground underline"
            onClick={() => setPasteOpen((current) => !current)}
          >
            {pasteOpen ? "收起貼上文字" : "沒有檔？改貼文字"}
          </button>
          {pasteOpen ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                className="min-h-32 font-mono text-xs"
                placeholder="把總商品文字貼在這裡"
              />
              <Button
                type="button"
                onClick={() => {
                  if (!pasteText.trim()) {
                    toast.error("還沒貼文字");
                    return;
                  }
                  applyCatalogRaw(pasteText);
                }}
              >
                用這段文字匯入
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-8 border-t pt-6">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setHqAlignOpen((current) => !current)}
        >
          <h2 className="font-heading text-lg font-semibold">
            總部這台電腦專用（別間不要按）
          </h2>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {hqAlignOpen ? "收起" : "打開看"}
          </span>
        </button>
        {hqAlignOpen ? (
          <div className="mt-2 space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">
              上面一排西螺、斗南、虎尾，只是這台電腦裡的七本帳。
              有時西螺商品齊，切到斗南卻少幾個，按下面這顆，七本帳的名稱、售價會對成同一套。
              各間的庫存、銷貨不會動。
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              這顆不會傳到別間店的電腦。要給別間，用上面 LINE 傳檔。
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                spreadCatalogNow();
                toast.success("這台電腦的七個店名，名稱售價已對齊");
                window.location.reload();
              }}
            >
              對齊這台電腦的七個店名
            </Button>
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            給別間門市用上面傳檔就好，平常不用打開。
          </p>
        )}
      </section>

      <section className="mt-8 border-t pt-6">
        <h2 className="font-heading text-lg font-semibold">這一間自己的帳</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          銷貨、進貨、庫存只在這一間。換電腦或重裝瀏覽器才用這裡。不要把本店備份匯入別間門市。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const stamp = new Date().toISOString().slice(0, 10);
              downloadJson(`${storeName}-備份-${stamp}.json`, exportBackup());
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
      </section>

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
