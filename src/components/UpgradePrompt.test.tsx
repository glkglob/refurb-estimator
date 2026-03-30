/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import UpgradePrompt from "./UpgradePrompt";

function jsonResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => payload
  } as Response;
}

describe("UpgradePrompt", () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeAll(() => {
    if (!("fetch" in global)) {
      Object.defineProperty(global, "fetch", {
        configurable: true,
        writable: true,
        value: jest.fn()
      });
    }
  });

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test("renders upgrade details for users below the required plan", () => {
    render(
      <UpgradePrompt
        featureName="Refine estimate scope builder"
        currentPlan="free"
        requiredPlan="pro"
      />
    );

    expect(screen.getByText("Refine estimate scope builder")).toBeInTheDocument();
    expect(screen.getByText("Unlock this feature with the Pro plan.")).toBeInTheDocument();
    expect(screen.getByText("Required plan")).toBeInTheDocument();
    expect(screen.getByText("Current plan: Free")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade to Pro" })).toBeEnabled();
    expect(screen.queryByText("Feature locked")).not.toBeInTheDocument();
  });

  test("does not render when the current plan already includes the feature", () => {
    const { container } = render(
      <UpgradePrompt
        featureName="Refine estimate scope builder"
        currentPlan="agency"
        requiredPlan="pro"
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  test("starts checkout with the required plan and billing period", async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValue(jsonResponse({ url: "https://checkout.stripe.com/c/pay/cs_test_123" }));

    render(
      <UpgradePrompt
        featureName="Refine estimate scope builder"
        currentPlan="free"
        requiredPlan="pro"
      />
    );

    await user.click(screen.getByRole("button", { name: "Upgrade to Pro" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/stripe/checkout",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      plan: "pro",
      period: "monthly"
    });

  });

  test("shows an alert when checkout creation fails", async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValue(jsonResponse({ error: "Unable to start checkout." }, false, 500));

    render(
      <UpgradePrompt
        featureName="Refine estimate scope builder"
        currentPlan="free"
        requiredPlan="pro"
      />
    );

    await user.click(screen.getByRole("button", { name: "Upgrade to Pro" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to start checkout.");
  });
});
