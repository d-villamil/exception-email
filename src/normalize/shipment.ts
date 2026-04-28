import type { LateEvent, ShipmentRecord, SourceSystem } from '../types.ts';

export type RawShipment = {
  shipmentId: string;
  pro?: string;
  carrierName?: string;
  carrierCode?: string;
  origin: string;
  destination: string;
  routeAllStops?: string[];
  deliveryDate?: string;
  exceptionField?: string | null;
  // Either provide minutesLate directly, or provide scheduled+actual to derive it.
  minutesLate?: number;
  scheduledTime?: string;
  actualTime?: string | null;
  latestStatusTime?: string | null;
  lateEvent?: LateEvent;
};

export function normalize(raw: RawShipment, source: SourceSystem): ShipmentRecord {
  const minutesLate =
    typeof raw.minutesLate === 'number'
      ? raw.minutesLate
      : computeMinutesLate(raw.scheduledTime, raw.actualTime ?? raw.latestStatusTime);

  if (minutesLate == null) {
    throw new Error(`shipment ${raw.shipmentId}: cannot determine minutesLate`);
  }

  return {
    shipmentId: raw.shipmentId,
    pro: raw.pro,
    carrierName: raw.carrierName?.trim(),
    carrierCode: raw.carrierCode?.trim(),
    origin: raw.origin.trim(),
    destination: raw.destination.trim(),
    routeAllStops: raw.routeAllStops,
    scheduledTime: raw.scheduledTime,
    actualTime: raw.actualTime ?? null,
    latestStatusTime: raw.latestStatusTime ?? null,
    minutesLate,
    exceptionField: raw.exceptionField ?? null,
    lateEvent: raw.lateEvent,
    deliveryDate: raw.deliveryDate,
    sourceSystem: source,
  };
}

export function computeMinutesLate(scheduled: string | undefined, actual: string | null | undefined): number | null {
  if (!scheduled || !actual) return null;
  const s = Date.parse(scheduled);
  const a = Date.parse(actual);
  if (Number.isNaN(s) || Number.isNaN(a)) return null;
  return Math.max(0, Math.round((a - s) / 60000));
}
