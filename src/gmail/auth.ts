import { readFile, writeFile } from 'node:fs/promises';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

// TODO(david): create an OAuth client (Desktop app type) for the Google account
// that owns dashlinkmm@gmail.com, save the credentials JSON to GMAIL_OAUTH_CREDENTIALS,
// and run a one-time authorize step to populate GMAIL_TOKEN_PATH.
// Scopes required: https://www.googleapis.com/auth/gmail.compose (for drafts) or
// https://www.googleapis.com/auth/gmail.send (when switching to live send).

export async function loadOAuthClient(opts: {
  credentialsPath: string;
  tokenPath: string;
}): Promise<OAuth2Client> {
  const creds = JSON.parse(await readFile(opts.credentialsPath, 'utf8')) as {
    installed?: { client_id: string; client_secret: string; redirect_uris: string[] };
    web?: { client_id: string; client_secret: string; redirect_uris: string[] };
  };
  const c = creds.installed ?? creds.web;
  if (!c) throw new Error('Gmail OAuth credentials missing installed/web block');

  const oauth = new google.auth.OAuth2(c.client_id, c.client_secret, c.redirect_uris[0]);

  try {
    const token = JSON.parse(await readFile(opts.tokenPath, 'utf8')) as Record<string, unknown>;
    oauth.setCredentials(token);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    throw new Error(
      `No Gmail token at ${opts.tokenPath}. Run the one-time authorize flow to generate it (TODO).`,
    );
  }

  oauth.on('tokens', async (tokens) => {
    if (!tokens.refresh_token) return;
    await writeFile(opts.tokenPath, JSON.stringify(tokens, null, 2), 'utf8');
  });

  return oauth;
}
