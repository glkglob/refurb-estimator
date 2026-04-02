import {
  calculateLoft,
  calculateNewBuild,
  loadRegionParameters,
  type RegionParametersRow
} from "./calculations";

type RegionRows = Record<string, RegionParametersRow>;

function createRegionClient(rows: RegionRows) {
  const from = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockImplementation((_field: string, region: string) => ({
        maybeSingle: async () => ({
          data: rows[region] ?? null,
          error: null
        })
      }))
    })
  });

  return { from };
}

describe("services/calculations", () => {
  const regionRows: RegionRows = {
    london: {
      region: "london",
      loft_cost_multiplier: "1.28",
      new_build_cost_multiplier: "1.24",
      tax_rate: "0.2",
      building_code_rate: "0.03",
      contingency_rate: "0.1",
      management_fee_rate: "0.09"
    },
    west_midlands: {
      region: "west_midlands",
      loft_cost_multiplier: "1.0",
      new_build_cost_multiplier: "1.0",
      tax_rate: "0.2",
      building_code_rate: "0.025",
      contingency_rate: "0.08",
      management_fee_rate: "0.075"
    },
    scotland: {
      region: "scotland",
      loft_cost_multiplier: "1.12",
      new_build_cost_multiplier: "1.08",
      tax_rate: "0.2",
      building_code_rate: "0.028",
      contingency_rate: "0.09",
      management_fee_rate: "0.08"
    }
  };

  test("loads region parameters from Supabase row values", async () => {
    const mockClient = createRegionClient(regionRows) as unknown as Parameters<
      typeof loadRegionParameters
    >[1];

    const result = await loadRegionParameters("london", mockClient);

    expect(result.region).toBe("london");
    expect(result.loftCostMultiplier).toBeCloseTo(1.28, 5);
    expect(result.newBuildCostMultiplier).toBeCloseTo(1.24, 5);
    expect(result.taxRate).toBeCloseTo(0.2, 5);
  });

  test("calculates loft totals across three regions with GBP formatting", async () => {
    const client = createRegionClient(regionRows) as unknown as Parameters<typeof calculateLoft>[2];

    const london = await calculateLoft(
      {
        floorAreaM2: 45,
        complexity: "complex",
        includeEnSuite: true,
        dormerCount: 2
      },
      "london",
      client
    );
    const westMidlands = await calculateLoft(
      {
        floorAreaM2: 45,
        complexity: "complex",
        includeEnSuite: true,
        dormerCount: 2
      },
      "west_midlands",
      client
    );
    const scotland = await calculateLoft(
      {
        floorAreaM2: 45,
        complexity: "complex",
        includeEnSuite: true,
        dormerCount: 2
      },
      "scotland",
      client
    );

    expect(london.total).toBeGreaterThan(scotland.total);
    expect(scotland.total).toBeGreaterThan(westMidlands.total);
    expect(london.totalGbp).toMatch(/^£\d{1,3}(,\d{3})*(\.\d{2})$/);
    expect(london.breakdown.every((item) => /^£\d{1,3}(,\d{3})*(\.\d{2})$/.test(item.amountGbp))).toBe(
      true
    );
  });

  test("calculates new-build totals across three regions with realistic ordering", async () => {
    const client = createRegionClient(regionRows) as unknown as Parameters<typeof calculateNewBuild>[2];

    const london = await calculateNewBuild(
      {
        floorAreaM2: 180,
        storeys: 2,
        bedrooms: 4,
        specification: "premium",
        includeGarage: true
      },
      "london",
      client
    );
    const westMidlands = await calculateNewBuild(
      {
        floorAreaM2: 180,
        storeys: 2,
        bedrooms: 4,
        specification: "premium",
        includeGarage: true
      },
      "west_midlands",
      client
    );
    const scotland = await calculateNewBuild(
      {
        floorAreaM2: 180,
        storeys: 2,
        bedrooms: 4,
        specification: "premium",
        includeGarage: true
      },
      "scotland",
      client
    );

    expect(london.total).toBeGreaterThan(scotland.total);
    expect(scotland.total).toBeGreaterThan(westMidlands.total);
    expect(london.subtotal).toBeGreaterThan(0);
    expect(london.breakdown.length).toBeGreaterThanOrEqual(10);
  });

  test("throws when region parameters are missing", async () => {
    const client = createRegionClient(regionRows) as unknown as Parameters<typeof calculateLoft>[2];

    await expect(
      calculateLoft(
        {
          floorAreaM2: 30,
          complexity: "standard",
          includeEnSuite: false,
          dormerCount: 1
        },
        "north_east",
        client
      )
    ).rejects.toThrow("Region parameters not found for region: north_east");
  });
});
