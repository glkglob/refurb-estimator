import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UpgradePrompt } from "./UpgradePrompt";
import { apiFetch } from "@/lib/apiClient";

jest.mock("@/lib/apiClient");

describe("UpgradePrompt", () => {
  it("redirects to Stripe checkout URL on success", async () => {
    const redirectMock = jest.fn();

    (apiFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        url: "https://checkout.stripe.com/c/pay/cs_test_123",
      }),
    });

    render(
      <UpgradePrompt
        requiredPlan="pro"
        currentPlan="free"
        redirectTo={redirectMock}
      />
    );

    fireEvent.click(screen.getByText(/upgrade/i));

    await waitFor(() => {
      expect(redirectMock).toHaveBeenCalledWith(
        "https://checkout.stripe.com/c/pay/cs_test_123"
      );
    });

    expect(apiFetch).toHaveBeenCalledWith(
      "/api/stripe/checkout",
      expect.objectContaining({
        method: "POST",
      })
    );

    const [, init] = (apiFetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      plan: "pro",
      period: "monthly",
    });

  });

  it("shows error when checkout fails", async () => {
    (apiFetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Unable to start checkout." }),
    });

    render(<UpgradePrompt requiredPlan="pro" currentPlan="free" />);

    fireEvent.click(screen.getByText(/upgrade/i));

    await waitFor(() => {
      expect(screen.getByText("Unable to start checkout.")).toBeTruthy();
    });
  });
});
