import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";

export function twd(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function isSameDay(iso: string, date = new Date()) {
  const d = new Date(iso);
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}

export function paymentLabel(method: PaymentMethod) {
  return PAYMENT_METHODS.find((item) => item.value === method)?.label ?? method;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"] as const;

export function todayLabel(date = new Date()) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日週${WEEKDAYS[date.getDay()]}`;
}

export function toInputDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateYmd(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function ymdParts(iso: string) {
  const date = new Date(iso);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

export function inputDateToIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date();
  if (!year || !month || !day) return date.toISOString();
  date.setFullYear(year, month - 1, day);
  return date.toISOString();
}
