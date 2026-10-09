"use client";

import { toInputDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const WEEKDAY_LONG = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
];
const WEEKDAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

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

function weekdayIndex(year: number, month: number, day: number) {
  return new Date(year, month - 1, day).getDay();
}

export function YmdPicker({
  id,
  value,
  onChange,
  compact = false,
  tiny = false,
  allowEmpty = false,
  futureYears = false,
  markedDates,
  markedHint = "有紀錄",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  tiny?: boolean;
  allowEmpty?: boolean;
  futureYears?: boolean;
  markedDates?: Iterable<string>;
  markedHint?: string;
}) {
  const empty = allowEmpty && !value;
  const current = parse(value);
  const thisYear = new Date().getFullYear();
  const years = futureYears
    ? Array.from({ length: 8 }, (_, index) => thisYear - 1 + index)
    : Array.from({ length: 6 }, (_, index) => thisYear - 4 + index);
  const maxDay = daysInMonth(current.year, current.month);
  const small = compact || tiny;
  const marked = markedDates ? new Set(markedDates) : null;
  const selectedDay = Math.min(current.day, maxDay);
  const selectedIso = join(current.year, current.month, selectedDay);
  const selectedMarked = Boolean(marked?.has(selectedIso));
  const box = tiny
    ? "h-6 rounded-md border border-input bg-card px-1 text-[11px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
    : compact
      ? "h-7 rounded-md border border-input bg-card px-1.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      : selectClass;
  const weekday = empty
    ? ""
    : WEEKDAY_LONG[weekdayIndex(current.year, current.month, selectedDay)];

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        <label className="flex items-center gap-1">
          <select
            id={id}
            name={id ? `${id}-year` : "sale-year"}
            className={cn(
              box,
              tiny ? "w-16" : compact ? "w-[4.75rem]" : "w-[6.5rem]",
            )}
            value={empty ? "" : current.year}
            onChange={(event) => {
              const year = Number(event.target.value);
              if (!year) {
                onChange("");
                return;
              }
              onChange(join(year, current.month, current.day));
            }}
            aria-label="年"
          >
            {allowEmpty ? <option value="">—</option> : null}
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <span
            className={cn(
              small ? "text-[11px]" : "text-sm",
              "text-muted-foreground",
            )}
          >
            年
          </span>
        </label>
        <label className="flex items-center gap-1">
          <select
            name={id ? `${id}-month` : "sale-month"}
            className={cn(box, tiny ? "w-9" : compact ? "w-11" : "w-20")}
            value={empty ? "" : current.month}
            onChange={(event) => {
              const month = Number(event.target.value);
              if (!month) {
                onChange("");
                return;
              }
              onChange(join(current.year, month, current.day));
            }}
            aria-label="月"
          >
            {allowEmpty ? <option value="">—</option> : null}
            {Array.from({ length: 12 }, (_, index) => index + 1).map(
              (month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ),
            )}
          </select>
          <span
            className={cn(
              small ? "text-[11px]" : "text-sm",
              "text-muted-foreground",
            )}
          >
            月
          </span>
        </label>
        <label className="flex items-center gap-1">
          <select
            name={id ? `${id}-day` : "sale-day"}
            className={cn(
              box,
              marked ? (tiny ? "w-16" : compact ? "w-[4.5rem]" : "w-24") : tiny ? "w-9" : compact ? "w-11" : "w-20",
              selectedMarked &&
                "border-emerald-500 bg-emerald-50 font-semibold text-emerald-900",
            )}
            value={empty ? "" : selectedDay}
            onChange={(event) => {
              const day = Number(event.target.value);
              if (!day) {
                onChange("");
                return;
              }
              onChange(join(current.year, current.month, day));
            }}
            aria-label="日"
          >
            {allowEmpty ? <option value="">—</option> : null}
            {Array.from({ length: maxDay }, (_, index) => index + 1).map(
              (day) => {
                const iso = join(current.year, current.month, day);
                const hasRecord = Boolean(marked?.has(iso));
                const short =
                  WEEKDAY_SHORT[
                    weekdayIndex(current.year, current.month, day)
                  ];
                return (
                  <option
                    key={day}
                    value={day}
                    className={hasRecord ? "bg-emerald-50 font-semibold" : undefined}
                  >
                    {marked
                      ? `${day} ${short}${hasRecord ? " ●" : ""}`
                      : day}
                  </option>
                );
              },
            )}
          </select>
          <span
            className={cn(
              small ? "text-[11px]" : "text-sm",
              "text-muted-foreground",
            )}
          >
            日
          </span>
        </label>
        {empty ? null : (
          <span
            className={cn(
              small ? "text-[11px]" : "text-sm",
              "font-medium",
              selectedMarked ? "text-emerald-800" : "text-muted-foreground",
            )}
          >
            {weekday}
          </span>
        )}
      </div>
      {marked && !empty ? (
        <div className="flex max-w-xl flex-wrap gap-0.5">
          {Array.from({ length: maxDay }, (_, index) => index + 1).map(
            (day) => {
              const iso = join(current.year, current.month, day);
              const hasRecord = marked.has(iso);
              const selected = day === selectedDay;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onChange(iso)}
                  title={
                    hasRecord
                      ? `${iso} ${WEEKDAY_LONG[weekdayIndex(current.year, current.month, day)]} ${markedHint}`
                      : `${iso} ${WEEKDAY_LONG[weekdayIndex(current.year, current.month, day)]}`
                  }
                  className={cn(
                    "h-6 min-w-6 rounded px-1 text-center text-[11px] tabular-nums",
                    selected && "ring-1 ring-primary",
                    hasRecord
                      ? "bg-emerald-100 font-semibold text-emerald-900"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {day}
                </button>
              );
            },
          )}
        </div>
      ) : null}
    </div>
  );
}
