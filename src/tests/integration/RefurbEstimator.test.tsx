/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import RoomsPage from "@/app/rooms/page";

const mockEstimateRooms = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/components/AuthBanner", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/EstimateAssistantPanel", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/ScenarioLimitPromptDialog", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/SaveScenarioModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/ShareEstimateModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/TermTooltip", () => ({
  __esModule: true,
  default: ({ term }: { term: string }) => <span>{term}</span>,
}));

jest.mock("@/components/ValueUpliftCard", () => ({
  __esModule: true,
  ValueUpliftCard: () => null,
}));

jest.mock("@/components/EstimateResults", () => ({
  __esModule: true,
  default: ({ result }: { result: { totalTypical: number } }) => (
    <div data-testid="refurb-total-typical">{result.totalTypical}</div>
  ),
}));

jest.mock("@/lib/estimator", () => ({
  estimateRooms: (...args: unknown[]) => mockEstimateRooms(...args),
}));

describe("Refurbishment estimator integration", () => {
  test("full labour-cost flow works in Refurbishment Estimator", async () => {
    mockEstimateRooms.mockReturnValue({
      totalLow: 80000,
      totalTypical: 100000,
      totalHigh: 120000,
      costPerM2: { low: 1000, typical: 1200, high: 1400 },
      categories: [
        { category: "kitchen", low: 20000, typical: 25000, high: 30000 },
        { category: "fees", low: 9000, typical: 10000, high: 12000 },
      ],
    });

    const user = userEvent.setup();
    render(<RoomsPage />);

    await user.selectOptions(screen.getByLabelText(/trade/i), "electrician");
    fireEvent.change(screen.getByLabelText(/days/i), {
      target: { value: "3" },
    });
    await user.selectOptions(
      screen.getByLabelText(/^region$/i, { selector: "select#rooms-labour-region" }),
      "london",
    );

    await waitFor(() => {
      expect(screen.getByText(/Labour estimate:/i)).toHaveTextContent(
        /typical:\s*£\s*1,560/i,
      );
    });
    const labourSummary = screen.getByText(/Labour estimate:/i);
    expect(labourSummary).toHaveTextContent(/£\s*1,170/i);
    expect(labourSummary).toHaveTextContent(/£\s*1,950/i);
    expect(
      screen.getByText(/Rates sourced from Checkatrade & industry aggregators, April 2026/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("refurb-total-typical")).toHaveTextContent("101560");
  });
});
