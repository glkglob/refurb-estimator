import type { SupplierPrice } from "../../types/supplier";

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Normalizes a supplier product to a unit price in GBP.
 * If both coverage and size are present and valid, returns £/m².
 * Otherwise returns the raw supplier price.
 */
export function normalizeToUnitPrice(supplierPrice: SupplierPrice): number {
  const rawPrice = Number(supplierPrice.price);
  if (!Number.isFinite(rawPrice) || rawPrice < 0) {
    return 0;
  }

  const coverage = supplierPrice.coverage;
  const size = supplierPrice.size;

  if (
    typeof coverage === "number" &&
    typeof size === "number" &&
    Number.isFinite(coverage) &&
    Number.isFinite(size) &&
    coverage > 0 &&
    size > 0
  ) {
    return roundCurrency(rawPrice / (coverage * size));
  }

  return roundCurrency(rawPrice);
}
