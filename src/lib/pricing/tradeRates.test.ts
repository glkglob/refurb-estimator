import {
  estimateLabourCost,
  getTradeRate,
  TRADE_RATES,
} from "@/lib/pricing/tradeRates";

describe("Trade Rates Module", () => {
  test("getTradeRate returns correct object for a valid id", () => {
    const rate = getTradeRate("electrician");
    expect(rate.id).toBe("electrician");
    expect(rate.label).toBe("Electrician");
  });

  test("getTradeRate throws for unknown id", () => {
    expect(() => getTradeRate("unknown_trade")).toThrow(/No trade rate found/);
  });

  test("estimateLabourCost uses a 1.00 multiplier for midlands (default)", () => {
    const { low, high } = estimateLabourCost("plumber", 2);
    const base = TRADE_RATES.find((tradeRate) => tradeRate.id === "plumber");

    expect(base).toBeDefined();
    expect(low).toBe(Math.round((base?.dayRateMin ?? 0) * 2));
    expect(high).toBe(Math.round((base?.dayRateMax ?? 0) * 2));
  });

  test("estimateLabourCost inflates correctly for London", () => {
    const { low, high } = estimateLabourCost("plumber", 2, "london");
    const base = TRADE_RATES.find((tradeRate) => tradeRate.id === "plumber");

    expect(base).toBeDefined();
    const multiplier = base?.regionalMultiplier.london ?? 1;
    expect(low).toBe(Math.round((base?.dayRateMin ?? 0) * multiplier * 2));
    expect(high).toBe(Math.round((base?.dayRateMax ?? 0) * multiplier * 2));
  });

  test("estimateLabourCost rounds to whole pounds", () => {
    const { low, mid, high } = estimateLabourCost("electrician", 1, "north_east");
    expect(low % 1).toBe(0);
    expect(mid % 1).toBe(0);
    expect(high % 1).toBe(0);
  });

  test("All TRADE_RATES entries contain required fields", () => {
    TRADE_RATES.forEach((tradeRate) => {
      expect(tradeRate).toHaveProperty("id");
      expect(tradeRate).toHaveProperty("label");
      expect(tradeRate).toHaveProperty("dayRateMin");
      expect(tradeRate).toHaveProperty("dayRateMax");
      expect(tradeRate).toHaveProperty("regionalMultiplier");
      expect(Object.keys(tradeRate.regionalMultiplier)).toHaveLength(12);
    });
  });
});
