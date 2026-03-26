/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import AuthGate from "./AuthGate";
import { createClientSafely } from "@/lib/supabase/client";

jest.mock("@/lib/supabase/client", () => ({
  createClientSafely: jest.fn()
}));

const mockedCreateClientSafely = jest.mocked(createClientSafely);

const ORIGINAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function mockSupabaseUser(user: { id: string } | null): void {
  mockedCreateClientSafely.mockReturnValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user }
      })
    }
  } as NonNullable<ReturnType<typeof createClientSafely>>);
}

describe("AuthGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateClientSafely.mockReturnValue(null);
  });

  afterAll(() => {
    if (ORIGINAL_SUPABASE_URL === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_SUPABASE_URL;
    }

    if (ORIGINAL_SUPABASE_ANON_KEY === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_SUPABASE_ANON_KEY;
    }
  });

  test("shows the gated overlay for signed-out users", async () => {
    mockSupabaseUser(null);

    render(
      <AuthGate
        featureName="Development Appraisal"
        featureDescription="Sign in to unlock the full appraisal breakdown."
      >
        <div>Private appraisal figures</div>
      </AuthGate>
    );

    await waitFor(() => {
      expect(screen.getByText("Sign in to unlock")).toBeInTheDocument();
    });

    expect(screen.getByText("Development Appraisal")).toBeInTheDocument();
    expect(
      screen.getByText("Sign in to unlock the full appraisal breakdown.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to unlock" })).toHaveAttribute(
      "href",
      "/auth/signin"
    );
    expect(screen.getByRole("link", { name: "Create free account" })).toHaveAttribute(
      "href",
      "/auth/signup"
    );
    expect(screen.getByText("Private appraisal figures")).toBeInTheDocument();
  });

  test("renders children without gate when authenticated", async () => {
    mockSupabaseUser({ id: "user-123" });

    render(
      <AuthGate
        featureName="Development Appraisal"
        featureDescription="Sign in to unlock the full appraisal breakdown."
      >
        <div>Private appraisal figures</div>
      </AuthGate>
    );

    await waitFor(() => {
      expect(screen.getByText("Private appraisal figures")).toBeInTheDocument();
    });

    expect(screen.queryByText("Sign in to unlock")).not.toBeInTheDocument();
  });

  test("renders children without gate when client is unavailable", async () => {
    mockedCreateClientSafely.mockReturnValueOnce(null);

    render(
      <AuthGate
        featureName="Development Appraisal"
        featureDescription="Sign in to unlock the full appraisal breakdown."
      >
        <div>Private appraisal figures</div>
      </AuthGate>
    );

    await waitFor(() => {
      expect(screen.getByText("Private appraisal figures")).toBeInTheDocument();
    });

    expect(screen.queryByText("Sign in to unlock")).not.toBeInTheDocument();
  });
});
