import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rissolo.refurbestimator",
  appName: "Refurb Estimator",
  webDir: "capacitor-www",
  server: {
    url: "https://refurb-estimator.vercel.app",
    cleartext: true,
  },
};

export default config;
