import type {
  CategoryRange,
  Condition,
  EstimateCategory,
  FinishLevel,
  Region,
  RoomType
} from "./types";

export type CostLibrary = {
  baseRefurbPerM2: CategoryRange;
  categoryPercents: Record<EstimateCategory, number>;
  regionalMultipliers: Record<Region, number>;
  finishMultipliers: Record<FinishLevel, number>;
  conditionMultipliers: Record<Condition, number>;
  roomBaseRanges?: Record<RoomType, CategoryRange>;
};

export const costLibrary: CostLibrary = {
  baseRefurbPerM2: {
    low: 1000,
    typical: 1800,
    high: 3200
  },
  categoryPercents: {
    kitchen: 0.19,
    bathrooms: 0.14,
    electrics: 0.11,
    heating: 0.1,
    plastering: 0.1,
    windows: 0.09,
    decoration: 0.15,
    contingency: 0.07,
    fees: 0.05
  },
  regionalMultipliers: {
    London: 1.25,
    SouthEast: 1.15,
    Midlands: 1,
    North: 0.9,
    Scotland: 0.95,
    Wales: 0.95
  },
  finishMultipliers: {
    budget: 0.9,
    standard: 1,
    premium: 1.3
  },
  conditionMultipliers: {
    poor: 1.2,
    fair: 1,
    good: 0.9
  },
  roomBaseRanges: {
    kitchen: { low: 8000, typical: 15000, high: 30000 },
    bathroom: { low: 5000, typical: 9000, high: 18000 },
    bedroom: { low: 2500, typical: 5000, high: 10000 },
    living: { low: 3000, typical: 7000, high: 14000 },
    hallway: { low: 1500, typical: 3500, high: 7500 },
    exterior: { low: 4000, typical: 10000, high: 25000 }
  }
};
