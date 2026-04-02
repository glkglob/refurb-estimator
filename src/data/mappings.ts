import type { MaterialMapping } from "../types/materialMapping";

/**
 * Supplier product to internal material mapping rules.
 */
export const MATERIAL_MAPPINGS: MaterialMapping[] = [
  {
    supplier: "bq",
    externalId: "bq-paint-123",
    materialId: "paint",
    conversion: {
      multiplier: 1
    }
  },
  {
    supplier: "bq",
    externalId: "bq-laminate-456",
    materialId: "laminate_flooring",
    conversion: {
      multiplier: 1
    }
  },
  {
    supplier: "bq",
    externalId: "bq-engineered-wood-789",
    materialId: "engineered_wood",
    conversion: {
      multiplier: 1
    }
  },
  {
    supplier: "bq",
    externalId: "bq-kitchen-001",
    materialId: "kitchen_units",
    conversion: {
      multiplier: 1
    }
  },
  {
    supplier: "bq",
    externalId: "bq-bathroom-002",
    materialId: "bathroom_suite",
    conversion: {
      multiplier: 1
    }
  }
];
