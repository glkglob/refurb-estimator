import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";

type LayoutProps = {
  children: ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col pb-mobile-nav md:ml-64 md:pb-0">
        <main className="flex-1">
          {children}
        </main>
        
        {/* Footer */}
        <footer className="border-t border-border bg-card px-6 py-8">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
              <p>Estimates are indicative only, based on average UK refurbishment costs.</p>
              <p>&copy; 2026 Refurb Estimator. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
