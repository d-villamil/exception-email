import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type SentStore = {
  has(shipmentId: string): boolean;
  add(shipmentId: string): void;
  size(): number;
  flush(): Promise<void>;
};

export async function loadSentStore(path: string): Promise<SentStore> {
  const ids = new Set<string>();
  try {
    const text = await readFile(path, 'utf8');
    const parsed = JSON.parse(text) as { shipmentIds?: string[] };
    for (const id of parsed.shipmentIds ?? []) ids.add(id);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  return {
    has: (id) => ids.has(id),
    add: (id) => { ids.add(id); },
    size: () => ids.size,
    flush: async () => {
      await mkdir(dirname(path), { recursive: true });
      const payload = { shipmentIds: [...ids].sort() };
      await writeFile(path, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    },
  };
}
