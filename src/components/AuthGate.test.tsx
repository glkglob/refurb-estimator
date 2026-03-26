/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import AuthGate from "./AuthGate";
import { createClient } from "@/lib/supabase/client";

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn()
}));

const mockedCreateClient = jest.mocked(createClient);

const ORIGINAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function mockSupabaseUser(user: { id: string } | null): void {
  mockedCreateClient.mockReturnValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user }
      })
    }
  } as unknown as ReturnType<typeof createClient>);
}

describe("AuthGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";
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

  test("shows gated overlay and preview for signed-out users", async () => {
    mockSupabaseUser(null);

    render(
      <AuthGate preview={<p>Preview summary</p>}>
        <div>Private appraisal figures</div>
      </AuthGate>
    );

    await waitFor(() => {
      expect(screen.getByText("Sign in to unlock")).toBeInTheDocument();
    });

    expect(screen.getByText("Preview summary")).toBeInTheDocument();
    expect(screen.getAllByText("Pro feature — free during beta")).toHaveLength(2);
    expect(screen.getByText("Private appraisal figures")).toBeInTheDocument();
  });

  test("renders children without gate when authenticated", async () => {
    mockSupabaseUser({ id: "user-123" });

    render(
      <AuthGate>
        <div>Private appraisal figures</div>
      </AuthGate>
    );

    await waitFor(() => {
      expect(screen.getByText("Private appraisal figures")).toBeInTheDocument();
    });

    expect(screen.queryByText("Sign in to unlock")).not.toBeInTheDocument();
  });
});
