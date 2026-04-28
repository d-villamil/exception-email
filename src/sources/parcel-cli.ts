import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { LateEvent, ShipmentRecord } from '../types.ts';

const exec = promisify(execFile);

// parcel-cli's shipment-list response is column-oriented, but each row is delivered
// as a full object keyed by column name. We only model the fields we need.
type StopReason = 'STOP_REASON_PICKUP' | 'STOP_REASON_DROPOFF' | string;
type TimestampType =
  | 'STOP_EXCEPTION_TIMESTAMP_TYPE_ARRIVAL'
  | 'STOP_EXCEPTION_TIMESTAMP_TYPE_DEPARTURE'
  | string;

type StopException = {
  reason_code: string;
  stop_warehouse_code?: string;
  timestamp_type?: TimestampType;
  notes?: string | null;
};

type ShipmentStop = {
  warehouse_id: string;
  stop_reason: StopReason;
};

export type ParcelCliRow = {
  shipment_id: string;
  carrier_reference_id?: string;
  carrier?: { carrier_name?: string } | null;
  is_late?: boolean;
  is_test?: boolean;
  shipment_stops: ShipmentStop[];
  stop_exceptions?: StopException[] | null;
  appointment_time_at_origin?: string | null;
  actual_pick_up_time_at_origin?: string | null;
  scheduled_departure?: string | null;
  actual_departure_time_at_origin?: string | null;
  delivery_appointment_time_at_destination?: string | null;
  actual_dropoff_time_at_destination?: string | null;
  actual_departure_time_at_destination?: string | null;
};

type ParcelCliResponse = {
  ok: boolean;
  data: { columns: string[]; row_count: number; rows: ParcelCliRow[] };
};

const NONE_REASON = 'SHIPMENT_EXCEPTION_REASON_CODE_NONE';

// Map parcel-cli carrier_name strings to the spelling used in the Carriers tab
// (T&T Contacts.xlsx). Anything not in this map passes through unchanged and will
// fail recipient resolution if it isn't already a Carriers-tab key.
const CARRIER_NAME_CANONICAL: Record<string, string> = {
  'CH Robinson': 'CHR',
  'Omni Logistics': 'Omni',
};

export async function fetchFromParcelCli(opts: {
  bin: string;
  args: string[];
}): Promise<ShipmentRecord[]> {
  const { stdout } = await exec(opts.bin, opts.args, { maxBuffer: 64 * 1024 * 1024 });
  return parseShipmentListOutput(stdout);
}

export function parseShipmentListOutput(stdout: string): ShipmentRecord[] {
  const trimmed = stdout.trim();
  if (!trimmed) return [];
  const payload = JSON.parse(trimmed) as ParcelCliResponse;
  if (!payload.ok || !payload.data?.rows) {
    throw new Error('parcel-cli returned a non-ok response or no rows');
  }
  return payload.data.rows
    .filter((r) => !r.is_test && r.is_late === true)
    .map(rowToShipment)
    .filter((s): s is ShipmentRecord => s !== null);
}

export function rowToShipment(row: ParcelCliRow): ShipmentRecord | null {
  const pickup = row.shipment_stops.find((s) => s.stop_reason === 'STOP_REASON_PICKUP');
  const dropoff = row.shipment_stops.find((s) => s.stop_reason === 'STOP_REASON_DROPOFF');
  if (!pickup || !dropoff) return null;

  const slip = firstSlip(row);
  const carrierRaw = row.carrier?.carrier_name?.trim();
  const carrierName = carrierRaw ? (CARRIER_NAME_CANONICAL[carrierRaw] ?? carrierRaw) : undefined;

  return {
    shipmentId: row.shipment_id,
    pro: row.carrier_reference_id ?? undefined,
    carrierName,
    origin: pickup.warehouse_id,
    destination: dropoff.warehouse_id,
    routeAllStops: row.shipment_stops.map((s) => s.warehouse_id),
    scheduledTime: slip?.scheduled,
    actualTime: slip?.actual ?? null,
    minutesLate: slip?.minutesLate ?? 0,
    exceptionField: aggregateException(row.stop_exceptions),
    lateEvent: slip?.event,
    deliveryDate: row.delivery_appointment_time_at_destination ?? row.scheduled_departure ?? undefined,
    sourceSystem: 'parcel-cli',
  };
}

// Aggregates `stop_exceptions` to a single human-readable string.
// Returns null when every entry is _NONE or the array is empty (treated as "no exception").
function aggregateException(exceptions: StopException[] | null | undefined): string | null {
  if (!exceptions || exceptions.length === 0) return null;
  const real = exceptions.filter((e) => e.reason_code && e.reason_code !== NONE_REASON);
  if (real.length === 0) return null;
  return real[0]!.reason_code;
}

type Slip = {
  event: LateEvent;
  scheduled: string;
  actual: string;
  minutesLate: number;
};

// Walks the shipment timeline in chronological order and returns the FIRST event
// that slipped, along with how many minutes late it was. Returning the first
// slip rather than the worst slip gives carriers the root-cause event to explain.
function firstSlip(row: ParcelCliRow): Slip | undefined {
  const candidates: Array<{ event: LateEvent; scheduled?: string | null; actual?: string | null }> = [
    { event: 'origin-arrival', scheduled: row.appointment_time_at_origin, actual: row.actual_pick_up_time_at_origin },
    { event: 'origin-departure', scheduled: row.scheduled_departure, actual: row.actual_departure_time_at_origin },
    { event: 'destination-arrival', scheduled: row.delivery_appointment_time_at_destination, actual: row.actual_dropoff_time_at_destination },
  ];

  for (const c of candidates) {
    if (!c.scheduled || !c.actual) continue;
    const minutesLate = diffMinutes(c.scheduled, c.actual);
    if (minutesLate >= 1) return { event: c.event, scheduled: c.scheduled, actual: c.actual, minutesLate };
  }
  return undefined;
}

function diffMinutes(scheduledIso: string, actualIso: string): number {
  const s = Date.parse(scheduledIso);
  const a = Date.parse(actualIso);
  if (Number.isNaN(s) || Number.isNaN(a)) return 0;
  return Math.max(0, Math.round((a - s) / 60000));
}
