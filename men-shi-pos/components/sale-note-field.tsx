"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function SaleNoteField({
  id = "sale-note",
  value,
  onChange,
  required,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>備註</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          placeholder ?? (required ? "例如 壞掉、過期、報廢" : "可留空")
        }
      />
    </div>
  );
}
