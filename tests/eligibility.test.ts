import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, isBlank } from '../src/eligibility/needs-outreach.ts';
import type { ShipmentRecord } from '../src/types.ts';

function shipment(over: Partial<ShipmentRecord> = {}): ShipmentRecord {
  return {
    shipmentId: 'DLTEST',
    origin: 'LAX-11',
    destination: 'DTX-1',
    minutesLate: 30,
    exceptionField: null,
    sourceSystem: 'fixture',
    ...over,
  };
}

describe('isBlank', () => {
  it('treats null/undefined/empty/whitespace as blank', () => {
    assert.equal(isBlank(null), true);
    assert.equal(isBlank(undefined), true);
    assert.equal(isBlank(''), true);
    assert.equal(isBlank('   '), true);
    assert.equal(isBlank('\t\n'), true);
  });
  it('treats real text as non-blank', () => {
    assert.equal(isBlank('traffic'), false);
    assert.equal(isBlank('  traffic  '), false);
  });
});

describe('evaluate', () => {
  it('qualifies when late >= threshold and exception is blank', () => {
    const d = evaluate(shipment({ minutesLate: 15, exceptionField: null }));
    assert.equal(d.qualifiesForOutreach, true);
  });
  it('does not qualify just below threshold', () => {
    const d = evaluate(shipment({ minutesLate: 14, exceptionField: null }));
    assert.equal(d.qualifiesForOutreach, false);
    assert.match(d.reason, /not late enough/);
  });
  it('does not qualify when an exception is set', () => {
    const d = evaluate(shipment({ minutesLate: 60, exceptionField: 'traffic' }));
    assert.equal(d.qualifiesForOutreach, false);
    assert.match(d.reason, /exception already set/);
  });
  it('treats whitespace-only exception as blank', () => {
    const d = evaluate(shipment({ minutesLate: 20, exceptionField: '   ' }));
    assert.equal(d.qualifiesForOutreach, true);
  });
  it('respects a custom threshold', () => {
    const d = evaluate(shipment({ minutesLate: 18, exceptionField: null }), 20);
    assert.equal(d.qualifiesForOutreach, false);
  });
  it('propagates sourceUsed', () => {
    const d = evaluate(shipment({ sourceSystem: 'trino' }));
    assert.equal(d.sourceUsed, 'trino');
  });
});
