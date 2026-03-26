/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import ScenariosPage from "./page";
import { loadScenarios } from "@/lib/dataService";
import {
  createClientSafely,
  SUPABASE_CLIENT_UNAVAILABLE_MESSAGE
} from "@/lib/supabase/client";

jest.mock("@/components/AuthBanner", () => ({
  __esModule: true,
  default: () => null
}));

jest.mock("@/components/AuthGate", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>
}));

jest.mock("@/lib/dataService", () => ({
  loadScenarios: jest.fn(),
  deleteScenario: jest.fn()
}));

jest.mock("@/lib/supabase/client", () => ({
  createClientSafely: jest.fn(),
  SUPABASE_CLIENT_UNAVAILABLE_MESSAGE:
    "Authentication and cloud sync are temporarily unavailable. Please try again shortly."
}));

const mockedLoadScenarios = jest.mocked(loadScenarios);
const mockedCreateClientSafely = jest.mocked(createClientSafely);

describe("ScenariosPage", () => {
  beforeEach(() => {
    mockedLoadScenarios.mockReset();
    mockedCreateClientSafely.mockReset();
  });

  test("shows local-mode notice when Supabase client is unavailable", async () => {
    mockedCreateClientSafely.mockReturnValueOnce(null);
    mockedLoadScenarios.mockResolvedValueOnce([]);

    render(<ScenariosPage />);

    expect(
      await screen.findByText(
        `${SUPABASE_CLIENT_UNAVAILABLE_MESSAGE} Scenarios remain available locally on this device.`
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("Sign in to unlock")).not.toBeInTheDocument();
  });
});
