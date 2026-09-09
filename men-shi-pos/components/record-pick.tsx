"use client";

export function dropIds(current: Set<string>, ids: string[]) {
  const next = new Set(current);
  for (const id of ids) next.delete(id);
  return next;
}

export function toggleId(current: Set<string>, id: string) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function toggleAll(current: Set<string>, ids: string[]) {
  const all = ids.length > 0 && ids.every((id) => current.has(id));
  const next = new Set(current);
  if (all) {
    for (const id of ids) next.delete(id);
  } else {
    for (const id of ids) next.add(id);
  }
  return next;
}

export function HeaderCheck({
  ids,
  selected,
  onToggle,
  label,
}: {
  ids: string[];
  selected: Set<string>;
  onToggle: () => void;
  label: string;
}) {
  const count = ids.filter((id) => selected.has(id)).length;
  const all = ids.length > 0 && count === ids.length;
  const some = count > 0 && !all;
  return (
    <input
      type="checkbox"
      className="size-3.5 align-middle"
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = some;
      }}
      onChange={onToggle}
      aria-label={label}
    />
  );
}

export function PickBar({
  count,
  onDelete,
  onClear,
  deleteLabel,
}: {
  count: number;
  onDelete: () => void;
  onClear: () => void;
  deleteLabel: string;
}) {
  if (count === 0) return null;
  return (
    <div className="ml-auto flex flex-wrap items-center gap-2 print:hidden">
      <p className="text-xs font-medium">已勾選 {count} 筆</p>
      <button
        type="button"
        className="h-7 rounded-md bg-destructive/10 px-2 text-xs font-medium text-destructive"
        onClick={onDelete}
      >
        {deleteLabel}
      </button>
      <button
        type="button"
        className="text-xs text-muted-foreground underline"
        onClick={onClear}
      >
        取消勾選
      </button>
    </div>
  );
}
