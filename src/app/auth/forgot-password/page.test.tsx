/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import ForgotPasswordPage from "./page";
import {
  createClientSafely,
  SUPABASE_CLIENT_UNAVAILABLE_MESSAGE
} from "@/lib/supabase/client";

jest.mock("@/lib/supabase/client", () => ({
  createClientSafely: jest.fn(),
  SUPABASE_CLIENT_UNAVAILABLE_MESSAGE:
    "Authentication and cloud sync are temporarily unavailable. Please try again shortly."
}));

const mockedCreateClientSafely = jest.mocked(createClientSafely);

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    mockedCreateClientSafely.mockReset();
  });

  test("shows an auth-unavailable notice and disables submit when client init fails", () => {
    mockedCreateClientSafely.mockReturnValueOnce(null);

    render(<ForgotPasswordPage />);

    expect(screen.getByText(SUPABASE_CLIENT_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeDisabled();
  });
});
