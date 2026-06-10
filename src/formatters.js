export function formatDisplayName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\p{L}+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

export function formatMarketValue(value) {
  if (value == null || value === "") return "0";
  if (typeof value === "string") return value;
  if (typeof value.amount !== "number") return "0";

  const formatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: value.currency || "EUR",
    maximumFractionDigits: 1,
    notation: value.amount >= 1_000_000 ? "compact" : "standard"
  });
  return formatter.format(value.amount);
}

export function formatStat(value) {
  if (value == null || value === "") return "0";
  return Number.isFinite(Number(value)) ? String(value) : "0";
}
