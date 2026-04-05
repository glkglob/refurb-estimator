export type Tier = "low" | "typical" | "high";
export type TierAmounts = Record<Tier, number>;

export const TIERS: Tier[] = ["low", "typical", "high"];

export function emptyTierAmounts(): TierAmounts {
    return { low: 0, typical: 0, high: 0 };
}

export function multiplyTier(amounts: TierAmounts, multiplier: number): TierAmounts {
    return {
        low: amounts.low * multiplier,
        typical: amounts.typical * multiplier,
        high: amounts.high * multiplier,
    };
}

export function addTier(a: TierAmounts, b: TierAmounts): TierAmounts {
    return {
        low: a.low + b.low,
        typical: a.typical + b.typical,
        high: a.high + b.high,
    };
}