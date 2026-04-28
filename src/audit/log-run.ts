import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AuditRecord } from '../types.ts';

export type AuditLogger = {
  record(entry: AuditRecord): Promise<void>;
};

export async function openAuditLogger(path: string): Promise<AuditLogger> {
  await mkdir(dirname(path), { recursive: true });
  return {
    record: async (entry) => {
      await appendFile(path, JSON.stringify(entry) + '\n', 'utf8');
    },
  };
}

export function newRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
