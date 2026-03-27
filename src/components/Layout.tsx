import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

type LayoutProps = {
  children: ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground bp-grid">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:ml-[240px] md:pb-0">
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="mt-auto border-t border-border bg-card/50 py-6">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="text-xs text-muted-foreground">
              Estimates are indicative only, based on average UK refurbishment costs.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">© 2026 Refurb Estimator</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
