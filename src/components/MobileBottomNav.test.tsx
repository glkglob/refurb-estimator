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

    expect(within(mobileNav).getByRole("link", { name: "Quick Estimate" })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: "AI Estimate" })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: "Dev Appraisal" })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: "Scenarios" })).toBeInTheDocument();
    expect(within(mobileNav).getByRole("link", { name: "Tradespeople" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open more navigation options" })).toBeInTheDocument();
  });

  test("applies active state styles to the active destination", () => {
    render(
      <MobileBottomNav pathname="/development" isOpen={false} onOpenChange={jest.fn()}>
        <div>Navigation sheet content</div>
      </MobileBottomNav>
    );

    const mobileNav = screen.getByLabelText("Mobile bottom navigation");
    const activeDestination = within(mobileNav).getByRole("link", { name: "Dev Appraisal" });

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
