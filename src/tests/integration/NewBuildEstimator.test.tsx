/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import NewBuildPage from "@/app/new-build/page";

const mockCalculateNewBuild = jest.fn();

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/components/EstimateAssistantPanel", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/ShareEstimateModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/NewBuildResults", () => ({
  __esModule: true,
  default: ({ result }: { result: { totalTypical: number } }) => (
    <div data-testid="new-build-total-typical">{result.totalTypical}</div>
  ),
}));

jest.mock("@/lib/newBuildEstimator", () => ({
  calculateNewBuild: (...args: unknown[]) => mockCalculateNewBuild(...args),
}));

describe("New Build integration", () => {
  test("full labour-cost flow works in New Build Estimator", async () => {
    mockCalculateNewBuild.mockReturnValue({
      totalLow: 250000,
      totalTypical: 300000,
      totalHigh: 360000,
      costPerM2: { low: 2083, typical: 2500, high: 3000 },
      categories: [
        { category: "substructure", low: 30000, typical: 40000, high: 50000 },
        {
          category: "professional_fees",
          low: 20000,
          typical: 25000,
          high: 30000,
        },
      ],
      adjustments: [],
      contingencyPercent: 10,
      feesPercent: 12,
      region: "east_midlands",
      metadata: {
        propertyType: "Detached House",
        spec: "standard",
        bedrooms: 3,
        storeys: 2,
        postcodeDistrict: "LS1",
        estimatedAt: "2026-04-02T00:00:00.000Z",
      },
    });

    const user = userEvent.setup();
    render(<NewBuildPage />);

    await user.type(screen.getByLabelText(/postcode district/i), "LS1");
    await user.selectOptions(screen.getByLabelText(/trade/i), "electrician");
    fireEvent.change(screen.getByLabelText(/days/i), {
      target: { value: "3" },
    });
    await user.selectOptions(
      screen.getByLabelText(/^region$/i),
      "london",
    );

    await user.click(screen.getByRole("button", { name: /calculate estimate/i }));

    const labourSummary = await screen.findByText(/Labour estimate:/i);
    expect(labourSummary).toHaveTextContent(/£\s*1,170/i);
    expect(labourSummary).toHaveTextContent(/£\s*1,950/i);
    expect(labourSummary).toHaveTextContent(/typical:\s*£\s*1,560/i);
    expect(
      screen.getByText(/Rates sourced from Checkatrade & industry aggregators, April 2026/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("new-build-total-typical")).toHaveTextContent("301560");
  });
});
