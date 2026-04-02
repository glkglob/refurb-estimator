/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import HomePage from "@/app/page";

const mockCalculateEnhancedEstimate = jest.fn();

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/components/AuthBanner", () => ({
  __esModule: true,
  default: () => <div data-testid="auth-banner" />,
}));

jest.mock("@/components/EstimateResultsFallback", () => ({
  __esModule: true,
  default: () => <div data-testid="estimate-results-fallback" />,
}));

jest.mock("@/components/EstimateForm", () => ({
  __esModule: true,
  default: ({ onSubmit }: { onSubmit: (input: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSubmit({
          region: "east_midlands",
          projectType: "refurb",
          propertyType: "Detached House",
          totalAreaM2: 100,
          condition: "fair",
          finishLevel: "standard",
        })
      }
    >
      Calculate estimate
    </button>
  ),
}));

jest.mock("@/components/ScenarioLimitPromptDialog", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/SaveScenarioModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/TestimonialsSection", () => ({
  __esModule: true,
  default: () => <div data-testid="testimonials" />,
}));

jest.mock("@/components/TrustBanner", () => ({
  __esModule: true,
  default: () => <div data-testid="trust-banner" />,
}));

jest.mock("@/components/EstimateResults", () => ({
  __esModule: true,
  default: ({ result }: { result: { totalTypical: number } }) => (
    <div data-testid="quick-total-typical">{result.totalTypical}</div>
  ),
}));

jest.mock("@/lib/enhancedEstimator", () => ({
  calculateEnhancedEstimate: (...args: unknown[]) =>
    mockCalculateEnhancedEstimate(...args),
  conditionToRenovationScope: () => "standard",
  getFallbackPostcodeDistrict: () => "B1",
  inferPropertyCategory: () => "detached",
}));

describe("Quick Estimator integration", () => {
  test("full labour-cost flow works in Quick Estimator", async () => {
    mockCalculateEnhancedEstimate.mockReturnValue({
      totalLow: 100000,
      totalTypical: 120000,
      totalHigh: 140000,
      costPerM2: { low: 1000, typical: 1200, high: 1400 },
      categories: [
        { category: "kitchen", low: 20000, typical: 25000, high: 30000 },
        { category: "fees", low: 8000, typical: 10000, high: 12000 },
      ],
      baseRenovation: { low: 0, typical: 0, high: 0 },
      additionalFeatureCosts: [],
      adjustments: [],
      contingencyPercent: 10,
      feesPercent: 8,
      region: "east_midlands",
      metadata: {
        postcodeDistrict: "B1",
        propertyCategory: "detached",
        renovationScope: "standard",
        qualityTier: "standard",
        listedBuilding: false,
        estimatedAt: "2026-04-02T00:00:00.000Z",
      },
    });

    const user = userEvent.setup();
    render(<HomePage />);

    await user.selectOptions(screen.getByLabelText(/trade/i), "electrician");
    fireEvent.change(screen.getByLabelText(/days/i), {
      target: { value: "3" },
    });
    await user.selectOptions(screen.getByLabelText(/^region$/i), "london");

    await user.click(screen.getByRole("button", { name: /calculate estimate/i }));

    const labourSummary = await screen.findByText(/Labour estimate:/i);
    expect(labourSummary).toHaveTextContent(/£\s*1,170/i);
    expect(labourSummary).toHaveTextContent(/£\s*1,950/i);
    expect(labourSummary).toHaveTextContent(/typical:\s*£\s*1,560/i);
    expect(
      screen.getByText(/Rates sourced from Checkatrade & industry aggregators, April 2026/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("quick-total-typical")).toHaveTextContent("121560");
  });
});
