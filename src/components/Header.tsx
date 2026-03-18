import Link from "next/link";
import MobileNav from "@/components/MobileNav";

const navItems = [
  { href: "/", label: "Quick Estimate" },
  { href: "/rooms", label: "Detailed Rooms" },
  { href: "/scenarios", label: "Scenario Comparison" },
  { href: "/budget", label: "Budget Tracker" }
];

export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav aria-label="Main navigation" className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <ul className="hidden flex-wrap items-center gap-2 text-sm font-medium text-slate-700 md:flex">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <MobileNav navItems={navItems} />
        </div>
      </nav>
    </header>
  );
}
