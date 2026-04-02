import { MATERIALS } from "../../data/materials";
import type { MaterialId, MaterialPriceBand } from "../../types/material";

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Returns supplier-overridden price when available; otherwise falls back to internal material pricing.
 */
export function getEffectivePrice(
  materialId: MaterialId,
  spec: MaterialPriceBand,
  supplierPrice?: number | null
): number {
  if (typeof supplierPrice === "number" && Number.isFinite(supplierPrice) && supplierPrice > 0) {
    return roundCurrency(supplierPrice);
  }

  const material = MATERIALS.find((candidate) => candidate.id === materialId);
  if (!material) {
    throw new Error(`Material not found: ${materialId}`);
  }

  return roundCurrency(material.price[spec]);
}
