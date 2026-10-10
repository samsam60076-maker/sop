"use client";

import { useState } from "react";
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
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function StoreBar() {
  const { storeId, branches, switchStore, addStore, removeStore } = useStore();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const current = branches.find((branch) => branch.id === storeId);

  function submitAdd() {
    const result = addStore(name);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`已新增 ${name.trim()}`);
    setName("");
    setAdding(false);
    setEditing(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 px-2 py-0.5">
      <span className="shrink-0 text-[10px] text-sidebar-foreground/70">
        珊珊海鮮肉舖
      </span>
      <button
        type="button"
        className="inline-flex h-5 items-center rounded border border-sidebar-border px-1 text-[10px] text-sidebar-foreground/80 hover:bg-sidebar-accent"
        onClick={() => {
          setOpen((currentOpen) => {
            if (currentOpen) setEditing(false);
            return !currentOpen;
          });
        }}
      >
        {open ? "隱藏" : "打開"}
      </button>
      {open ? (
      <div className="flex min-w-0 flex-wrap items-center gap-0.5">
        {branches.map((branch) => (
          <span key={branch.id} className="inline-flex items-center">
            <button
              type="button"
              onClick={() => switchStore(branch.id)}
              className={cn(
                "inline-flex h-5 items-center rounded px-1 text-[10px]",
                storeId === branch.id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
              )}
            >
              {branch.name}
            </button>
            {editing ? (
              <button
                type="button"
                className="inline-flex h-5 w-4 items-center justify-center text-[10px] text-red-200 hover:text-white"
                aria-label={`刪除 ${branch.name}`}
                onClick={() => {
                  if (branches.length <= 1) {
                    toast.error("至少要留一間門市");
                    return;
                  }
                  if (
                    !window.confirm(
                      `刪掉「${branch.name}」？這間的銷貨、進貨、庫存會一起沒有。`,
                    )
                  ) {
                    return;
                  }
                  const result = removeStore(branch.id);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(`已刪除 ${branch.name}`);
                }}
              >
                ×
              </button>
            ) : null}
          </span>
        ))}
        <button
          type="button"
          className="inline-flex h-5 items-center rounded px-1 text-[10px] text-sidebar-foreground/80 hover:bg-sidebar-accent"
          onClick={() => {
            setAdding(true);
            setName("");
          }}
        >
          ＋
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex h-5 items-center rounded px-1 text-[10px]",
            editing
              ? "bg-sidebar-accent text-sidebar-foreground"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
          )}
          onClick={() => setEditing((current) => !current)}
        >
          {editing ? "完成" : "增減"}
        </button>
      </div>
      ) : (
        <span className="inline-flex h-5 items-center rounded bg-sidebar-primary px-1 text-[10px] text-sidebar-primary-foreground">
          {current?.name ?? ""}
        </span>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新增門市</DialogTitle>
            <DialogDescription>
              新門市會帶現在的總商品，庫存從 0 開始。各店帳本分開。
            </DialogDescription>
          </DialogHeader>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如 嘉義"
            aria-label="門市名稱"
            className="h-9 text-base"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitAdd();
              }
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              取消
            </Button>
            <Button type="button" onClick={submitAdd}>
              新增
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
