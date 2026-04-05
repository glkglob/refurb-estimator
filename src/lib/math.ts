/**
 * Shared math and validation utilities.
 */

export function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

export function assertFinitePositive(value: number, name: string): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${name} must be a finite number greater than 0`);
    }
}

export function assertFiniteNonNegative(value: number, name: string): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${name} must be a finite number greater than or equal to 0`);
    }
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}