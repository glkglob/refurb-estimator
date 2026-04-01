import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Playfair_Display, IBM_Plex_Mono } from "next/font/google";
import Layout from "@/components/Layout";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({ 
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({ 
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Refurb Estimator — UK Property Refurbishment Cost Calculator",
  description:
    "Professional-grade UK property refurbishment cost estimator with room-level breakdowns, scenario comparison, and budget tracking.",
  openGraph: {
    title: "Refurb Estimator",
    description: "Get accurate renovation cost estimates for UK properties in seconds.",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 2,
  themeColor: "#f7f5f0",
  colorScheme: "light"
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html 
      lang="en" 
      className={`${inter.variable} ${playfair.variable} ${ibmPlexMono.variable} font-sans`}
      style={{ colorScheme: "light" }}
    >
      <body className="antialiased">
        <ServiceWorkerRegistration />
        <TooltipProvider>
          <Layout>{children}</Layout>
          <Toaster position="top-right" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}
