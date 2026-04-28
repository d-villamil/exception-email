import type { LateEvent, ShipmentRecord } from '../types.ts';

export type RenderedEmail = { subject: string; body: string };

export function renderEmail(s: ShipmentRecord): RenderedEmail {
  return { subject: subjectLine(s), body: bodyText(s) };
}

export function subjectLine(s: ShipmentRecord): string {
  const lane = `${s.origin} → ${s.destination}`;
  const ids = [s.pro, s.shipmentId].filter(Boolean).join(' / ');
  const date = formatShortDate(s.deliveryDate);
  return [lane, ids, date].filter(Boolean).join(' ').trim();
}

export function bodyText(s: ShipmentRecord): string {
  const descriptor = lateEventDescriptor(s.lateEvent);
  const duration = formatDuration(s.minutesLate);
  return [
    'DELAY INQUIRY',
    '',
    'Good morning team,',
    '',
    `We see there was a delay on ${descriptor} by ${duration}, are there possible reasons/insights into why there was a delay by any chance?`,
    '',
    'Thank you!',
  ].join('\n');
}

export function lateEventDescriptor(e: LateEvent | undefined): string {
  switch (e) {
    case 'origin-arrival': return 'origin arrival';
    case 'origin-departure': return 'origin departure';
    case 'destination-arrival': return 'destination arrival';
    case 'destination-departure': return 'destination departure';
    default: return 'this shipment';
  }
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} mins`;
  const hr = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${hr} hr`;
  return `${hr} hr ${rem} mins`;
}

function formatShortDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}
