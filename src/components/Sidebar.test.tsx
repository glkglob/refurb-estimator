/** @jest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn()
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn()
}));

const mockedUsePathname = jest.mocked(usePathname);
const mockedUseRouter = jest.mocked(useRouter);

describe("Sidebar", () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue("/");
    mockedUseRouter.mockReturnValue({
      push: jest.fn(),
      refresh: jest.fn()
    } as unknown as ReturnType<typeof useRouter>);
  });

  test("renders the mobile bottom navigation with the required primary destinations", () => {
    render(<Sidebar />);

    const mobileNav = screen.getByLabelText("Mobile bottom navigation");

    expect(within(mobileNav).getByRole("link", { name: "Quick Estimate" })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: "AI Estimate" })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: "Dev Appraisal" })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: "Scenarios" })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: "Tradespeople" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open more navigation options" })).toBeInTheDocument();
  });

  test("highlights the active mobile destination based on pathname", () => {
    mockedUsePathname.mockReturnValue("/development");

    render(<Sidebar />);

    const mobileNav = screen.getByLabelText("Mobile bottom navigation");
    const activeDestination = within(mobileNav).getByRole("link", { name: "Dev Appraisal" });

    expect(activeDestination.className).toContain("text-primary");
  });
});
