import 'dotenv/config';

export type AppConfig = {
  outreachMode: 'draft' | 'send';
  gmail: {
    credentialsPath: string;
    tokenPath: string;
    from: string;
  };
  contactsXlsx: string;
  sentStorePath: string;
  auditLogPath: string;
  parcelCli: { bin: string; args: string[] };
  trino: { host: string; user: string; catalog: string; schema: string };
  slackChannelWarp: string;
  lateThresholdMin: number;
  runTz: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const mode = env.OUTREACH_MODE ?? 'draft';
  if (mode !== 'draft' && mode !== 'send') {
    throw new Error(`OUTREACH_MODE must be 'draft' or 'send', got: ${mode}`);
  }
  return {
    outreachMode: mode,
    gmail: {
      credentialsPath: env.GMAIL_OAUTH_CREDENTIALS ?? './secrets/gmail-oauth.json',
      tokenPath: env.GMAIL_TOKEN_PATH ?? './state/gmail-token.json',
      from: env.GMAIL_FROM ?? 'dashlinkmm@gmail.com',
    },
    contactsXlsx: env.CONTACTS_XLSX ?? '../T&T Contacts.xlsx',
    sentStorePath: env.SENT_STORE_PATH ?? './state/sent-shipments.json',
    auditLogPath: env.AUDIT_LOG_PATH ?? './state/audit.jsonl',
    parcelCli: {
      bin: env.PARCEL_CLI_BIN ?? 'parcel-cli',
      args: env.PARCEL_CLI_ARGS ? env.PARCEL_CLI_ARGS.split(' ').filter(Boolean) : [],
    },
    trino: {
      host: env.TRINO_HOST ?? '',
      user: env.TRINO_USER ?? '',
      catalog: env.TRINO_CATALOG ?? '',
      schema: env.TRINO_SCHEMA ?? '',
    },
    slackChannelWarp: env.SLACK_CHANNEL_WARP ?? '#warp_dd_ops_ext',
    lateThresholdMin: Number(env.LATE_THRESHOLD_MIN ?? 15),
    runTz: env.RUN_TZ ?? 'America/Los_Angeles',
  };
}
