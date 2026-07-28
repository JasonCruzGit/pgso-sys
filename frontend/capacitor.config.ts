import type { CapacitorConfig } from '@capacitor/cli';
import { BRANDING } from './src/constants/branding';

const config: CapacitorConfig = {
  appId: 'ph.gov.elnido.gso.inventory',
  appName: BRANDING.appName,
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
