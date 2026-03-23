import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import Layout from "@/components/Layout";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Refurb Estimator — UK Property Refurbishment Cost Calculator",
  description:
    "Professional-grade UK property refurbishment cost estimator with room-level breakdowns, scenario comparison, and budget tracking."
};

export const viewport = {
  themeColor: "#0f1117",
  colorScheme: "dark"
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className="dark font-sans" style={{ colorScheme: "dark" }}>
      <body>
        <ServiceWorkerRegistration />
        <TooltipProvider>
          <Layout>{children}</Layout>
          <Toaster position="top-right" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}
