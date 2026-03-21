import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rissolo.refurbestimator",
  appName: "Refurb Estimator",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;
