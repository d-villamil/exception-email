import type { OutreachDecision, ShipmentRecord } from '../types.ts';

export const DEFAULT_LATE_THRESHOLD_MIN = 15;

export function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim() === '';
}

export function evaluate(
  shipment: ShipmentRecord,
  thresholdMin: number = DEFAULT_LATE_THRESHOLD_MIN,
): OutreachDecision {
  const lateEnough = shipment.minutesLate >= thresholdMin;
  const blankException = isBlank(shipment.exceptionField);

  if (!lateEnough && !blankException) {
    return decision(shipment, false, `not late enough (${shipment.minutesLate} min) and exception is set`);
  }
  if (!lateEnough) {
    return decision(shipment, false, `not late enough (${shipment.minutesLate} min < ${thresholdMin})`);
  }
  if (!blankException) {
    return decision(shipment, false, `exception already set: ${shipment.exceptionField}`);
  }
  return decision(shipment, true, `late ${shipment.minutesLate} min with no exception`);
}

function decision(s: ShipmentRecord, qualifies: boolean, reason: string): OutreachDecision {
  return {
    shipmentId: s.shipmentId,
    qualifiesForOutreach: qualifies,
    reason,
    sourceUsed: s.sourceSystem,
  };
}
