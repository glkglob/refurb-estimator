export enum PropertyType {
  DETACHED_HOUSE = "Detached House",
  SEMI_DETACHED_HOUSE = "Semi-Detached House",
  TERRACED_HOUSE = "Terraced House",
  END_OFF_TERRACE = "End-Off-Terrace",
  BUNGALOW = "Bungalow",
  COTTAGE = "Cottage",
  FLAT_APARTMENT = "Flat / Apartment",
  MAISONETTE = "Maisonette",
  TOWNHOUSE = "Townhouse",
  OFFICE = "Office",
  RETAIL = "Retail",
  INDUSTRIAL = "Industrial",
  LEISURE = "Leisure",
  HEALTHCARE = "Healthcare"
}

export const PROPERTY_TYPE_VALUES = Object.values(PropertyType) as PropertyType[];

export const PROPERTY_TYPE_OPTIONS: ReadonlyArray<{
  value: PropertyType;
  label: PropertyType;
}> = PROPERTY_TYPE_VALUES.map((propertyType) => ({
  value: propertyType,
  label: propertyType
}));

export const RESIDENTIAL_PROPERTY_TYPES: ReadonlyArray<PropertyType> = [
  PropertyType.DETACHED_HOUSE,
  PropertyType.SEMI_DETACHED_HOUSE,
  PropertyType.TERRACED_HOUSE,
  PropertyType.END_OFF_TERRACE,
  PropertyType.BUNGALOW,
  PropertyType.COTTAGE,
  PropertyType.FLAT_APARTMENT,
  PropertyType.MAISONETTE,
  PropertyType.TOWNHOUSE
];

export const COMMERCIAL_PROPERTY_TYPES: ReadonlyArray<PropertyType> = [
  PropertyType.OFFICE,
  PropertyType.RETAIL,
  PropertyType.INDUSTRIAL,
  PropertyType.LEISURE,
  PropertyType.HEALTHCARE
];

export const PROPERTY_TYPE_DISPLAY_ORDER: ReadonlyArray<PropertyType> = [
  ...RESIDENTIAL_PROPERTY_TYPES,
  ...COMMERCIAL_PROPERTY_TYPES
];

const propertyTypeSet = new Set<PropertyType>(PROPERTY_TYPE_VALUES);

export function isPropertyType(value: unknown): value is PropertyType {
  return typeof value === "string" && propertyTypeSet.has(value as PropertyType);
}

export function parsePropertyType(value: unknown): PropertyType | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return isPropertyType(normalized) ? normalized : null;
}

const PROPERTY_TYPE_ALIASES: Readonly<Record<string, PropertyType>> = {
  detached: PropertyType.DETACHED_HOUSE,
  "detached house": PropertyType.DETACHED_HOUSE,
  semi: PropertyType.SEMI_DETACHED_HOUSE,
  "semi detached": PropertyType.SEMI_DETACHED_HOUSE,
  "semi-detached": PropertyType.SEMI_DETACHED_HOUSE,
  "semi-detached house": PropertyType.SEMI_DETACHED_HOUSE,
  terrace: PropertyType.TERRACED_HOUSE,
  terraced: PropertyType.TERRACED_HOUSE,
  "terraced house": PropertyType.TERRACED_HOUSE,
  "end of terrace": PropertyType.END_OFF_TERRACE,
  "end-of-terrace": PropertyType.END_OFF_TERRACE,
  "end-off-terrace": PropertyType.END_OFF_TERRACE,
  bungalow: PropertyType.BUNGALOW,
  cottage: PropertyType.COTTAGE,
  flat: PropertyType.FLAT_APARTMENT,
  apartment: PropertyType.FLAT_APARTMENT,
  "flat apartment": PropertyType.FLAT_APARTMENT,
  "flat/apartment": PropertyType.FLAT_APARTMENT,
  maisonette: PropertyType.MAISONETTE,
  townhouse: PropertyType.TOWNHOUSE,
  office: PropertyType.OFFICE,
  retail: PropertyType.RETAIL,
  industrial: PropertyType.INDUSTRIAL,
  leisure: PropertyType.LEISURE,
  healthcare: PropertyType.HEALTHCARE,
  "health care": PropertyType.HEALTHCARE,
  commercial: PropertyType.OFFICE,
  "commercial unit": PropertyType.OFFICE
};

export function inferPropertyTypeFromText(value: unknown): PropertyType | null {
  if (typeof value !== "string") {
    return null;
  }

  const directMatch = parsePropertyType(value);
  if (directMatch) {
    return directMatch;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ");

  return PROPERTY_TYPE_ALIASES[normalized] ?? null;
}

export function isCommercialPropertyType(propertyType: PropertyType): boolean {
  return COMMERCIAL_PROPERTY_TYPES.includes(propertyType);
}

export function isFlatLikePropertyType(propertyType: PropertyType): boolean {
  return (
    propertyType === PropertyType.FLAT_APARTMENT ||
    propertyType === PropertyType.MAISONETTE
  );
}
