export function formatBytes(bytes: number | bigint, decimals = 1): string {
  const num = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (num === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${parseFloat((num / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatNumber(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return new Intl.NumberFormat("sr-RS").format(val);
}

export function formatPercent(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined) return "-";
  return `${(val * 100).toFixed(decimals)}%`;
}
