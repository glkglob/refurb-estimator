/**
 * Supported supplier identifiers.
 */
export const SUPPLIER_NAMES = ["bq"] as const;

export type SupplierName = (typeof SUPPLIER_NAMES)[number];

export const SUPPLIER_UNITS = ["item", "m2", "litre", "pack"] as const;

export type SupplierUnit = (typeof SUPPLIER_UNITS)[number];

/**
 * Normalized supplier product price row.
 */
export type SupplierPrice = {
  supplier: SupplierName;
  externalId: string;
  productName: string;
  price: number;
  unit: SupplierUnit;
  coverage?: number;
  size?: number;
  url: string;
  updatedAt: string;
};
