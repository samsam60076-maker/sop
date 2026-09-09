"use client";

import { toInputDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const selectClass =
  "h-12 rounded-lg border border-input bg-card px-2 text-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function parse(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const now = new Date();
  return {
    year: year || now.getFullYear(),
    month: month || now.getMonth() + 1,
    day: day || now.getDate(),
  };
}

function join(year: number, month: number, day: number) {
  const max = daysInMonth(year, month);
  const safeDay = Math.min(day, max);
  return toInputDate(new Date(year, month - 1, safeDay));
}

export function YmdPicker({
  id,
  value,
  onChange,
  compact = false,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const current = parse(value);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, index) => thisYear - 4 + index);
  const maxDay = daysInMonth(current.year, current.month);
  const box = compact
    ? "h-10 rounded-lg border border-input bg-card px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    : selectClass;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1">
        <select
          id={id}
          name={id ? `${id}-year` : "sale-year"}
          className={cn(box, compact ? "w-[5.5rem]" : "w-[6.5rem]")}
          value={current.year}
          onChange={(event) =>
            onChange(join(Number(event.target.value), current.month, current.day))
          }
          aria-label="年"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">年</span>
      </label>
      <label className="flex items-center gap-1">
        <select
          name={id ? `${id}-month` : "sale-month"}
          className={cn(box, compact ? "w-16" : "w-20")}
          value={current.month}
          onChange={(event) =>
            onChange(join(current.year, Number(event.target.value), current.day))
          }
          aria-label="月"
        >
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">月</span>
      </label>
      <label className="flex items-center gap-1">
        <select
          name={id ? `${id}-day` : "sale-day"}
          className={cn(box, compact ? "w-16" : "w-20")}
          value={Math.min(current.day, maxDay)}
          onChange={(event) =>
            onChange(join(current.year, current.month, Number(event.target.value)))
          }
          aria-label="日"
        >
          {Array.from({ length: maxDay }, (_, index) => index + 1).map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">日</span>
      </label>
    </div>
  );
}
