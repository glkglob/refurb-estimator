import type {
  Condition,
  CostLibrary,
  FinishLevel,
  Region
} from "./types";

export const defaultCostLibrary: CostLibrary = {
  baseRefurbPerM2: {
    low: 1000,
    typical: 1800,
    high: 3200
  },
  regionalMultipliers: {
    London: 1.25,
    SouthEast: 1.15,
    Midlands: 1.0,
    North: 0.9,
    Scotland: 0.95,
    Wales: 0.95
  },
  conditionMultipliers: {
    poor: 1.3,
    fair: 1.0,
    good: 0.8
  },
  finishMultipliers: {
    budget: 0.75,
    standard: 1.0,
    premium: 1.5
  },
  categoryPercents: {
    kitchen: 0.18,
    bathroom: 0.15,
    electrics: 0.1,
    plumbing: 0.08,
    heating: 0.08,
    windows: 0.06,
    doors: 0.03,
    plastering: 0.05,
    decoration: 0.07,
    flooring: 0.08,
    contingency: 0.07,
    fees: 0.05
  },
  roomBaseRanges: {
    kitchen: { low: 300, typical: 600, high: 1200 },
    bathroom: { low: 350, typical: 700, high: 1400 },
    bedroom: { low: 80, typical: 150, high: 300 },
    living: { low: 100, typical: 180, high: 350 },
    hallway: { low: 60, typical: 120, high: 250 },
    utility: { low: 200, typical: 400, high: 800 }
  },
  roomCategoryAllocations: {
    kitchen: {
      kitchen: 0.4,
      electrics: 0.15,
      plumbing: 0.15,
      flooring: 0.1,
      plastering: 0.08,
      decoration: 0.05,
      contingency: 0.05,
      fees: 0.02
    },
    bathroom: {
      bathroom: 0.4,
      plumbing: 0.2,
      electrics: 0.1,
      flooring: 0.1,
      plastering: 0.08,
      decoration: 0.05,
      contingency: 0.05,
      fees: 0.02
    },
    bedroom: {
      decoration: 0.35,
      flooring: 0.25,
      electrics: 0.1,
      plastering: 0.15,
      windows: 0.05,
      doors: 0.03,
      contingency: 0.05,
      fees: 0.02
    },
    living: {
      decoration: 0.3,
      flooring: 0.25,
      electrics: 0.1,
      plastering: 0.15,
      heating: 0.08,
      windows: 0.05,
      contingency: 0.05,
      fees: 0.02
    },
    hallway: {
      flooring: 0.35,
      decoration: 0.25,
      plastering: 0.15,
      electrics: 0.1,
      doors: 0.05,
      contingency: 0.05,
      fees: 0.05
    },
    utility: {
      plumbing: 0.3,
      electrics: 0.2,
      flooring: 0.15,
      plastering: 0.1,
      decoration: 0.1,
      heating: 0.05,
      contingency: 0.05,
      fees: 0.05
    }
  }
};

export function getRegionalMultiplier(
  region: Region,
  costLibrary: CostLibrary = defaultCostLibrary
): number {
  return costLibrary.regionalMultipliers[region];
}

export function getConditionMultiplier(
  condition: Condition,
  costLibrary: CostLibrary = defaultCostLibrary
): number {
  return costLibrary.conditionMultipliers[condition];
}

export function getFinishMultiplier(
  finish: FinishLevel,
  costLibrary: CostLibrary = defaultCostLibrary
): number {
  return costLibrary.finishMultipliers[finish];
}
