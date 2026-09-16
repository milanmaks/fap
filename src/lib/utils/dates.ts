export function isValidDate(val: unknown): boolean {
  if (typeof val !== "string" && !(val instanceof Date)) return false;
  const d = new Date(val as string | Date);
  return !isNaN(d.getTime());
}

export function formatDate(isoString?: string | null): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString("sr-RS", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function toIsoBucket(dateStr: string, bucket: "hour" | "day" | "week" | "month"): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "unknown";

  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getUTCFullYear();
  const month = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hour = pad(d.getUTCHours());

  switch (bucket) {
    case "hour":
      return `${year}-${month}-${day} ${hour}:00`;
    case "day":
      return `${year}-${month}-${day}`;
    case "week": {
      const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
      const pastDaysOfYear = (d.getTime() - firstDayOfYear.getTime()) / 86400000;
      const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getUTCDay() + 1) / 7);
      return `${year}-W${pad(weekNum)}`;
    }
    case "month":
      return `${year}-${month}`;
    default:
      return `${year}-${month}-${day}`;
  }
}
