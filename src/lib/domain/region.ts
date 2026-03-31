export const REGION_VALUES = [
  "london",
  "south_east",
  "south_west",
  "east_of_england",
  "west_midlands",
  "east_midlands",
  "yorkshire_and_humber",
  "north_west",
  "north_east",
  "scotland",
  "wales",
  "northern_ireland",
] as const;

export type Region = (typeof REGION_VALUES)[number];

export const REGION_SET: ReadonlySet<Region> = new Set(REGION_VALUES);

export function normalizeRegion(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isRegion(value: unknown): value is Region {
  return REGION_SET.has(normalizeRegion(value) as Region);
}
