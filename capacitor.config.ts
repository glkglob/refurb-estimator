import type { CapacitorConfig } from "@capacitor/cli";

const isDev = process.env.NODE_ENV !== "production";

const config: CapacitorConfig = {
  appId: "com.rissolo.refurbestimator",
  appName: "Refurb Estimator",
  webDir: "out",
  server: isDev
    ? {
        url: process.env.CAPACITOR_SERVER_URL || "https://refurb-estimator.vercel.app",
        cleartext: false
      }
    : undefined
};

export default config;
