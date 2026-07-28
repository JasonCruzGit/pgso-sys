import * as XLSX from 'xlsx';

export type DeliveryReceiptImportItem = {
  description: string;
  unit_of_measure: string;
  quantity_received: number;
  quantity_ordered?: number;
  unit_cost: number;
};

export type DeliveryReceiptImportPayload = {
  po_number?: string;
  supplier_name?: string;
  delivery_date: string;
  supplier_reference_number?: string;
  delivery_location?: string;
  inspector_name?: string;
  notes?: string;
  /** Approved Budget for the Contract — header field, not a line item */
  abc_amount?: number;
  /** Contract / delivery amount — header field, not a line item */
  amount?: number;
  items: DeliveryReceiptImportItem[];
};

type ItemField = 'description' | 'unit' | 'quantity' | 'unit_cost' | 'total_price';
type MetaField = keyof Omit<DeliveryReceiptImportPayload, 'items'>;

const META_ALIASES: Record<string, MetaField> = {
  'po number': 'po_number',
  'po no': 'po_number',
  'po no.': 'po_number',
  'p.o. no.': 'po_number',
  'p.o. no': 'po_number',
  'purchase order': 'po_number',
  'purchase order no': 'po_number',
  'purchase order number': 'po_number',
  'purchase order no.': 'po_number',
  'delivery date': 'delivery_date',
  date: 'delivery_date',
  'supplier reference': 'supplier_reference_number',
  'supplier ref': 'supplier_reference_number',
  'invoice no': 'supplier_reference_number',
  'invoice no.': 'supplier_reference_number',
  'invoice number': 'supplier_reference_number',
  'delivery location': 'delivery_location',
  location: 'delivery_location',
  inspector: 'inspector_name',
  'inspector name': 'inspector_name',
  notes: 'notes',
  remarks: 'notes',
};

const ITEM_ALIASES: Record<string, ItemField> = {
  description: 'description',
  'item description': 'description',
  specifications: 'description',
  specification: 'description',
  particulars: 'description',
  'name of item': 'description',
  unit: 'unit',
  uom: 'unit',
  quantity: 'quantity',
  qty: 'quantity',
  'qty received': 'quantity',
  'quantity received': 'quantity',
  'unit cost': 'unit_cost',
  'unit price': 'unit_cost',
  cost: 'unit_cost',
  'u/p': 'unit_cost',
  up: 'unit_cost',
  amount: 'total_price',
  'total amount': 'total_price',
  'total cost': 'total_price',
};

const SKIP_ROW_PATTERN = /^(sub-?total|total|purpose|remarks|grand total|abc\b|amount\b)/i;
const SUMMARY_LABEL_PATTERN = /^(?:abc(?:\s*amount)?|approved\s*budget(?:\s*for\s*the\s*contract)?|amount)\s*[:.]?$/i;
const UNIT_WORDS = new Set([
  'unit', 'pcs', 'pc', 'box', 'set', 'pack', 'pair', 'roll', 'bottle', 'vial', 'bag',
  'sachet', 'ampule', 'ampoule', 'tablet', 'capsule', 'tube', 'can', 'jar', 'lot',
  'ream', 'gallon', 'liter', 'litre', 'ml', 'kg', 'gram', 'g', 'meter', 'metre', 'm',
]);

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[.:]+$/g, '')
    .replace(/\s+/g, ' ');
}

function cellText(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && value > 30000 && value < 60000) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
  }
  return String(value).trim();
}

function cellNumber(value: unknown): number {
  const cleaned = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[₱$,\s]/g, '')
    .replace(/\bphp\b/gi, '')
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function isItemNumber(value: unknown): boolean {
  const text = cellText(value).replace(/\.$/, '');
  if (!text) return false;
  const n = Number(text);
  return Number.isInteger(n) && n > 0 && n < 10000;
}

function isUnitWord(value: unknown): boolean {
  const text = normalizeHeader(value);
  return UNIT_WORDS.has(text);
}

function resolveItemField(cell: unknown): ItemField | undefined {
  const raw = cellText(cell);
  const normalized = normalizeHeader(cell);
  if (!normalized) return undefined;

  if (/project\s+description|mode\s+of\s+procurement|end\s+user|supplier\s+name/i.test(raw)) {
    return undefined;
  }

  if (/^item\s*(no|number)\b/.test(normalized)) return undefined;
  if (normalized === 'item' || normalized === 'no' || normalized === 'no.') return undefined;

  if (ITEM_ALIASES[normalized]) return ITEM_ALIASES[normalized];
  if (/item.*description|description.*item|^item\s*&\s*description/i.test(normalized)) {
    return 'description';
  }
  if (/^description\b|^item\s*description\b|^specification\b|^particulars\b/.test(normalized)) {
    return 'description';
  }
  if (/^qty\b|^quantity\b/.test(normalized)) return 'quantity';
  if (/^total\s*price\b|^line\s*total\b/.test(normalized)) return 'total_price';
  if (/unit\s*price|unit\s*cost|^u\.?\s*p\.?/.test(normalized)) return 'unit_cost';
  if (/^amount\b/.test(normalized) && !/^amount\s*due\b/.test(normalized)) return 'total_price';
  if (normalized === 'unit' || normalized === 'uom') return 'unit';
  return undefined;
}

function readCellValue(cell: XLSX.CellObject | undefined): unknown {
  if (!cell) return '';
  if (cell.w != null && String(cell.w).trim() !== '') return cell.w;
  if (cell.t === 'n' && cell.v != null) {
    if (cell.z && typeof XLSX.SSF?.format === 'function') {
      try {
        return XLSX.SSF.format(cell.z, cell.v as number);
      } catch {
        return cell.v;
      }
    }
    return cell.v;
  }
  if (cell.t === 's' && cell.v != null) return cell.v;
  if (cell.f && cell.v != null) return cell.v;
  if (cell.v != null) return cell.v;
  return '';
}

function looksLikeMoney(value: unknown, quantityHint = 0): boolean {
  const text = cellText(value);
  const num = cellNumber(value);
  if (num <= 0) return false;
  if (/[₱$]|php/i.test(text)) return true;
  if (/,\d{3}/.test(text)) return true;
  if (/\.\d{1,2}\b/.test(text)) return true;
  if (!Number.isInteger(num)) return true;
  if (quantityHint > 0 && num >= quantityHint * 1.5) return true;
  return false;
}

function isPlausibleUnitPrice(unitCost: number, quantity: number): boolean {
  if (unitCost <= 0) return false;
  if (!Number.isInteger(unitCost)) return true;
  if (quantity > 0 && quantity > unitCost * 15) return false;
  return true;
}

function columnMostlyItemNumbers(samples: unknown[][], col: number): boolean {
  if (!Number.isFinite(col)) return false;
  let hits = 0;
  let total = 0;
  for (const row of samples) {
    const value = row[col];
    if (cellText(value) === '') continue;
    total++;
    if (isItemNumber(value)) hits++;
  }
  return total > 0 && hits / total >= 0.7;
}

function columnMostlyUnitWords(samples: unknown[][], col: number): boolean {
  if (!Number.isFinite(col)) return false;
  let hits = 0;
  let total = 0;
  for (const row of samples) {
    const value = row[col];
    if (cellText(value) === '') continue;
    total++;
    if (isUnitWord(value)) hits++;
  }
  return total > 0 && hits / total >= 0.4;
}

function pricesAreConsistent(unitCost: number, quantity: number, lineTotal: number): boolean {
  if (unitCost <= 0 || quantity <= 0 || lineTotal <= 0) return false;
  const expected = unitCost * quantity;
  const tolerance = Math.max(0.05, expected * 0.02);
  return Math.abs(expected - lineTotal) <= tolerance;
}

function resolveUnitCostAndLineTotal(
  unitCost: number,
  lineTotal: number,
  quantity: number,
): { unitCost: number; lineTotal: number } {
  if (unitCost > 0 && lineTotal > 0) {
    return { unitCost, lineTotal };
  }

  if (unitCost > 0) {
    return {
      unitCost,
      lineTotal: lineTotal > 0 ? lineTotal : unitCost * quantity,
    };
  }

  if (lineTotal > 0 && quantity > 0) {
    const derivedUnit = lineTotal / quantity;
    const looksLikeUnitCost =
      quantity > 1
      && derivedUnit < 1
      && lineTotal >= 0.01
      && lineTotal <= 1_000_000
      && (looksLikeMoney(lineTotal) || String(lineTotal).includes('.'));

    if (looksLikeUnitCost) {
      return { unitCost: lineTotal, lineTotal: lineTotal * quantity };
    }

    return { unitCost: derivedUnit, lineTotal };
  }

  return { unitCost: 0, lineTotal: 0 };
}

function resolveRowUnit(
  row: unknown[],
  unitCol: number,
  itemCol: number,
  descCol: number,
  qtyCol: number,
): string {
  const mapped = Number.isFinite(unitCol) ? cellText(row[unitCol]) : '';
  if (mapped && !isItemNumber(mapped) && !/^\d+$/.test(mapped)) {
    return mapped;
  }

  const skip = new Set([itemCol, descCol, qtyCol].filter((col) => Number.isFinite(col)));
  for (let col = 0; col < row.length; col++) {
    if (skip.has(col)) continue;
    if (isUnitWord(row[col])) return cellText(row[col]);
  }

  return mapped || 'unit';
}

function detectPriceColumnsFromSamples(
  samples: unknown[][],
  excludeCols: Set<number>,
): { unitCostCol?: number; totalCol?: number } {
  const scores = new Map<number, number>();
  const qtyColGuess = [...excludeCols].sort((a, b) => a - b)[2] ?? -1;

  for (const row of samples) {
    const qtyHint = qtyColGuess >= 0 ? cellNumber(row[qtyColGuess]) : 0;
    row.forEach((cell, col) => {
      if (excludeCols.has(col)) return;
      if (!looksLikeMoney(cell, qtyHint)) return;
      scores.set(col, (scores.get(col) ?? 0) + 1);
    });
  }

  const minHits = Math.max(2, Math.floor(samples.length * 0.4));
  const cols = [...scores.entries()]
    .filter(([, count]) => count >= minHits)
    .map(([col]) => col)
    .sort((a, b) => a - b);

  if (cols.length >= 2) {
    return { unitCostCol: cols[cols.length - 2], totalCol: cols[cols.length - 1] };
  }
  if (cols.length === 1) {
    return { unitCostCol: cols[0] };
  }
  return {};
}

function supplementPriceColumns(
  columnMap: Record<number, ItemField>,
  samples: unknown[][],
  itemCol = -1,
): Record<number, ItemField> {
  const result = { ...columnMap };
  if (Number.isFinite(getMappedColumn(result, 'unit_cost'))) return result;

  const exclude = new Set(Object.keys(result).map(Number));
  if (itemCol >= 0) exclude.add(itemCol);
  const detected = detectPriceColumnsFromSamples(samples, exclude);
  if (detected.unitCostCol != null) result[detected.unitCostCol] = 'unit_cost';
  if (detected.totalCol != null) result[detected.totalCol] = 'total_price';
  return result;
}

function extractPricesFromRow(
  row: unknown[],
  excludeCols: Set<number>,
  quantity: number,
  startCol = 0,
): { unitCost: number; lineTotal: number } {
  const candidates = row
    .map((cell, col) => ({ col, num: cellNumber(cell), cell }))
    .filter(({ col, num, cell }) => col > startCol && !excludeCols.has(col) && num > 0 && looksLikeMoney(cell, quantity))
    .sort((a, b) => a.col - b.col);

  if (candidates.length >= 2) {
    return {
      unitCost: candidates[candidates.length - 2].num,
      lineTotal: candidates[candidates.length - 1].num,
    };
  }

  if (candidates.length === 1) {
    const value = candidates[0].num;
    if (quantity > 0 && value >= quantity * 1.5) {
      return { unitCost: value / quantity, lineTotal: value };
    }
    return { unitCost: value, lineTotal: value * quantity };
  }

  return { unitCost: 0, lineTotal: 0 };
}

function scoreParsedPayload(parsed: DeliveryReceiptImportPayload): number {
  const priced = parsed.items.filter((item) => isPlausibleUnitPrice(item.unit_cost, item.quantity_received)).length;
  const ratio = parsed.items.length ? priced / parsed.items.length : 0;
  let score = Math.round(ratio * 1_000_000) + parsed.items.length;
  if (parsed.amount != null && parsed.amount > 0) score += 50;
  if (parsed.abc_amount != null && parsed.abc_amount > 0) score += 50;
  const unitsOk = parsed.items.filter((item) => isUnitWord(item.unit_of_measure) || item.unit_of_measure.length > 1).length;
  score += Math.round((unitsOk / Math.max(parsed.items.length, 1)) * 1000);
  return score;
}

function applySheetMerges(matrix: unknown[][], merges?: XLSX.Range[]): unknown[][] {
  if (!merges?.length) return matrix;

  const result = matrix.map((row) => [...row]);
  for (const merge of merges) {
    const master = result[merge.s.r]?.[merge.s.c];
    if (master == null || master === '') continue;

    for (let r = merge.s.r; r <= merge.e.r; r++) {
      if (!result[r]) result[r] = [];
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (result[r][c] == null || result[r][c] === '') {
          result[r][c] = master;
        }
      }
    }
  }

  return result;
}

function sheetToMatrix(sheet: XLSX.WorkSheet): unknown[][] {
  const ref = sheet['!ref'];
  if (!ref) return [];

  const range = XLSX.utils.decode_range(ref);
  const rows: unknown[][] = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: unknown[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      row.push(readCellValue(sheet[addr]));
    }
    rows.push(row);
  }

  return applySheetMerges(rows, sheet['!merges']);
}

function densifyRows(rows: unknown[][]): unknown[][] {
  const maxCols = rows.reduce((max, row) => Math.max(max, row?.length ?? 0), 0);
  return rows.map((row) => {
    const dense = new Array(maxCols).fill('');
    for (let i = 0; i < maxCols; i++) {
      dense[i] = row?.[i] ?? '';
    }
    return dense;
  });
}

function mergeHeaderCells(...rows: unknown[][]): unknown[] {
  const maxCols = rows.reduce((max, row) => Math.max(max, row?.length ?? 0), 0);
  const merged = new Array(maxCols).fill('');
  for (const row of rows) {
    for (let i = 0; i < maxCols; i++) {
      const text = cellText(row?.[i]);
      if (!text) continue;
      if (!merged[i]) {
        merged[i] = text;
      } else if (!String(merged[i]).toLowerCase().includes(text.toLowerCase())) {
        merged[i] = `${merged[i]} ${text}`.trim();
      }
    }
  }
  return merged;
}

function mapItemHeaderRow(row: unknown[]): Record<number, ItemField> {
  const map: Record<number, ItemField> = {};
  row.forEach((cell, index) => {
    const key = resolveItemField(cell);
    if (key) map[index] = key;
  });
  return map;
}

function hasDescriptionHeader(row: unknown[]): boolean {
  return row.some((cell) => /description|specification|particulars|name of item/i.test(cellText(cell)));
}

function getMappedColumn(columnMap: Record<number, ItemField>, field: ItemField): number {
  return Number(Object.entries(columnMap).find(([, value]) => value === field)?.[0]);
}

function scoreColumnMap(
  samples: unknown[][],
  columnMap: Record<number, ItemField>,
  itemCol = -1,
): number {
  const descCol = getMappedColumn(columnMap, 'description');
  if (!Number.isFinite(descCol)) return 0;

  let score = 0;
  let validRows = 0;

  for (const row of samples) {
    const description = cellText(row[descCol]);
    if (isSkippableItemRow(description)) continue;

    validRows++;
    if (/^\d{1,4}$/.test(description)) {
      score -= 20;
    } else if (description.length >= 12) {
      score += 12;
    } else if (description.length >= 6) {
      score += 6;
    }

    const qtyCol = getMappedColumn(columnMap, 'quantity');
    if (Number.isFinite(qtyCol)) {
      if (itemCol >= 0 && qtyCol === itemCol) {
        score -= 25;
      }
      const qty = cellNumber(row[qtyCol]);
      const itemNo = itemCol >= 0 ? cellNumber(row[itemCol]) : 0;
      if (qty > 0 && qty !== cellNumber(description)) score += 4;
      if (qty > 0 && qty === cellNumber(description)) score -= 8;
      if (itemNo > 0 && qty > 0 && qty === itemNo) score -= 8;
    }

    const costCol = getMappedColumn(columnMap, 'unit_cost');
    const totalCol = getMappedColumn(columnMap, 'total_price');
    const unitCol = getMappedColumn(columnMap, 'unit');
    let unitCost = Number.isFinite(costCol) ? cellNumber(row[costCol]) : 0;
    const lineTotal = Number.isFinite(totalCol) ? cellNumber(row[totalCol]) : 0;
    if (unitCost <= 0 && lineTotal > 0 && qtyCol >= 0) {
      const qty = cellNumber(row[qtyCol]);
      if (qty > 0) unitCost = lineTotal / qty;
    }
    if (unitCost > 0) score += 6;
    else if (Number.isFinite(costCol) || Number.isFinite(totalCol)) score -= 10;

    if (Number.isFinite(unitCol)) {
      if (itemCol >= 0 && unitCol === itemCol) score -= 40;
      if (columnMostlyItemNumbers(samples, unitCol)) score -= 35;
      if (columnMostlyUnitWords(samples, unitCol)) score += 8;
    }

    if (unitCost > 0 && lineTotal > 0 && Number.isFinite(qtyCol)) {
      const qty = cellNumber(row[qtyCol]);
      if (pricesAreConsistent(unitCost, qty, lineTotal)) score += 15;
      else score -= 12;
    }
  }

  const hasPriceColumns = Number.isFinite(getMappedColumn(columnMap, 'unit_cost'))
    || Number.isFinite(getMappedColumn(columnMap, 'total_price'));
  if (!hasPriceColumns) score -= 25;

  const fieldCount = new Set(Object.values(columnMap)).size;
  if (fieldCount >= 5) score += 25;
  if (fieldCount >= 4 && hasPriceColumns) score += 10;

  return validRows >= 1 ? score : 0;
}

function positionalColumnMaps(itemCol: number): Record<number, ItemField>[] {
  return [
    {
      [itemCol + 1]: 'description',
      [itemCol + 2]: 'quantity',
      [itemCol + 3]: 'unit',
      [itemCol + 4]: 'unit_cost',
      [itemCol + 5]: 'total_price',
    },
  ];
}

function scoreItemHeaderRow(row: unknown[]): number {
  if (!hasDescriptionHeader(row)) return 0;

  const fields = new Set(Object.values(mapItemHeaderRow(row)));
  if (!fields.has('description')) return 0;
  if (fields.size < 2) return 0;

  let score = 10;
  if (fields.has('quantity')) score += 5;
  if (fields.has('unit')) score += 3;
  if (fields.has('unit_cost')) score += 2;
  if (fields.has('total_price')) score += 1;
  return score;
}

function findItemNumberColumn(rows: unknown[][], startRow: number, endRow: number): number {
  for (let col = 0; col < 16; col++) {
    let streak = 0;
    for (let row = startRow; row <= endRow; row++) {
      if (isItemNumber(rows[row]?.[col])) streak++;
      else if (streak > 0) break;
    }
    if (streak >= 1) return col;
  }
  return -1;
}

function findItemHeaderRow(rows: unknown[][]): number {
  let bestIndex = -1;
  let bestScore = 0;

  for (let index = 0; index < rows.length; index++) {
    const candidates = [
      rows[index],
      mergeHeaderCells(rows[index], rows[index + 1] ?? []),
      mergeHeaderCells(rows[index], rows[index + 1] ?? [], rows[index + 2] ?? []),
    ];

    for (const candidate of candidates) {
      const score = scoreItemHeaderRow(candidate);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
  }

  if (bestScore >= 12) return bestIndex;

  for (let i = 0; i < rows.length - 2; i++) {
    const itemCol = findItemNumberColumn(rows, i + 1, Math.min(i + 20, rows.length - 1));
    if (itemCol >= 0) return Math.max(i, 0);
  }

  return -1;
}

function inferColumnsFromSamples(samples: unknown[][], itemCol: number): Record<number, ItemField> | null {
  if (samples.length < 2) return null;

  const maxCols = samples.reduce((max, row) => Math.max(max, row.length), 0);
  type ColStat = {
    col: number;
    avgLen: number;
    avgValue: number;
    intRatio: number;
    decimalRatio: number;
    unitRatio: number;
    textRatio: number;
  };

  const stats: ColStat[] = [];

  for (let col = 0; col < maxCols; col++) {
    if (col === itemCol) continue;

    const values = samples.map((row) => row[col]).filter((v) => cellText(v) !== '');
    if (!values.length) continue;

    let intCount = 0;
    let decimalCount = 0;
    let unitCount = 0;
    let textCount = 0;
    let totalLen = 0;
    let valueSum = 0;
    let valueCount = 0;

    for (const value of values) {
      const text = cellText(value);
      totalLen += text.length;
      const num = cellNumber(value);
      if (num > 0) {
        valueSum += num;
        valueCount++;
      }

      if (isUnitWord(value)) {
        unitCount++;
      } else if (Number.isInteger(num) && num > 0 && text === String(num)) {
        intCount++;
      } else if (num > 0 && text.includes('.')) {
        decimalCount++;
      } else if (!Number.isFinite(num) || num === 0) {
        textCount++;
      }
    }

    const count = values.length;
    stats.push({
      col,
      avgLen: totalLen / count,
      avgValue: valueCount ? valueSum / valueCount : 0,
      intRatio: intCount / count,
      decimalRatio: decimalCount / count,
      unitRatio: unitCount / count,
      textRatio: textCount / count,
    });
  }

  if (!stats.length) return null;

  const descriptionCol = [...stats].sort((a, b) => b.avgLen - a.avgLen)[0];
  const quantityCol = [...stats]
    .filter((s) => s.col !== descriptionCol.col)
    .sort((a, b) => b.intRatio - a.intRatio)[0];
  const unitCol = [...stats]
    .filter((s) => s.col !== descriptionCol.col && s.col !== quantityCol?.col)
    .sort((a, b) => b.unitRatio - a.unitRatio)[0];
  const decimalCols = [...stats]
    .filter((s) => s.col !== descriptionCol.col && s.col !== quantityCol?.col && s.col !== unitCol?.col && s.decimalRatio >= 0.2)
    .sort((a, b) => a.avgValue - b.avgValue);
  const unitCostCol = decimalCols[0];
  const totalPriceCol = decimalCols[1];

  if (!descriptionCol || descriptionCol.avgLen < 8) return null;

  const map: Record<number, ItemField> = {
    [descriptionCol.col]: 'description',
  };

  if (quantityCol && quantityCol.intRatio >= 0.5) {
    map[quantityCol.col] = 'quantity';
  } else {
    const fallbackQty = itemCol + 2;
    map[fallbackQty] = 'quantity';
  }

  if (unitCol && unitCol.unitRatio >= 0.3 && !columnMostlyItemNumbers(samples, unitCol.col)) {
    map[unitCol.col] = 'unit';
  }

  if (unitCostCol && unitCostCol.decimalRatio >= 0.2) {
    map[unitCostCol.col] = 'unit_cost';
  }

  if (totalPriceCol && totalPriceCol.decimalRatio >= 0.2) {
    map[totalPriceCol.col] = 'total_price';
  }

  // Government PO layout: item no, description, qty, unit, unit cost, amount
  if (itemCol >= 0) {
    const govMap: Record<number, ItemField> = {
      [itemCol + 1]: 'description',
      [itemCol + 2]: 'quantity',
      [itemCol + 3]: 'unit',
      [itemCol + 4]: 'unit_cost',
      [itemCol + 5]: 'total_price',
    };
    const govScore = scoreColumnMap(samples, govMap, itemCol);
    const currentScore = scoreColumnMap(samples, map, itemCol);
    if (govScore > currentScore) return govMap;
  }

  return map;
}

function buildColumnMap(rows: unknown[][], headerRowIndex: number): Record<number, ItemField> {
  const headerCandidates = [
    rows[headerRowIndex],
    mergeHeaderCells(rows[headerRowIndex], rows[headerRowIndex + 1] ?? []),
    mergeHeaderCells(rows[headerRowIndex], rows[headerRowIndex + 1] ?? [], rows[headerRowIndex + 2] ?? []),
  ];

  const dataStart = headerRowIndex + 1;
  const itemCol = findItemNumberColumn(rows, dataStart, Math.min(dataStart + 25, rows.length - 1));
  const samples = rows
    .slice(dataStart, dataStart + 20)
    .filter((row) => {
      if (itemCol >= 0) return isItemNumber(row[itemCol]);
      return row.some((cell) => cellText(cell).length > 10);
    });

  const candidates: Record<number, ItemField>[] = [];

  for (const candidate of headerCandidates) {
    const mapped = mapItemHeaderRow(candidate);
    const descCol = getMappedColumn(mapped, 'description');
    if (new Set(Object.values(mapped)).has('description') && Object.keys(mapped).length >= 2) {
      if (!(itemCol >= 0 && descCol === itemCol)) {
        candidates.push(mapped);
      }
    }
  }

  if (itemCol >= 0) {
    candidates.push({
      [itemCol + 1]: 'description',
      [itemCol + 2]: 'quantity',
      [itemCol + 3]: 'unit',
      [itemCol + 4]: 'unit_cost',
      [itemCol + 5]: 'total_price',
    });
    const inferred = inferColumnsFromSamples(samples, itemCol);
    if (inferred) candidates.push(inferred);
    candidates.push(...positionalColumnMaps(itemCol));
  } else {
    const inferred = inferColumnsFromSamples(samples, -1);
    if (inferred) candidates.push(inferred);
  }

  let bestMap: Record<number, ItemField> = {};
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const score = scoreColumnMap(samples, candidate, itemCol);
    if (score > bestScore) {
      bestScore = score;
      bestMap = candidate;
    }
  }

  if (bestScore > 0) return supplementPriceColumns(bestMap, samples, itemCol);

  if (itemCol >= 0) {
    return supplementPriceColumns(positionalColumnMaps(itemCol)[0], samples, itemCol);
  }

  for (let i = headerCandidates.length - 1; i >= 0; i--) {
    const mapped = mapItemHeaderRow(headerCandidates[i]);
    if (new Set(Object.values(mapped)).has('description') && Object.keys(mapped).length >= 2) {
      return supplementPriceColumns(mapped, samples, itemCol);
    }
  }

  return supplementPriceColumns(inferColumnsFromSamples(samples, itemCol) ?? {}, samples, itemCol);
}

function isLikelyHeaderLabel(text: string): boolean {
  const normalized = normalizeHeader(text);
  return Boolean(
    META_ALIASES[normalized]
    || resolveItemField(text)
    || normalized === 'item no'
    || normalized === 'item number',
  );
}

function extractMetadata(rows: unknown[][]): Partial<DeliveryReceiptImportPayload> {
  const meta: Partial<DeliveryReceiptImportPayload> = {};
  const poLabelPattern = /(?:purchase\s*order|p\.?\s*o\.?)\s*(?:no\.?|number)\s*[:.]?\s*([A-Z0-9][\w-]+)/i;
  const poInlinePattern = /\bPO[-\s][\w-]+/i;

  for (const row of rows) {
    for (let col = 0; col < row.length; col++) {
      const text = cellText(row[col]);
      if (!text) continue;

      const labelMatch = text.match(poLabelPattern);
      if (labelMatch && !meta.po_number) {
        meta.po_number = labelMatch[1].trim();
      }

      const combined = `${text} ${cellText(row[col + 1])}`;
      const combinedMatch = combined.match(poLabelPattern);
      if (combinedMatch && !meta.po_number) {
        meta.po_number = combinedMatch[1].trim();
      }

      const headerKey = META_ALIASES[normalizeHeader(text)];
      if (headerKey && headerKey !== 'po_number') {
        const value = cellText(row[col + 1]) || cellText(row[col + 2]);
        if (value && !isLikelyHeaderLabel(value) && !meta[headerKey]) {
          (meta as Record<string, string>)[headerKey] = value;
        }
      }

      if (!meta.po_number) {
        const inlineMatch = text.match(poInlinePattern);
        if (inlineMatch) {
          meta.po_number = inlineMatch[0].replace(/\s+/g, '-').replace(/--+/g, '-');
        }
      }
    }
  }

  return meta;
}

function isSummaryLabel(value: unknown): 'abc' | 'amount' | null {
  const text = cellText(value).replace(/[:.\s]+$/g, '').trim();
  if (!text) return null;
  if (/^abc\b/i.test(text)) return 'abc';
  if (/^amount\b/i.test(text)) return 'amount';
  if (SUMMARY_LABEL_PATTERN.test(text)) {
    return /^abc/i.test(text) ? 'abc' : 'amount';
  }
  return null;
}

export function isSummaryImportRow(item: {
  description?: string;
  unit_of_measure?: string;
}): boolean {
  const unit = (item.unit_of_measure ?? '').trim();
  const desc = (item.description ?? '').trim();
  if (isSummaryLabel(unit) || isSummaryLabel(desc)) return true;
  if (/^amount\b/i.test(unit) && cellNumber(desc) > 0) return true;
  if (/^abc\b/i.test(unit) && cellNumber(desc) > 0) return true;
  return false;
}

function parseSummaryRow(row: unknown[]): { kind: 'abc' | 'amount'; value: number } | null {
  let kind: 'abc' | 'amount' | null = null;
  const labelCols = new Set<number>();

  row.forEach((cell, col) => {
    const label = isSummaryLabel(cell);
    if (label) {
      kind = label;
      labelCols.add(col);
    }
  });

  if (!kind) return null;

  let best = 0;
  for (let col = 0; col < row.length; col++) {
    if (labelCols.has(col)) continue;
    const cell = row[col];
    const num = cellNumber(cell);
    if (num <= 0) continue;
    if (looksLikeMoney(cell) || cellText(cell).includes(',')) {
      if (num > best) best = num;
    }
  }

  return best > 0 ? { kind, value: best } : null;
}

function isSkippableItemRow(description: string): boolean {
  const trimmed = description.trim();
  if (!trimmed) return true;
  if (SKIP_ROW_PATTERN.test(trimmed)) return true;
  if (/^item\s*no\.?$/i.test(trimmed)) return true;
  if (isSummaryLabel(trimmed)) return true;
  return false;
}

function resolveRowQuantity(
  row: unknown[],
  options: {
    qtyCol: number;
    itemCol: number;
    descCol: number;
    unitCol: number;
    costCol: number;
    totalCol: number;
    description: string;
  },
): number {
  const { qtyCol, itemCol, descCol, unitCol, costCol, totalCol, description } = options;
  const itemNo = itemCol >= 0 ? cellNumber(row[itemCol]) : 0;
  let quantity = Number.isFinite(qtyCol) ? cellNumber(row[qtyCol]) : 0;

  const quantityLooksWrong =
    quantity <= 0
    || (quantity === cellNumber(description) && /^\d{1,4}$/.test(description))
    || (itemNo > 0 && quantity === itemNo);

  if (!quantityLooksWrong) return quantity;

  const skipCols = new Set(
    [descCol, itemCol, unitCol, costCol, totalCol].filter((col) => Number.isFinite(col)),
  );

  for (let col = 0; col < row.length; col++) {
    if (skipCols.has(col)) continue;
    const text = cellText(row[col]);
    const num = cellNumber(row[col]);
    if (num <= 0 || num >= 100000 || !Number.isInteger(num)) continue;
    if (text !== String(num)) continue;
    if (itemNo > 0 && num === itemNo) continue;
    return num;
  }

  return quantity;
}

function parseRows(rows: unknown[][]): DeliveryReceiptImportPayload | null {
  const denseRows = densifyRows(rows);
  if (!denseRows.length) return null;

  let headerRowIndex = findItemHeaderRow(denseRows);
  if (headerRowIndex < 0) {
    for (let i = 0; i < denseRows.length - 2; i++) {
      const itemCol = findItemNumberColumn(denseRows, i, Math.min(i + 20, denseRows.length - 1));
      if (itemCol >= 0) {
        headerRowIndex = Math.max(i - 1, 0);
        break;
      }
    }
  }
  if (headerRowIndex < 0) return null;

  const dataStart = headerRowIndex + 1;
  const itemCol = findItemNumberColumn(denseRows, dataStart, Math.min(dataStart + 25, denseRows.length - 1));
  const columnMap = buildColumnMap(denseRows, headerRowIndex);
  const descCol = Number(Object.entries(columnMap).find(([, field]) => field === 'description')?.[0]);
  if (!Number.isFinite(descCol)) return null;

  const metadata = extractMetadata(denseRows.slice(0, headerRowIndex + 1));

  const payload: DeliveryReceiptImportPayload = {
    delivery_date: metadata.delivery_date ?? new Date().toISOString().slice(0, 10),
    po_number: metadata.po_number,
    supplier_reference_number: metadata.supplier_reference_number,
    delivery_location: metadata.delivery_location,
    inspector_name: metadata.inspector_name,
    notes: metadata.notes,
    abc_amount: undefined,
    amount: undefined,
    items: [],
  };

  for (const row of denseRows) {
    const summary = parseSummaryRow(row);
    if (!summary) continue;
    if (summary.kind === 'abc') payload.abc_amount = summary.value;
    else payload.amount = summary.value;
  }

  const qtyCol = Number(Object.entries(columnMap).find(([, field]) => field === 'quantity')?.[0]);
  const unitCol = Number(Object.entries(columnMap).find(([, field]) => field === 'unit')?.[0]);
  const costCol = Number(Object.entries(columnMap).find(([, field]) => field === 'unit_cost')?.[0]);
  const totalCol = Number(Object.entries(columnMap).find(([, field]) => field === 'total_price')?.[0]);

  for (let i = headerRowIndex + 1; i < denseRows.length; i++) {
    const row = denseRows[i];
    if (parseSummaryRow(row)) continue;

    const description = cellText(row[descCol]);
    if (isSkippableItemRow(description)) continue;

    const unitLabel = Number.isFinite(unitCol) ? isSummaryLabel(row[unitCol]) : null;
    if (unitLabel) continue;

    let quantity = resolveRowQuantity(row, {
      qtyCol,
      itemCol,
      descCol,
      unitCol,
      costCol,
      totalCol,
      description,
    });
    if (quantity <= 0) continue;

    if (/^\d{1,4}$/.test(description)) continue;

    const unit = resolveRowUnit(row, unitCol, itemCol, descCol, qtyCol);
    const usedCols = new Set(
      [descCol, qtyCol, unitCol, itemCol, costCol, totalCol].filter((col) => Number.isFinite(col)),
    );
    const priceScanStart = Math.max(
      ...[descCol, qtyCol, unitCol, itemCol].filter((col) => Number.isFinite(col)),
      -1,
    );
    let unitCost = Number.isFinite(costCol) ? cellNumber(row[costCol]) : 0;
    let lineTotal = Number.isFinite(totalCol) ? cellNumber(row[totalCol]) : 0;

    if (unitCost <= 0 && lineTotal <= 0) {
      const extracted = extractPricesFromRow(row, usedCols, quantity, priceScanStart);
      unitCost = extracted.unitCost;
      lineTotal = extracted.lineTotal;
      if (!isPlausibleUnitPrice(unitCost, quantity)) {
        unitCost = 0;
      }
    }

    const resolvedPrices = resolveUnitCostAndLineTotal(unitCost, lineTotal, quantity);
    unitCost = resolvedPrices.unitCost;
    lineTotal = resolvedPrices.lineTotal;

    if (unitCost <= 0 && Number.isFinite(costCol)) {
      unitCost = cellNumber(row[costCol]);
    }

    payload.items.push({
      description,
      unit_of_measure: unit || 'unit',
      quantity_received: quantity,
      quantity_ordered: quantity,
      unit_cost: unitCost,
    });
  }

  return payload.items.length ? payload : null;
}

export function parseDeliveryReceiptWorkbook(buffer: ArrayBuffer): DeliveryReceiptImportPayload {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellText: true });

  let best: DeliveryReceiptImportPayload | null = null;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = sheetToMatrix(sheet);
    if (!rows.length) continue;

    const parsed = parseRows(rows);
    if (!parsed) continue;
    if (!best || scoreParsedPayload(parsed) > scoreParsedPayload(best)) {
      best = parsed;
    }
  }

  if (!best) {
    throw new Error(
      'Could not read item rows from the spreadsheet. Ensure the file has line items with Description, Qty, Unit, and Unit Price (government PO Excel exports are supported).',
    );
  }

  return best;
}

export function downloadDeliveryReceiptTemplate() {
  const rows = [
    ['PO Number', 'Delivery Date', 'Supplier Reference', 'Delivery Location', 'Inspector', 'Description', 'Unit', 'Quantity', 'Unit Cost', 'Notes'],
    ['PO-2026-0001', '2026-06-16', 'INV-001', 'PGSO Warehouse', 'Juan Dela Cruz', 'LAPTOP', 'unit', 2, 45000, 'Imported delivery receipt'],
    ['', '', '', '', '', 'MOUSE', 'unit', 2, 500, ''],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 24 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 24 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Delivery Receipt');
  XLSX.writeFile(workbook, 'delivery-receipt-template.xlsx');
}
