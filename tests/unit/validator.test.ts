import { estimateInputSchema } from "@/schemas/estimate";
import { isValidationError, validate } from "@/utils/validator";

describe("utils/validator", () => {
  test("returns typed data for valid input", () => {
    const parsed = validate(
      {
        area: 75,
        region: "london",
      },
      estimateInputSchema,
    );

    expect(parsed.area).toBe(75);
    expect(parsed.region).toBe("london");
  });

  test("throws ValidationError for area <= 0", () => {
    try {
      validate(
        {
          area: 0,
          region: "london",
        },
        estimateInputSchema,
      );
      throw new Error("Expected validator to throw");
    } catch (error) {
      expect(isValidationError(error)).toBe(true);

      if (isValidationError(error)) {
        expect(error.code).toBe("VALIDATION_ERROR");
        expect(error.issues.some((issue) => issue.path.includes("area"))).toBe(true);
      }
    }
  });

  test("throws ValidationError for missing region", () => {
    try {
      validate(
        {
          area: 50,
          region: "   ",
        },
        estimateInputSchema,
      );
      throw new Error("Expected validator to throw");
    } catch (error) {
      expect(isValidationError(error)).toBe(true);

      if (isValidationError(error)) {
        expect(error.code).toBe("VALIDATION_ERROR");
        expect(error.issues.some((issue) => issue.path.includes("region"))).toBe(true);
      }
    }
  });
});
