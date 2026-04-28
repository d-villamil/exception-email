import { readFile } from 'node:fs/promises';
import type { ShipmentRecord } from '../types.ts';

export async function fetchFromFixture(path: string): Promise<ShipmentRecord[]> {
  const text = await readFile(path, 'utf8');
  const rows = JSON.parse(text) as Array<Omit<ShipmentRecord, 'sourceSystem'>>;
  return rows.map((r) => ({ ...r, sourceSystem: 'fixture' }));
}
