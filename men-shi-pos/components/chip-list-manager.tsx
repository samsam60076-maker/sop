"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const tinyInputClass =
  "h-6 min-w-0 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export function ChipListManager({
  label,
  items,
  addPlaceholder,
  onAdd,
  onRename,
  onRemove,
}: {
  label: string;
  items: string[];
  addPlaceholder: string;
  onAdd: (name: string) => boolean;
  onRename: (from: string, to: string) => boolean;
  onRemove: (name: string) => boolean;
}) {
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function submitNew(event: React.FormEvent) {
    event.preventDefault();
    if (!onAdd(newName)) return;
    setNewName("");
  }

  return (
    <div className="rounded-lg border bg-background px-2.5 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        {items.map((item) =>
          editing === item ? (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-1.5 py-0.5"
            >
              <input
                value={editValue}
                onChange={(event) => setEditValue(event.target.value)}
                className={cn(tinyInputClass, "w-28")}
                aria-label={`${item} 新名稱`}
                autoFocus
              />
              <button
                type="button"
                className="text-[11px] font-medium"
                onClick={() => {
                  if (!onRename(item, editValue)) return;
                  setEditing(null);
                }}
              >
                儲存
              </button>
              <button
                type="button"
                className="text-[11px] text-muted-foreground"
                onClick={() => setEditing(null)}
              >
                取消
              </button>
            </span>
          ) : (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
            >
              <span>{item}</span>
              <button
                type="button"
                className="text-muted-foreground"
                onClick={() => {
                  setEditing(item);
                  setEditValue(item);
                }}
              >
                改
              </button>
              <button
                type="button"
                className="text-destructive"
                onClick={() => onRemove(item)}
              >
                刪
              </button>
            </span>
          ),
        )}
        <form onSubmit={submitNew} className="inline-flex items-center gap-1">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={addPlaceholder}
            className={cn(tinyInputClass, "h-7 w-28")}
            aria-label={addPlaceholder}
          />
          <button type="submit" className="h-7 rounded-md border px-2 text-xs">
            新增
          </button>
        </form>
      </div>
    </div>
  );
}
