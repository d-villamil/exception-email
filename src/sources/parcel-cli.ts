import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ShipmentRecord } from '../types.ts';

const exec = promisify(execFile);

// TODO(david): supply the exact parcel-cli command + args + sample output.
// Once provided, replace the placeholder parser below to map raw rows to ShipmentRecord.
// CLAUDE.md: parcel-cli is the primary source; Trino is fallback.
export async function fetchFromParcelCli(opts: {
  bin: string;
  args: string[];
}): Promise<ShipmentRecord[]> {
  const { stdout } = await exec(opts.bin, opts.args, { maxBuffer: 32 * 1024 * 1024 });
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  // Placeholder: assume JSON array for now. Replace once real format is known.
  const raw = JSON.parse(trimmed) as unknown[];
  return raw.map(parseRow);
}

function parseRow(_row: unknown): ShipmentRecord {
  throw new Error('parcel-cli row parser not implemented — pending sample payload from Live Ops');
}
