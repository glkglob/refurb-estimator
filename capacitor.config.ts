import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rissolo.refurbestimator",
  appName: "Refurb Estimator",
  webDir: "out",
  server: {
    url: "https://refurb-estimator.vercel.app",
    cleartext: false,
  },
};

export default config;
