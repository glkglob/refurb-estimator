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

    expect(within(mobileNav).getAllByRole("link")).toHaveLength(4);
    expect(within(mobileNav).getByRole("link", { name: "Estimate" })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: "AI Photo" })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: "Development" })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: "Scenarios" })).toBeInTheDocument();

    expect(within(mobileNav).queryByRole("link", { name: "Quick Estimate" })).not.toBeInTheDocument();
    expect(within(mobileNav).queryByRole("link", { name: "AI Estimate" })).not.toBeInTheDocument();
    expect(within(mobileNav).queryByRole("link", { name: "Dev Appraisal" })).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Open more navigation options" })).toBeInTheDocument();
  });

  test("highlights the active mobile destination based on pathname", () => {
    mockedUsePathname.mockReturnValue("/development");

    render(<Sidebar />);

    const mobileNav = screen.getByLabelText("Mobile bottom navigation");
    const activeDestination = within(mobileNav).getByRole("link", { name: "Development" });

    expect(activeDestination.className).toContain("text-white");
    expect(activeDestination.className).toContain("bg-primary/15");
  });
});
