"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function SaleNoteField({
  id = "sale-note",
  value,
  onChange,
  required,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>備註</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={required ? "自己打原因" : "可留空"}
      />
    </div>
  );
}
