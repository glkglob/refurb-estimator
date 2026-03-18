import type { Metadata } from "next";
import type { ReactNode } from "react";
import SiteLayout from "@/components/SiteLayout";
import "./globals.css";

export const metadata: Metadata = {
  title: "UK Property Refurb Estimator",
  description: "Simple starter for a UK property refurbishment estimator app."
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <SiteLayout>{children}</SiteLayout>
      </body>
    </html>
  );
}
