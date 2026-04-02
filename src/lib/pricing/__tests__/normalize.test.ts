import { normalizeToUnitPrice } from "../normalize";
import type { SupplierPrice } from "../../../types/supplier";

function buildSupplierPrice(overrides: Partial<SupplierPrice> = {}): SupplierPrice {
  return {
    supplier: "bq",
    externalId: "bq-test-1",
    productName: "Test Product",
    price: 24,
    unit: "item",
    url: "https://example.com/product",
    updatedAt: "2026-04-02T12:00:00.000Z",
    ...overrides
  };
}

describe("normalizeToUnitPrice", () => {
  test("returns £/m2 when coverage and size are provided", () => {
    const supplierPrice = buildSupplierPrice({
      price: 42,
      coverage: 2,
      size: 3
    });

    expect(normalizeToUnitPrice(supplierPrice)).toBe(7);
  });

  test("returns raw rounded price when coverage and size are missing", () => {
    const supplierPrice = buildSupplierPrice({ price: 19.995 });

    expect(normalizeToUnitPrice(supplierPrice)).toBe(20);
  });

  test("avoids division by zero and returns raw price", () => {
    const supplierPrice = buildSupplierPrice({
      price: 35,
      coverage: 0,
      size: 2
    });

    expect(normalizeToUnitPrice(supplierPrice)).toBe(35);
  });

  test("returns 0 for invalid raw price values", () => {
    const supplierPrice = buildSupplierPrice({ price: Number.NaN });

    expect(normalizeToUnitPrice(supplierPrice)).toBe(0);
  });
});
