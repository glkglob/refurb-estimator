// File: capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rissolo.refurbestimator',
  appName: 'Refurb Estimator',
  webDir: 'out', // must match Next export folder if you later use static
  server: {
    url: 'https://refurb-estimator.vercel.app',
    cleartext: true,
  },
};

export default config;
