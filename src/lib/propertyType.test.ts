import { z } from "zod";
import {
  inferPropertyTypeFromText,
  PROPERTY_TYPE_DISPLAY_ORDER,
  PROPERTY_TYPE_VALUES,
  PropertyType
} from "./propertyType";
import { sharedEstimateSnapshotSchema } from "./share";

describe("PropertyType enum", () => {
  test("contains exactly the 14 supported property types in display order", () => {
    expect(PROPERTY_TYPE_VALUES).toEqual([
      PropertyType.DETACHED_HOUSE,
      PropertyType.SEMI_DETACHED_HOUSE,
      PropertyType.TERRACED_HOUSE,
      PropertyType.END_OFF_TERRACE,
      PropertyType.BUNGALOW,
      PropertyType.COTTAGE,
      PropertyType.FLAT_APARTMENT,
      PropertyType.MAISONETTE,
      PropertyType.TOWNHOUSE,
      PropertyType.OFFICE,
      PropertyType.RETAIL,
      PropertyType.INDUSTRIAL,
      PropertyType.LEISURE,
      PropertyType.HEALTHCARE
    ]);
    expect(PROPERTY_TYPE_DISPLAY_ORDER).toEqual(PROPERTY_TYPE_VALUES);
    expect(Object.values(PropertyType)).toHaveLength(14);
  });

  test("accepts supported values through zod native enum validation", () => {
    const schema = z.object({
      propertyType: z.nativeEnum(PropertyType)
    });

    expect(
      schema.parse({ propertyType: PropertyType.DETACHED_HOUSE }).propertyType
    ).toBe(PropertyType.DETACHED_HOUSE);
  });

  test("rejects unsupported values through zod native enum validation", () => {
    const schema = z.object({
      propertyType: z.nativeEnum(PropertyType)
    });

    const result = schema.safeParse({ propertyType: "Castle" });
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.issues[0]?.message).toContain("Invalid option");
  });

  test("normalizes legacy/free-text property labels", () => {
    expect(inferPropertyTypeFromText("detached")).toBe(PropertyType.DETACHED_HOUSE);
    expect(inferPropertyTypeFromText("flat/apartment")).toBe(
      PropertyType.FLAT_APARTMENT
    );
    expect(inferPropertyTypeFromText("commercial unit")).toBe(PropertyType.OFFICE);
  });
});

describe("shared snapshot schema propertyType", () => {
  test("serializes and deserializes enum-backed payloads", () => {
    const payload = {
      kind: "rooms",
      input: {
        region: "London",
        projectType: "refurb",
        propertyType: PropertyType.DETACHED_HOUSE,
        totalAreaM2: 95,
        condition: "fair",
        finishLevel: "standard"
      },
      result: {
        totalLow: 100000,
        totalTypical: 120000,
        totalHigh: 140000,
        costPerM2: { low: 1053, typical: 1263, high: 1474 },
        categories: []
      }
    } as const;

    const json = JSON.stringify(payload);
    const decoded = JSON.parse(json) as unknown;
    const parsed = sharedEstimateSnapshotSchema.parse(decoded);
    expect(parsed.input.propertyType).toBe(PropertyType.DETACHED_HOUSE);
  });
});
