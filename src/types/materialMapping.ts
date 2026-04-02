import type { MaterialId } from "./material";
import type { SupplierName } from "./supplier";

/**
 * Conversion rules for supplier products.
 * multiplier is applied to normalized supplier price before estimator usage.
 */
export type MaterialConversionRule = {
  multiplier: number;
};

/**
 * Maps a supplier product to an internal material identifier.
 */
export type MaterialMapping = {
  supplier: SupplierName;
  externalId: string;
  materialId: MaterialId;
  conversion: MaterialConversionRule;
};
