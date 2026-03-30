/** @jest-environment jsdom */

import { render, screen, within } from "@testing-library/react";
import MobileBottomNav from "./MobileBottomNav";

describe("MobileBottomNav", () => {
  test("renders required primary destinations and the more button", () => {
    render(
      <MobileBottomNav pathname="/" isOpen={false} onOpenChange={jest.fn()}>
        <div>Navigation sheet content</div>
      </MobileBottomNav>
    );

    const mobileNav = screen.getByLabelText("Mobile bottom navigation");
    const links = within(mobileNav).getAllByRole("link");
    const moreButton = screen.getByRole("button", { name: "Open more navigation options" });

    expect(links).toHaveLength(4);
    expect(within(mobileNav).getByRole("link", { name: "Estimate" })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: "AI Photo" })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: "Development" })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: "Scenarios" })).toBeInTheDocument();
    expect(within(mobileNav).queryByRole("link", { name: "Quick Estimate" })).not.toBeInTheDocument();
    expect(within(mobileNav).queryByRole("link", { name: "AI Estimate" })).not.toBeInTheDocument();
    expect(within(mobileNav).queryByRole("link", { name: "Dev Appraisal" })).not.toBeInTheDocument();
    expect(moreButton).toBeInTheDocument();
    expect(links.length + 1).toBeGreaterThanOrEqual(5);
  });

  test("applies active state styles to the active destination", () => {
    render(
      <MobileBottomNav pathname="/development" isOpen={false} onOpenChange={jest.fn()}>
        <div>Navigation sheet content</div>
      </MobileBottomNav>
    );

    const mobileNav = screen.getByLabelText("Mobile bottom navigation");
    const activeDestination = within(mobileNav).getByRole("link", { name: "Development" });

    expect(activeDestination.className).toContain("text-white");
    expect(activeDestination.className).toContain("bg-primary/15");
    expect(activeDestination).toHaveAttribute("aria-current", "page");
  });

  test("marks the more button as expanded when the sheet is open", () => {
    const { container } = render(
      <MobileBottomNav pathname="/" isOpen onOpenChange={jest.fn()}>
        <div>Navigation sheet content</div>
      </MobileBottomNav>
    );

    const moreButton = container.querySelector('button[aria-label="Open more navigation options"]');
    expect(moreButton).toHaveAttribute("aria-expanded", "true");
  });
});
