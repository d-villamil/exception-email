import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSentStore } from '../src/dedupe/sent-store.ts';

async function workdir(): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'sent-store-'));
  return { path: join(dir, 'sent-shipments.json'), cleanup: () => rm(dir, { recursive: true, force: true }) };
}

describe('SentStore', () => {
  it('starts empty when the file does not exist', async () => {
    const { path, cleanup } = await workdir();
    try {
      const store = await loadSentStore(path);
      assert.equal(store.has('DL1'), false);
      assert.equal(store.size(), 0);
    } finally { await cleanup(); }
  });

  it('persists added IDs across loads', async () => {
    const { path, cleanup } = await workdir();
    try {
      const a = await loadSentStore(path);
      a.add('DL1');
      a.add('DL2');
      await a.flush();
      const b = await loadSentStore(path);
      assert.equal(b.has('DL1'), true);
      assert.equal(b.has('DL2'), true);
      assert.equal(b.has('DL3'), false);
      assert.equal(b.size(), 2);
    } finally { await cleanup(); }
  });

  it('dedupes within a single store', async () => {
    const { path, cleanup } = await workdir();
    try {
      const a = await loadSentStore(path);
      a.add('DL1');
      a.add('DL1');
      assert.equal(a.size(), 1);
    } finally { await cleanup(); }
  });
});
