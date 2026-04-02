import type { Material } from "../types/material";

/**
 * Base internal material pricing used when no supplier override is available.
 * All values are GBP.
 */
export const MATERIALS: Material[] = [
  {
    id: "laminate_flooring",
    name: "Laminate flooring",
    unit: "m2",
    price: {
      low: 15,
      mid: 28,
      high: 45
    }
  },
  {
    id: "engineered_wood",
    name: "Engineered wood flooring",
    unit: "m2",
    price: {
      low: 40,
      mid: 75,
      high: 120
    }
  },
  {
    id: "paint",
    name: "Interior paint",
    unit: "m2",
    price: {
      low: 2,
      mid: 4.5,
      high: 7
    }
  },
  {
    id: "kitchen_units",
    name: "Kitchen units set",
    unit: "project",
    price: {
      low: 1500,
      mid: 5500,
      high: 10000
    }
  },
  {
    id: "bathroom_suite",
    name: "Bathroom suite",
    unit: "project",
    price: {
      low: 800,
      mid: 2800,
      high: 6000
    }
  }
];
