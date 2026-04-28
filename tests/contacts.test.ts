import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildResolver, type CarrierRecord } from '../src/contacts/resolve-recipient.ts';

const fixture: CarrierRecord[] = [
  { carrier: 'Warp', emails: ['doordash@wearewarp.com'], channelOrNote: '#warp_dd_ops_ext  24/7' },
  { carrier: 'Bally', emails: ['doordash@ballylogistics.com'] },
  { carrier: 'Omni', emails: ['doordashtrucking@omnilogistics.com', 'ordforwarding@omnilogistics.com'] },
  { carrier: 'CHR', emails: ['DoorDash@chrobinson.com'], channelOrNote: '#chr_dd_ops_ext Business hours' },
  { carrier: 'Staples', emails: ['CommandCenter@staples.com'] },
];

describe('buildResolver', () => {
  const resolve = buildResolver(fixture, '#warp_dd_ops_ext');

  it('routes Warp to slack regardless of email', () => {
    const r = resolve('Warp');
    assert.equal(r.kind, 'slack');
    if (r.kind === 'slack') {
      assert.equal(r.channel, '#warp_dd_ops_ext');
      assert.equal(r.carrier, 'Warp');
    }
  });
  it('is case-insensitive on carrier name', () => {
    const r = resolve('warp');
    assert.equal(r.kind, 'slack');
  });
  it('returns email for known carriers', () => {
    const r = resolve('Bally');
    assert.equal(r.kind, 'email');
    if (r.kind === 'email') assert.equal(r.to, 'doordash@ballylogistics.com');
  });
  it('joins multiple emails for carriers with multiple contacts', () => {
    const r = resolve('Omni');
    if (r.kind !== 'email') throw new Error('expected email');
    assert.match(r.to, /doordashtrucking@omnilogistics.com/);
    assert.match(r.to, /ordforwarding@omnilogistics.com/);
  });
  it('returns unknown for unmapped carriers', () => {
    const r = resolve('SomeCarrier');
    assert.equal(r.kind, 'unknown');
    if (r.kind === 'unknown') assert.equal(r.carrier, 'SomeCarrier');
  });
  it('returns unknown when carrier is missing', () => {
    const r = resolve(undefined);
    assert.equal(r.kind, 'unknown');
  });
});
