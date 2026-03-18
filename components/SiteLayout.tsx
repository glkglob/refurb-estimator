import Link from "next/link";
import type { ReactNode } from "react";

type SiteLayoutProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/", label: "Quick Estimate" },
  { href: "/rooms", label: "Detailed Rooms" },
  { href: "/scenarios", label: "Scenario Comparison" },
  { href: "/budget", label: "Budget Tracker" }
];

export default function SiteLayout({ children }: SiteLayoutProps) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <nav aria-label="Main navigation">
          <ul className="site-nav">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="site-main">{children}</main>
    </div>
  );
}
