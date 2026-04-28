export type SourceSystem = 'parcel-cli' | 'trino' | 'fixture';

export type LateEvent =
  | 'origin-arrival'
  | 'origin-departure'
  | 'destination-arrival'
  | 'destination-departure';

export type ShipmentRecord = {
  shipmentId: string;
  pro?: string;
  carrierName?: string;
  carrierCode?: string;
  origin: string;
  destination: string;
  routeAllStops?: string[];
  scheduledTime?: string;
  actualTime?: string | null;
  latestStatusTime?: string | null;
  minutesLate: number;
  exceptionField?: string | null;
  lateEvent?: LateEvent;
  deliveryDate?: string;
  contactEmail?: string | null;
  sourceSystem: SourceSystem;
};

export type OutreachDecision = {
  shipmentId: string;
  qualifiesForOutreach: boolean;
  reason: string;
  sourceUsed: SourceSystem;
};

export type RecipientChannel =
  | { kind: 'email'; to: string; carrier: string }
  | { kind: 'slack'; channel: string; carrier: string }
  | { kind: 'unknown'; carrier?: string };

export type DeliveryResult =
  | { kind: 'draft'; draftId: string }
  | { kind: 'sent'; messageId: string }
  | { kind: 'slack'; ts: string; channel: string }
  | { kind: 'skipped'; reason: string }
  | { kind: 'error'; error: string };

export type AuditRecord = {
  runId: string;
  ts: string;
  shipmentId: string;
  qualifiesForOutreach: boolean;
  reason: string;
  sourceUsed: SourceSystem;
  recipient: RecipientChannel;
  delivery: DeliveryResult;
};
