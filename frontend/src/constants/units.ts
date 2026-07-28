export const UNITS_OF_MEASURE = [
  'unit',
  'piece',
  'box',
  'ream',
  'pack',
  'set',
  'bottle',
  'roll',
  'pair',
  'dozen',
  'kg',
  'liter',
  'liters',
  'ml',
  'gallon',
  'gal',
  'gals',
  'lot',
] as const;

export type UnitOfMeasure = (typeof UNITS_OF_MEASURE)[number];

/** Bulk / consumable units: one optional lot/batch reference, not one S/N per quantity. */
const BULK_UNITS_SINGLE_SERIAL = new Set([
  'liter',
  'liters',
  'ml',
  'gallon',
  'gal',
  'gals',
  'kg',
  'lot',
]);

export function unitUsesIndividualSerialNumbers(unit?: string): boolean {
  const u = unit?.trim().toLowerCase();
  if (!u) return true;
  return !BULK_UNITS_SINGLE_SERIAL.has(u);
}

export function serialFieldCountForUnit(qty: string | number, unit?: string): number {
  const n = Number(qty);
  if (!n || n <= 0) return 0;
  if (!unitUsesIndividualSerialNumbers(unit)) return 1;
  return Math.floor(n);
}

export function unitSelectOptions(currentValue?: string): string[] {
  const normalized = currentValue?.trim().toLowerCase();
  const options: string[] = [...UNITS_OF_MEASURE];
  if (normalized && !options.includes(normalized)) {
    options.push(normalized);
  }
  return options;
}
