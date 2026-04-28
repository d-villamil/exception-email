import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, lateEventDescriptor, renderEmail, subjectLine } from '../src/templates/render-email.ts';
import { renderSlack } from '../src/templates/render-slack.ts';
import type { ShipmentRecord } from '../src/types.ts';

const base: ShipmentRecord = {
  shipmentId: 'DL5A625QTRE3239',
  pro: '1731092566',
  origin: 'PETCO-CA-1',
  destination: 'LAX-11',
  deliveryDate: '2026-04-25T00:00:00.000Z',
  minutesLate: 47,
  exceptionField: null,
  lateEvent: 'destination-arrival',
  carrierName: 'Bally',
  sourceSystem: 'fixture',
};

describe('subjectLine', () => {
  it('matches the SOP example format', () => {
    assert.equal(subjectLine(base), 'PETCO-CA-1 → LAX-11 1731092566 / DL5A625QTRE3239 4/25');
  });
  it('uses origin → destination only even if a multi-stop route is supplied', () => {
    const s: ShipmentRecord = { ...base, routeAllStops: ['LAX-11', 'CLV-1', 'SAC-4'], origin: 'LAX-11', destination: 'SAC-4' };
    assert.equal(subjectLine(s), 'LAX-11 → SAC-4 1731092566 / DL5A625QTRE3239 4/25');
  });
  it('drops the date if missing', () => {
    const s = { ...base, deliveryDate: undefined };
    assert.equal(subjectLine(s), 'PETCO-CA-1 → LAX-11 1731092566 / DL5A625QTRE3239');
  });
});

describe('lateEventDescriptor', () => {
  it('renders all four cases', () => {
    assert.equal(lateEventDescriptor('origin-arrival'), 'origin arrival');
    assert.equal(lateEventDescriptor('origin-departure'), 'origin departure');
    assert.equal(lateEventDescriptor('destination-arrival'), 'destination arrival');
    assert.equal(lateEventDescriptor('destination-departure'), 'destination departure');
  });
  it('falls back when missing', () => {
    assert.equal(lateEventDescriptor(undefined), 'this shipment');
  });
});

describe('formatDuration', () => {
  it('uses minutes under an hour', () => {
    assert.equal(formatDuration(15), '15 mins');
    assert.equal(formatDuration(59), '59 mins');
  });
  it('uses hours when >= 60', () => {
    assert.equal(formatDuration(60), '1 hr');
    assert.equal(formatDuration(90), '1 hr 30 mins');
    assert.equal(formatDuration(125), '2 hr 5 mins');
  });
});

describe('renderEmail', () => {
  it('produces the SOP body shape', () => {
    const { body } = renderEmail(base);
    assert.match(body, /DELAY INQUIRY/);
    assert.match(body, /Good morning team,/);
    assert.match(body, /delay on destination arrival by 47 mins/);
    assert.match(body, /Thank you!/);
  });
});

describe('renderSlack', () => {
  it('prefaces with bolded subject so the post is self-contained', () => {
    const out = renderSlack(base);
    assert.match(out, /^\*PETCO-CA-1 → LAX-11 1731092566 \/ DL5A625QTRE3239 4\/25\*/);
    assert.match(out, /DELAY INQUIRY/);
  });
});
