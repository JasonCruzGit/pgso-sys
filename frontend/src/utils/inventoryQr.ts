import type { InventoryItem } from '../types';

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function getInventoryAppBaseUrl(baseUrlOverride?: string | null): string {
  if (baseUrlOverride) return normalizeBaseUrl(baseUrlOverride);

  const envUrl = import.meta.env.VITE_PUBLIC_URL as string | undefined;

  if (typeof window !== 'undefined' && window.location?.origin) {
    const { hostname, origin } = window.location;
    if (!isLocalHost(hostname)) return origin;
    if (envUrl) return normalizeBaseUrl(envUrl);
    return origin;
  }

  if (envUrl) return normalizeBaseUrl(envUrl);
  return 'http://localhost:5173';
}

/** Deep-link URL encoded in inventory item QR codes. */
export function getInventoryQrValue(
  item: Pick<InventoryItem, 'id' | 'item_code' | 'property_number'>,
  baseUrlOverride?: string | null,
): string {
  const base = getInventoryAppBaseUrl(baseUrlOverride);
  const params = new URLSearchParams();
  // Numeric id is the most reliable lookup key across devices and roles.
  params.set('id', String(item.id));
  if (item.property_number) {
    params.set('property', item.property_number);
  }
  return `${base}/inventory?${params.toString()}`;
}
