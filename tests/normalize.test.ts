import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeMinutesLate, normalize } from '../src/normalize/shipment.ts';

describe('computeMinutesLate', () => {
  it('returns minutes between scheduled and actual', () => {
    const m = computeMinutesLate('2026-04-25T10:00:00Z', '2026-04-25T10:47:00Z');
    assert.equal(m, 47);
  });
  it('returns 0 (not negative) for early arrivals', () => {
    const m = computeMinutesLate('2026-04-25T10:00:00Z', '2026-04-25T09:30:00Z');
    assert.equal(m, 0);
  });
  it('returns null for missing inputs', () => {
    assert.equal(computeMinutesLate(undefined, '2026-04-25T10:00:00Z'), null);
    assert.equal(computeMinutesLate('2026-04-25T10:00:00Z', null), null);
  });
});

describe('normalize', () => {
  it('passes minutesLate through when supplied', () => {
    const r = normalize({
      shipmentId: 'DL1',
      origin: 'A',
      destination: 'B',
      minutesLate: 23,
      exceptionField: null,
    }, 'fixture');
    assert.equal(r.minutesLate, 23);
    assert.equal(r.sourceSystem, 'fixture');
  });
  it('derives minutesLate from scheduled + actual when not supplied', () => {
    const r = normalize({
      shipmentId: 'DL2',
      origin: 'A',
      destination: 'B',
      scheduledTime: '2026-04-25T10:00:00Z',
      actualTime: '2026-04-25T10:30:00Z',
      exceptionField: null,
    }, 'parcel-cli');
    assert.equal(r.minutesLate, 30);
    assert.equal(r.sourceSystem, 'parcel-cli');
  });
  it('throws when minutesLate cannot be determined', () => {
    assert.throws(() =>
      normalize({ shipmentId: 'DL3', origin: 'A', destination: 'B', exceptionField: null }, 'fixture'),
      /cannot determine minutesLate/
    );
  });
  it('trims carrier and stop strings', () => {
    const r = normalize({
      shipmentId: 'DL4',
      origin: '  LAX-11 ',
      destination: ' DTX-1 ',
      carrierName: ' Bally ',
      minutesLate: 20,
      exceptionField: null,
    }, 'fixture');
    assert.equal(r.origin, 'LAX-11');
    assert.equal(r.destination, 'DTX-1');
    assert.equal(r.carrierName, 'Bally');
  });
});
