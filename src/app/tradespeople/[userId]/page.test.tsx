/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import TradespersonProfilePage from "./page";
import { getPublicGalleryByUser } from "@/lib/supabase/gallery-db";
import { getPublicProfile } from "@/lib/supabase/profiles-db";

jest.mock("@/lib/supabase/profiles-db", () => ({
  getPublicProfile: jest.fn()
}));

jest.mock("@/lib/supabase/gallery-db", () => ({
  getPublicGalleryByUser: jest.fn()
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children
  }: {
    href: string;
    children: ReactNode;
  }) => <a href={href}>{children}</a>
}));

const mockedGetPublicProfile = jest.mocked(getPublicProfile);
const mockedGetPublicGalleryByUser = jest.mocked(getPublicGalleryByUser);

describe("TradespersonProfilePage", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockedGetPublicProfile.mockReset();
    mockedGetPublicGalleryByUser.mockReset();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("renders fallback state when profile lookup fails", async () => {
    mockedGetPublicProfile.mockRejectedValueOnce(new Error("Missing Supabase env"));

    render(await TradespersonProfilePage({ params: { userId: "test-user-id" }, searchParams: {} }));

    expect(screen.getByText("Tradesperson profile")).toBeInTheDocument();
    expect(screen.getByText(/This profile is temporarily unavailable\./i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to directory/i })).toHaveAttribute(
      "href",
      "/tradespeople"
    );
    expect(mockedGetPublicGalleryByUser).not.toHaveBeenCalled();
  });
});
