import { Capacitor } from '@capacitor/core';

export function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (configured?.startsWith('http')) {
    return configured.replace(/\/$/, '');
  }

  if (Capacitor.isNativePlatform()) {
    const mobile = import.meta.env.VITE_MOBILE_API_URL;
    if (mobile?.startsWith('http')) {
      return mobile.replace(/\/$/, '');
    }
    // iOS Simulator shares the host loopback — backend runs on :8001 via Docker.
    return 'http://127.0.0.1:8001/api';
  }

  return '/api';
}
