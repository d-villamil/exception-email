import type { ShipmentRecord } from '../types.ts';
import { bodyText, subjectLine } from './render-email.ts';

export function renderSlack(s: ShipmentRecord): string {
  return [`*${subjectLine(s)}*`, '', bodyText(s)].join('\n');
}
