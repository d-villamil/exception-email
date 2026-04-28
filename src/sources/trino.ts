import type { ShipmentRecord } from '../types.ts';

// TODO(david): supply Trino host/catalog/schema/table + the late-shipments query.
// This is the fallback path when parcel-cli is unavailable or returns incomplete data.
export async function fetchFromTrino(_opts: {
  host: string;
  user: string;
  catalog: string;
  schema: string;
}): Promise<ShipmentRecord[]> {
  throw new Error('Trino fallback not implemented — pending table/query details from Live Ops');
}
