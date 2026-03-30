/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApiFetchError, apiFetch } from "@/lib/apiClient";

import UpgradePrompt from "./UpgradePrompt";

jest.mock("@/lib/apiClient", () => {
  const actual = jest.requireActual("@/lib/apiClient");

  return {
    ...actual,
    apiFetch: jest.fn()
  };
});

const mockedApiFetch = jest.mocked(apiFetch);

function jsonResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => payload
  } as Response;
}

describe("UpgradePrompt", () => {
  let redirectMock: jest.MockedFunction<(url: string) => void>;

  beforeEach(() => {
    jest.clearAllMocks();
    redirectMock = jest.fn();
  });

  test("shows locked state for free user", () => {
    render(
      <UpgradePrompt
        featureName="refineEstimate"
        currentPlan="free"
        requiredPlan="pro"
        onRedirect={redirectMock}
      />
    );

    expect(screen.getByText("Feature locked")).toBeInTheDocument();
    expect(screen.getByText("Current plan: Free")).toBeInTheDocument();
    expect(screen.getByText("Refine estimate scope builder")).toBeInTheDocument();
    expect(screen.getByText("Selected: Pro (monthly)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade to Pro" })).toBeEnabled();
  });

  test("toggles annual and monthly billing selections", async () => {
    const user = userEvent.setup();

    render(
      <UpgradePrompt
        featureName="pdfExport"
        currentPlan="free"
        requiredPlan="pro"
        onRedirect={redirectMock}
      />
    );

    await user.click(screen.getByRole("button", { name: /Annual/i }));
    expect(screen.getByText("Selected: Pro (annual)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Monthly/i }));
    expect(screen.getByText("Selected: Pro (monthly)")).toBeInTheDocument();
  });

  test("redirects to Stripe checkout URL on success", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValue(
      jsonResponse({ url: "https://checkout.stripe.com/c/pay/cs_test_123" })
    );

    render(
      <UpgradePrompt
        featureName="refineEstimate"
        currentPlan="free"
        requiredPlan="pro"
        onRedirect={redirectMock}
      />
    );

    await user.click(screen.getByRole("button", { name: "Upgrade to Pro" }));

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith(
        "/api/stripe/checkout",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    const [, init] = mockedApiFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      plan: "pro",
      period: "monthly"
    });

    await waitFor(() => {
      expect(redirectMock).toHaveBeenCalledWith(
        "https://checkout.stripe.com/c/pay/cs_test_123"
      );
    });
  });

  test("shows API error message when checkout fails", async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockRejectedValue(
      new ApiFetchError("No active Stripe price for selected billing period", 400, "/api/stripe/checkout")
    );

    render(
      <UpgradePrompt
        featureName="csvExport"
        currentPlan="free"
        requiredPlan="pro"
        onRedirect={redirectMock}
      />
    );

    await user.click(screen.getByRole("button", { name: "Upgrade to Pro" }));

    await waitFor(() => {
      expect(
        screen.getByText("No active Stripe price for selected billing period")
      ).toBeInTheDocument();
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  test("disables checkout when feature is already unlocked", async () => {
    const user = userEvent.setup();

    render(
      <UpgradePrompt
        featureName="refineEstimate"
        currentPlan="agency"
        requiredPlan="pro"
        onRedirect={redirectMock}
      />
    );

    const ctaButton = screen.getByRole("button", { name: "Included in your plan" });

    expect(ctaButton).toBeDisabled();
    await user.click(ctaButton);
    expect(mockedApiFetch).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
