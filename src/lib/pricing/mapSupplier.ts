import { MATERIAL_MAPPINGS } from "../../data/mappings";
import type { MaterialConversionRule, MaterialMapping } from "../../types/materialMapping";
import type { MaterialId } from "../../types/material";
import type { SupplierName } from "../../types/supplier";

export type SupplierMaterialMatch = {
  materialId: MaterialId;
  conversion: MaterialConversionRule;
};

function findMapping(
  supplier: SupplierName,
  externalId: string
): MaterialMapping | undefined {
  return MATERIAL_MAPPINGS.find(
    (mapping) => mapping.supplier === supplier && mapping.externalId === externalId
  );
}

/**
 * Resolves a supplier product identifier to an internal material mapping.
 */
export function mapSupplierProduct(
  supplier: SupplierName,
  externalId: string
): SupplierMaterialMatch | null {
  const mapping = findMapping(supplier, externalId);
  if (!mapping) {
    return null;
  }

  return {
    materialId: mapping.materialId,
    conversion: mapping.conversion
  };
}
