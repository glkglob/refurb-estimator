import type { ReactNode } from "react";
import Header from "@/components/Header";

type LayoutProps = {
  children: ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="mt-auto border-t border-border bg-muted/30 py-6">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground">
            Estimates are indicative only, based on average UK refurbishment costs. Actual costs
            vary by property, specification, and contractor.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">© 2026 Refurb Estimator</p>
        </div>
      </footer>
    </div>
  );
}
