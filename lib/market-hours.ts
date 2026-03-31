import type { AssetClass } from "./asset-class";

interface SessionState {
  tokyo: boolean;
  london: boolean;
  newYork: boolean;
  sydney: boolean;
}

interface MarketSnapshot {
  open: boolean;
  label: "Open" | "Closed" | "Pre-market" | "After-hours";
}

interface EtParts {
  day: number;
  hour: number;
  minute: number;
}

const MINUTE_MS = 60_000;

function minutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function isSecondSundayOfMarch(dayOfMonth: number, dayOfWeek: number): boolean {
  return dayOfWeek === 0 && dayOfMonth >= 8 && dayOfMonth <= 14;
}

function isFirstSundayOfNovember(dayOfMonth: number, dayOfWeek: number): boolean {
  return dayOfWeek === 0 && dayOfMonth >= 1 && dayOfMonth <= 7;
}

function isUsEasternDst(now: Date): boolean {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const date = now.getUTCDate();
  const day = now.getUTCDay();
  const minutes = minutesSinceMidnight(now.getUTCHours(), now.getUTCMinutes());

  if (month < 2 || month > 10) return false;
  if (month > 2 && month < 10) return true;

  if (month === 2) {
    if (!isSecondSundayOfMarch(date, day)) return date > 14;
    return minutes >= 7 * 60;
  }

  if (!isFirstSundayOfNovember(date, day)) return date < 8;
  return minutes < 6 * 60;
}

function getEtParts(now: Date): EtParts {
  const offsetHours = isUsEasternDst(now) ? -4 : -5;
  const et = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
  return {
    day: et.getUTCDay(),
    hour: et.getUTCHours(),
    minute: et.getUTCMinutes(),
  };
}

function isWeekday(day: number): boolean {
  return day >= 1 && day <= 5;
}

function isForexOpen(now: Date): boolean {
  const et = getEtParts(now);
  const minuteOfDay = minutesSinceMidnight(et.hour, et.minute);
  if (et.day === 6) return false;
  if (et.day === 0) return minuteOfDay >= 17 * 60;
  if (et.day === 5) return minuteOfDay < 17 * 60;
  return true;
}

function isGlobexOpen(now: Date): boolean {
  const et = getEtParts(now);
  const minuteOfDay = minutesSinceMidnight(et.hour, et.minute);

  if (et.day === 6) return false;
  if (et.day === 0) return minuteOfDay >= 18 * 60;
  if (et.day === 5) return minuteOfDay < 17 * 60;

  if (minuteOfDay >= 17 * 60 && minuteOfDay < 18 * 60) return false;
  return true;
}

function equitySnapshot(now: Date): MarketSnapshot {
  const et = getEtParts(now);
  const t = minutesSinceMidnight(et.hour, et.minute);
  const regularOpen = 9 * 60 + 30;
  const regularClose = 16 * 60;
  const preMarketStart = 4 * 60;
  const afterHoursEnd = 20 * 60;

  if (!isWeekday(et.day)) return { open: false, label: "Closed" };
  if (t >= regularOpen && t < regularClose) return { open: true, label: "Open" };
  if (t >= preMarketStart && t < regularOpen) return { open: false, label: "Pre-market" };
  if (t >= regularClose && t < afterHoursEnd) return { open: false, label: "After-hours" };
  return { open: false, label: "Closed" };
}

function marketSnapshot(assetClass: AssetClass, now: Date): MarketSnapshot {
  if (assetClass === "crypto") return { open: true, label: "Open" };
  if (assetClass === "fx") return { open: isForexOpen(now), label: isForexOpen(now) ? "Open" : "Closed" };
  if (assetClass === "equity") return equitySnapshot(now);
  if (assetClass === "metal" || assetClass === "commodity") {
    const open = isGlobexOpen(now);
    return { open, label: open ? "Open" : "Closed" };
  }
  return { open: false, label: "Closed" };
}

function formatDuration(totalMinutes: number): string {
  const mins = Math.max(0, totalMinutes);
  const days = Math.floor(mins / (24 * 60));
  const hours = Math.floor((mins % (24 * 60)) / 60);
  const minutes = mins % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function isMarketOpen(assetClass: AssetClass, now: Date = new Date()): boolean {
  return marketSnapshot(assetClass, now).open;
}

export function getActiveSession(now: Date = new Date()): SessionState {
  const minute = minutesSinceMidnight(now.getUTCHours(), now.getUTCMinutes());
  const inRange = (start: number, end: number) => {
    if (start <= end) return minute >= start && minute < end;
    return minute >= start || minute < end;
  };
  return {
    sydney: inRange(21 * 60, 6 * 60),
    tokyo: inRange(0, 9 * 60),
    london: inRange(8 * 60, 17 * 60),
    newYork: inRange(13 * 60, 22 * 60),
  };
}

export function getMarketStatus(
  assetClass: AssetClass,
  now: Date = new Date()
): { open: boolean; label: string; nextEvent: string } {
  const current = marketSnapshot(assetClass, now);
  if (assetClass === "crypto") {
    return { open: true, label: "Open", nextEvent: "Never closes (24/7)" };
  }

  const horizonMinutes = 14 * 24 * 60;
  for (let i = 1; i <= horizonMinutes; i++) {
    const probe = new Date(now.getTime() + i * MINUTE_MS);
    const next = marketSnapshot(assetClass, probe);
    if (next.open !== current.open || next.label !== current.label) {
      const inText = formatDuration(i);
      if (current.open && !next.open) {
        return { ...current, nextEvent: `Closes in ${inText}` };
      }
      if (!current.open && next.open) {
        return { ...current, nextEvent: `Opens in ${inText}` };
      }
      return { ...current, nextEvent: `Changes to ${next.label} in ${inText}` };
    }
  }

  return { ...current, nextEvent: "No scheduled change found" };
}
