import type {
  Condition,
  CostLibrary,
  FinishLevel,
  Region
} from "./types";

export const defaultCostLibrary: CostLibrary = {
  baseRefurbPerM2: {
    low: 1200,
    typical: 1800,
    high: 2800
  },
  regionalMultipliers: {
    London: 1.35,
    SouthEast: 1.2,
    EastOfEngland: 1.12,
    EastMidlands: 0.98,
    WestMidlands: 1.0,
    SouthWest: 1.05,
    NorthWest: 0.92,
    NorthEast: 0.87,
    YorkshireAndTheHumber: 0.9,
    Scotland: 0.94,
    Wales: 0.9,
    NorthernIreland: 0.82
  },
  conditionMultipliers: {
    poor: 1.3,
    fair: 1.0,
    good: 0.8
  },
  finishMultipliers: {
    budget: 0.7,
    standard: 1.0,
    premium: 1.55
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
    kitchen: { low: 350, typical: 650, high: 1300 },
    bathroom: { low: 400, typical: 750, high: 1500 },
    bedroom: { low: 100, typical: 180, high: 350 },
    living: { low: 120, typical: 200, high: 400 },
    hallway: { low: 80, typical: 140, high: 280 },
    utility: { low: 250, typical: 450, high: 900 }
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
