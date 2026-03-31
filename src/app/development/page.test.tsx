/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import DevelopmentAppraisalPage from "./page";

jest.mock("@/components/AuthGate", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>
}));

jest.mock("@/lib/supabase/client", () => {
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: { plan: "pro" },
      error: null
    })
  };

  return {
    __esModule: true,
    createClientSafely: jest.fn(() => ({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "test-user-id" } },
          error: null
        }),
        onAuthStateChange: jest.fn(() => ({
          data: {
            subscription: {
              unsubscribe: jest.fn()
            }
          }
        }))
      },
      from: jest.fn(() => queryBuilder)
    }))
  };
});

jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() })
}));

jest.mock("@/lib/share", () => ({
  shareOrCopy: jest.fn()
}));

async function setNumericField(
  user: ReturnType<typeof userEvent.setup>,
  label: RegExp,
  value: string
): Promise<void> {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  if (value !== "") {
    await user.type(input, value);
  }
}

async function setSimpleScenario(
  user: ReturnType<typeof userEvent.setup>,
  grossDevelopmentValue: string
): Promise<void> {
  await setNumericField(user, /Purchase price/i, "100000");
  await setNumericField(user, /Legal fees \(acquisition\)/i, "0");
  await setNumericField(user, /Build \/ refurb costs/i, "0");
  await setNumericField(user, /Professional fees/i, "0");
  await setNumericField(user, /Planning costs/i, "0");
  await setNumericField(user, /Contingency/i, "0");
  await setNumericField(user, /Target profit margin/i, "20");
  await setNumericField(user, /Gross Development Value \(GDV\)/i, grossDevelopmentValue);
  await setNumericField(user, /Legal fees \(sale\)/i, "0");
  await setNumericField(user, /Estate agent fee/i, "0");

  const includeFinance = screen.getByRole("checkbox", { name: /Include finance costs/i });
  if ((includeFinance as HTMLInputElement).checked) {
    await user.click(includeFinance);
  }
}

function submitForm(): void {
  const calculateButton = screen.getByRole("button", { name: /Calculate appraisal/i });
  const form = calculateButton.closest("form");
  expect(form).not.toBeNull();
  if (form) {
    fireEvent.submit(form);
  }
}

describe("DevelopmentAppraisalPage", () => {
  test("runs a minimum valid journey and renders assumptions, summary, and viability", async () => {
    const user = userEvent.setup();
    render(<DevelopmentAppraisalPage />);

    expect(screen.getByText("Assumptions")).toBeInTheDocument();
    expect(
      screen.getByText(/SDLT uses 2025\/26 residential bands plus the 3% additional property surcharge/i)
    ).toBeInTheDocument();

    await setSimpleScenario(user, "128750");
    submitForm();

    expect(await screen.findByText("Summary")).toBeInTheDocument();
    expect(screen.getByText("Total costs")).toBeInTheDocument();
    expect(screen.getByText("Gross profit")).toBeInTheDocument();
    expect(screen.getByText("🟢 Viable")).toBeInTheDocument();
  });

  test("marks core inputs as required", async () => {
    await act(async () => {
      render(<DevelopmentAppraisalPage />);
    });

    expect(screen.getByLabelText(/Purchase price/i)).toBeRequired();
    expect(screen.getByLabelText(/Gross Development Value \(GDV\)/i)).toBeRequired();
  });

  test("supports expanding and collapsing the optional finance section", async () => {
    await act(async () => {
      render(<DevelopmentAppraisalPage />);
    });

    const summary = screen.getByText("Finance (optional)");
    const details = summary.closest("details");

    expect(details).not.toBeNull();
    expect(details).toHaveAttribute("open");

    if (details) {
      details.open = false;
      fireEvent(details, new Event("toggle"));
      expect(details).not.toHaveAttribute("open");

      details.open = true;
      fireEvent(details, new Event("toggle"));
      expect(details).toHaveAttribute("open");
    }
  });

  test("renders the viable badge for scenarios at or above target margin", async () => {
    const user = userEvent.setup();
    render(<DevelopmentAppraisalPage />);

    await setSimpleScenario(user, "128750");
    submitForm();

    expect(await screen.findByText("🟢 Viable")).toBeInTheDocument();
  });

  test("renders the marginal badge for scenarios within 5% below target", async () => {
    const user = userEvent.setup();
    render(<DevelopmentAppraisalPage />);

    await setSimpleScenario(user, "121176.47");
    submitForm();

    expect(await screen.findByText("🟡 Marginal")).toBeInTheDocument();
  });

  test("renders the unviable badge for scenarios more than 5% below target", async () => {
    const user = userEvent.setup();
    render(<DevelopmentAppraisalPage />);

    await setSimpleScenario(user, "120000");
    submitForm();

    expect(await screen.findByText("🔴 Unviable")).toBeInTheDocument();
  });

  test("renders BRRR panel only after a successful calculation", async () => {
    const user = userEvent.setup();
    render(<DevelopmentAppraisalPage />);

    expect(screen.queryByText("BRRR Refinance Check")).not.toBeInTheDocument();

    await screen.findByText("Assumptions");
    await setSimpleScenario(user, "128750");
    submitForm();

    expect(await screen.findByText("BRRR Refinance Check")).toBeInTheDocument();
  });
});
