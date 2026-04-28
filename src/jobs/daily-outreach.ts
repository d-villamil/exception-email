import { parseArgs } from 'node:util';
import { loadConfig } from '../config/index.ts';
import { evaluate } from '../eligibility/needs-outreach.ts';
import { buildResolver, parseCarriersWorkbook } from '../contacts/resolve-recipient.ts';
import { renderEmail } from '../templates/render-email.ts';
import { renderSlack } from '../templates/render-slack.ts';
import { loadSentStore } from '../dedupe/sent-store.ts';
import { newRunId, openAuditLogger } from '../audit/log-run.ts';
import { fetchFromFixture } from '../sources/fixture.ts';
import { fetchFromParcelCli } from '../sources/parcel-cli.ts';
import { dryRunSlackPoster, type SlackPoster } from '../slack/post.ts';
import { createDraft, sendMessage } from '../gmail/create-draft.ts';
import { loadOAuthClient } from '../gmail/auth.ts';
import type { DeliveryResult, RecipientChannel, ShipmentRecord } from '../types.ts';

type CliOpts = { source: 'fixture' | 'parcel-cli'; mode: 'draft' | 'send'; fixture?: string };

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const opts = parseCli(argv);
  const cfg = loadConfig();
  const runId = newRunId();
  const audit = await openAuditLogger(cfg.auditLogPath);
  const sent = await loadSentStore(cfg.sentStorePath);

  const carriers = await parseCarriersWorkbook(cfg.contactsXlsx);
  const resolve = buildResolver(carriers, cfg.slackChannelWarp);

  const shipments = await pullShipments(opts, cfg);

  const slackPoster: SlackPoster = dryRunSlackPoster; // TODO: wire Slack MCP for real runs
  const gmailDeliver = await buildGmailDeliver(cfg, opts.mode);

  let qualified = 0;
  let delivered = 0;
  let skipped = 0;

  for (const shipment of shipments) {
    const decision = evaluate(shipment, cfg.lateThresholdMin);
    let recipient: RecipientChannel = { kind: 'unknown' };
    let delivery: DeliveryResult = { kind: 'skipped', reason: decision.reason };

    if (decision.qualifiesForOutreach) {
      qualified += 1;
      if (sent.has(shipment.shipmentId)) {
        delivery = { kind: 'skipped', reason: 'already emailed in a prior run' };
        skipped += 1;
      } else {
        recipient = resolve(shipment.carrierName);
        delivery = await deliver(shipment, recipient, slackPoster, gmailDeliver);
        if (delivery.kind === 'draft' || delivery.kind === 'sent' || delivery.kind === 'slack') {
          sent.add(shipment.shipmentId);
          delivered += 1;
        }
      }
    } else {
      skipped += 1;
    }

    await audit.record({
      runId,
      ts: new Date().toISOString(),
      shipmentId: shipment.shipmentId,
      qualifiesForOutreach: decision.qualifiesForOutreach,
      reason: decision.reason,
      sourceUsed: decision.sourceUsed,
      recipient,
      delivery,
    });
  }

  await sent.flush();
  // eslint-disable-next-line no-console
  console.log(
    `run=${runId} shipments=${shipments.length} qualified=${qualified} delivered=${delivered} skipped=${skipped}`,
  );
}

async function pullShipments(opts: CliOpts, cfg: ReturnType<typeof loadConfig>): Promise<ShipmentRecord[]> {
  if (opts.source === 'fixture') {
    return fetchFromFixture(opts.fixture ?? 'tests/fixtures/shipments.sample.json');
  }
  return fetchFromParcelCli({ bin: cfg.parcelCli.bin, args: cfg.parcelCli.args });
}

type GmailDeliverFn =
  | ((to: string, subject: string, body: string) => Promise<DeliveryResult>)
  | null;

async function buildGmailDeliver(
  cfg: ReturnType<typeof loadConfig>,
  mode: 'draft' | 'send',
): Promise<GmailDeliverFn> {
  try {
    const auth = await loadOAuthClient({
      credentialsPath: cfg.gmail.credentialsPath,
      tokenPath: cfg.gmail.tokenPath,
    });
    return async (to, subject, body) => {
      if (mode === 'draft') {
        const { draftId } = await createDraft({ auth, from: cfg.gmail.from, to, subject, body });
        return { kind: 'draft', draftId };
      }
      const { messageId } = await sendMessage({ auth, from: cfg.gmail.from, to, subject, body });
      return { kind: 'sent', messageId };
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[gmail] auth unavailable, dry-run only: ${(err as Error).message}`);
    return null;
  }
}

async function deliver(
  shipment: ShipmentRecord,
  recipient: RecipientChannel,
  slackPoster: SlackPoster,
  gmailDeliver: GmailDeliverFn,
): Promise<DeliveryResult> {
  if (recipient.kind === 'unknown') {
    return { kind: 'skipped', reason: `no recipient mapped for carrier "${shipment.carrierName ?? 'unknown'}"` };
  }
  if (recipient.kind === 'slack') {
    const text = renderSlack(shipment);
    const res = await slackPoster({ channel: recipient.channel, text });
    return { kind: 'slack', ts: res.ts, channel: res.channel };
  }
  const { subject, body } = renderEmail(shipment);
  if (!gmailDeliver) {
    // eslint-disable-next-line no-console
    console.log(`[gmail:dry-run] To: ${recipient.to}\nSubject: ${subject}\n\n${body}\n`);
    return { kind: 'draft', draftId: `dryrun-${shipment.shipmentId}` };
  }
  return gmailDeliver(recipient.to, subject, body);
}

function parseCli(argv: string[]): CliOpts {
  const { values } = parseArgs({
    args: argv,
    options: {
      source: { type: 'string', default: 'parcel-cli' },
      mode: { type: 'string', default: 'draft' },
      fixture: { type: 'string' },
    },
    allowPositionals: false,
  });
  const source = values.source as string;
  const mode = values.mode as string;
  if (source !== 'fixture' && source !== 'parcel-cli') {
    throw new Error(`--source must be 'fixture' or 'parcel-cli', got: ${source}`);
  }
  if (mode !== 'draft' && mode !== 'send') {
    throw new Error(`--mode must be 'draft' or 'send', got: ${mode}`);
  }
  return { source, mode, fixture: values.fixture as string | undefined };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
