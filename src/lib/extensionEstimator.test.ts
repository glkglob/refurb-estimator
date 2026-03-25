import { calculateExtensionEstimate } from "./extensionEstimator";

describe("calculateExtensionEstimate", () => {
  const POSTCODE_LONDON = "SW1A";
  const POSTCODE_NORTHWEST = "M1";

  test("throws when floor area is invalid", () => {
    expect(() =>
      calculateExtensionEstimate({
        extensionType: "single_storey_rear",
        floorAreaM2: 0,
        finishLevel: "standard",
        postcodeDistrict: POSTCODE_LONDON,
      }),
    ).toThrow(/Floor area must be greater than zero/i);
  });

  test("throws when postcode is missing", () => {
    expect(() =>
      calculateExtensionEstimate({
        extensionType: "single_storey_rear",
        floorAreaM2: 20,
        finishLevel: "standard",
        postcodeDistrict: "",
      }),
    ).toThrow(/Postcode district is required/i);
  });

  const extensionTypes = [
    "single_storey_rear",
    "double_storey_rear",
    "side_return",
    "wrap_around",
  ] as const;

  const finishLevels = ["basic", "standard", "premium"] as const;

  test.each(extensionTypes.flatMap((type) => finishLevels.map((finish) => [type, finish] as const)))(
    "returns Low < Typical < High for type=%s finish=%s",
    (extensionType, finishLevel) => {
      const result = calculateExtensionEstimate({
        extensionType,
        floorAreaM2: 25,
        finishLevel,
        postcodeDistrict: POSTCODE_LONDON,
        includeKitchen: false,
        includeBifolds: false,
        includeUnderfloorHeating: false,
      });

      expect(result.totalLow).toBeGreaterThan(0);
      expect(result.totalTypical).toBeGreaterThan(result.totalLow);
      expect(result.totalHigh).toBeGreaterThan(result.totalTypical);
      expect(result.costPerM2.typical).toBeGreaterThan(0);
      expect(result.timeline).toEqual(expect.any(String));
      expect(result.planningNote).toEqual(expect.any(String));
    },
  );

  test("kitchen add-on increases totalTypical", () => {
    const base = calculateExtensionEstimate({
      extensionType: "single_storey_rear",
      floorAreaM2: 25,
      finishLevel: "standard",
      postcodeDistrict: POSTCODE_LONDON,
      includeKitchen: false,
      includeBifolds: false,
      includeUnderfloorHeating: false,
    });

    const withKitchen = calculateExtensionEstimate({
      extensionType: "single_storey_rear",
      floorAreaM2: 25,
      finishLevel: "standard",
      postcodeDistrict: POSTCODE_LONDON,
      includeKitchen: true,
      includeBifolds: false,
      includeUnderfloorHeating: false,
    });

    expect(withKitchen.totalTypical).toBeGreaterThan(base.totalTypical);
    expect(withKitchen.adjustments.some((a) => a.label.toLowerCase().includes("kitchen"))).toBe(true);
  });

  test("bifolds add-on increases totalTypical", () => {
    const base = calculateExtensionEstimate({
      extensionType: "side_return",
      floorAreaM2: 20,
      finishLevel: "basic",
      postcodeDistrict: POSTCODE_LONDON,
      includeKitchen: false,
      includeBifolds: false,
      includeUnderfloorHeating: false,
    });

    const withBifolds = calculateExtensionEstimate({
      extensionType: "side_return",
      floorAreaM2: 20,
      finishLevel: "basic",
      postcodeDistrict: POSTCODE_LONDON,
      includeKitchen: false,
      includeBifolds: true,
      includeUnderfloorHeating: false,
    });

    expect(withBifolds.totalTypical).toBeGreaterThan(base.totalTypical);
    expect(withBifolds.adjustments.some((a) => a.label.toLowerCase().includes("bifold"))).toBe(true);
  });

  test("underfloor heating scales with m²", () => {
    const small = calculateExtensionEstimate({
      extensionType: "wrap_around",
      floorAreaM2: 10,
      finishLevel: "premium",
      postcodeDistrict: POSTCODE_LONDON,
      includeKitchen: false,
      includeBifolds: false,
      includeUnderfloorHeating: true,
    });

    const large = calculateExtensionEstimate({
      extensionType: "wrap_around",
      floorAreaM2: 40,
      finishLevel: "premium",
      postcodeDistrict: POSTCODE_LONDON,
      includeKitchen: false,
      includeBifolds: false,
      includeUnderfloorHeating: true,
    });

    expect(large.totalTypical).toBeGreaterThan(small.totalTypical);
  });

  test("postcode multiplier changes totals (London vs non-London)", () => {
    const london = calculateExtensionEstimate({
      extensionType: "double_storey_rear",
      floorAreaM2: 30,
      finishLevel: "standard",
      postcodeDistrict: POSTCODE_LONDON,
      includeKitchen: false,
      includeBifolds: false,
      includeUnderfloorHeating: false,
    });

    const northwest = calculateExtensionEstimate({
      extensionType: "double_storey_rear",
      floorAreaM2: 30,
      finishLevel: "standard",
      postcodeDistrict: POSTCODE_NORTHWEST,
      includeKitchen: false,
      includeBifolds: false,
      includeUnderfloorHeating: false,
    });

    // This asserts "different" rather than assuming which is higher (in case multipliers change)
    expect(london.totalTypical).not.toEqual(northwest.totalTypical);
  });
});
