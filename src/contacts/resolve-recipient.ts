import ExcelJS from 'exceljs';
import type { RecipientChannel } from '../types.ts';

export type CarrierRecord = {
  carrier: string;
  emails: string[];
  channelOrNote?: string;
};

const WARP = 'warp';

export async function parseCarriersWorkbook(path: string): Promise<CarrierRecord[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const sheet = wb.getWorksheet('Carriers');
  if (!sheet) throw new Error(`Carriers sheet not found in ${path}`);

  const records: CarrierRecord[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return;
    const carrier = stringCell(row.getCell(1));
    const emailCell = stringCell(row.getCell(2));
    const channelCell = stringCell(row.getCell(3));
    if (!carrier || !emailCell) return;
    records.push({
      carrier,
      emails: splitEmails(emailCell),
      channelOrNote: channelCell || undefined,
    });
  });
  return records;
}

export function buildResolver(
  records: CarrierRecord[],
  slackChannelForWarp: string,
): (carrierName: string | undefined) => RecipientChannel {
  const byKey = new Map<string, CarrierRecord>();
  for (const r of records) byKey.set(normalize(r.carrier), r);

  return (carrierName) => {
    if (!carrierName) return { kind: 'unknown' };
    const key = normalize(carrierName);
    if (key === WARP) return { kind: 'slack', channel: slackChannelForWarp, carrier: 'Warp' };
    const rec = byKey.get(key);
    if (!rec || rec.emails.length === 0) return { kind: 'unknown', carrier: carrierName };
    return { kind: 'email', to: rec.emails.join(', '), carrier: rec.carrier };
  };
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function splitEmails(s: string): string[] {
  return s
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter((p) => /@/.test(p));
}

function stringCell(cell: ExcelJS.Cell): string {
  const v = cell?.value;
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object' && 'text' in v && typeof (v as { text: unknown }).text === 'string') {
    return ((v as { text: string }).text).trim();
  }
  if (typeof v === 'object' && 'richText' in v) {
    const rt = (v as { richText: { text: string }[] }).richText;
    return rt.map((p) => p.text).join('').trim();
  }
  return String(v).trim();
}
