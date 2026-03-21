const relativeFormatter = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

const MINUTE_IN_MS = 60_000;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;
const DAY_IN_MS = 24 * HOUR_IN_MS;

export function relativeTime(dateString: string): string {
  const parsedDate = new Date(dateString);
  if (Number.isNaN(parsedDate.getTime())) {
    return dateString;
  }

  const now = Date.now();
  const diffMs = parsedDate.getTime() - now;
  const absDiffMs = Math.abs(diffMs);

  if (absDiffMs < MINUTE_IN_MS) {
    return "just now";
  }

  if (absDiffMs < HOUR_IN_MS) {
    const minutes = Math.round(diffMs / MINUTE_IN_MS);
    return relativeFormatter.format(minutes, "minute");
  }

  if (absDiffMs < DAY_IN_MS) {
    const hours = Math.round(diffMs / HOUR_IN_MS);
    return relativeFormatter.format(hours, "hour");
  }

  if (absDiffMs < DAY_IN_MS * 2) {
    const days = Math.round(diffMs / DAY_IN_MS);
    return days < 0 ? "Yesterday" : "Tomorrow";
  }

  if (absDiffMs < DAY_IN_MS * 7) {
    const days = Math.round(diffMs / DAY_IN_MS);
    return relativeFormatter.format(days, "day");
  }

  return parsedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}
