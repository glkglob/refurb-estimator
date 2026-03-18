import type { Metadata } from "next";
import type { ReactNode } from "react";
import Layout from "@/components/Layout";
import "./globals.css";

export const metadata: Metadata = {
  title: "UK Property Refurb Estimator",
  description: "Quick estimate tools for UK property refurbishment"
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
