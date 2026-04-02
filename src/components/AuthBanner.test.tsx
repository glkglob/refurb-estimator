/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import AuthBanner from "./AuthBanner";
import { createClientSafely } from "@/lib/supabase/client";

jest.mock("@/lib/supabase/client", () => ({
  createClientSafely: jest.fn()
}));

const mockedCreateClientSafely = jest.mocked(createClientSafely);

describe("AuthBanner", () => {
  beforeEach(() => {
    mockedCreateClientSafely.mockReset();
  });

  test("shows the signed-out banner with a high-contrast sign-in CTA", async () => {
    mockedCreateClientSafely.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } })
      }
    } as ReturnType<typeof createClientSafely>);

    render(<AuthBanner />);

    expect(await screen.findByText("Your data is saved locally")).toBeInTheDocument();

    const signInLink = screen.getByRole("link", { name: /sign in/i });
    expect(signInLink).toHaveClass("bg-[hsl(30_10%_10%)]");
    expect(signInLink).toHaveClass("text-white");
  });

  test("stays hidden for authenticated users", async () => {
    mockedCreateClientSafely.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "user@example.com" } }
        })
      }
    } as ReturnType<typeof createClientSafely>);

    render(<AuthBanner />);

    expect(screen.queryByText("Your data is saved locally")).not.toBeInTheDocument();
  });
});
