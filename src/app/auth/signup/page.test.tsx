/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import SignupPage from "./page";
import {
  createClientSafely,
  SUPABASE_CLIENT_UNAVAILABLE_MESSAGE
} from "@/lib/supabase/client";

jest.mock("@/components/auth/AuthValueProposition", () => ({
  __esModule: true,
  default: () => <div data-testid="auth-value-proposition">Auth value proposition</div>
}));

jest.mock("@/lib/supabase/client", () => ({
  createClientSafely: jest.fn(),
  SUPABASE_CLIENT_UNAVAILABLE_MESSAGE:
    "Authentication and cloud sync are temporarily unavailable. Please try again shortly."
}));

const mockedCreateClientSafely = jest.mocked(createClientSafely);

describe("SignupPage", () => {
  beforeEach(() => {
    mockedCreateClientSafely.mockReset();
  });

  test("shows an auth-unavailable notice and disables submit when client init fails", () => {
    mockedCreateClientSafely.mockReturnValueOnce(null);

    render(<SignupPage />);

    expect(screen.getByText(SUPABASE_CLIENT_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
  });
});
