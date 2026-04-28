// One-time OAuth bootstrap for dashlinkmm@gmail.com.
//
// Run once after dropping the Desktop OAuth client JSON into
// secrets/gmail-oauth.json:  npm run authorize
//
// What happens:
//   1. Reads the OAuth client credentials.
//   2. Spins up a localhost HTTP listener on a free port.
//   3. Builds the Google consent URL with that loopback as redirect_uri.
//   4. Prints the URL (you click it, sign in as dashlinkmm@gmail.com, grant access).
//   5. The browser redirects back to localhost with an auth code.
//   6. Exchanges the code for refresh + access tokens; writes them to
//      state/gmail-token.json with mode 0600.
//
// Re-run if the refresh token gets revoked or scopes change.

import { createServer } from 'node:http';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { google } from 'googleapis';
import 'dotenv/config';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose', // create & list drafts
  'https://www.googleapis.com/auth/gmail.send', // send (used when OUTREACH_MODE=send)
];

type DesktopCreds = {
  installed?: { client_id: string; client_secret: string };
  web?: { client_id: string; client_secret: string };
};

async function main(): Promise<void> {
  const credentialsPath = process.env.GMAIL_OAUTH_CREDENTIALS ?? './secrets/gmail-oauth.json';
  const tokenPath = process.env.GMAIL_TOKEN_PATH ?? './state/gmail-token.json';

  const creds = JSON.parse(await readFile(credentialsPath, 'utf8')) as DesktopCreds;
  const block = creds.installed ?? creds.web;
  if (!block) {
    throw new Error(`OAuth credentials at ${credentialsPath} are missing the 'installed' (Desktop) or 'web' block.`);
  }

  const port = await pickPort();
  const redirectUri = `http://127.0.0.1:${port}`;
  const oauth = new google.auth.OAuth2(block.client_id, block.client_secret, redirectUri);

  const state = randomBytes(16).toString('hex');
  const url = oauth.generateAuthUrl({
    access_type: 'offline', // get a refresh_token
    prompt: 'consent', // force re-consent so refresh_token is always returned
    scope: SCOPES,
    state,
  });

  console.log('\nOpen this URL in a browser signed in as dashlinkmm@gmail.com:\n');
  console.log(url);
  console.log('\nWaiting for the redirect...\n');

  const code = await waitForCallback(port, state);
  const { tokens } = await oauth.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh_token. Revoke the previous grant at https://myaccount.google.com/permissions and re-run.',
    );
  }

  await mkdir(dirname(tokenPath), { recursive: true });
  await writeFile(tokenPath, JSON.stringify(tokens, null, 2), 'utf8');
  await chmod(tokenPath, 0o600);

  console.log(`Saved tokens to ${tokenPath}`);
  console.log('Scopes granted:', tokens.scope);
}

function pickPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const addr = probe.address();
      if (typeof addr === 'object' && addr) {
        const port = addr.port;
        probe.close(() => resolve(port));
      } else {
        probe.close();
        reject(new Error('failed to pick a free port'));
      }
    });
  });
}

function waitForCallback(port: number, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('timed out waiting for OAuth callback (5 minutes)'));
    }, 5 * 60_000);

    const server = createServer((req, res) => {
      try {
        const u = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
        const code = u.searchParams.get('code');
        const state = u.searchParams.get('state');
        const error = u.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end(`Authorization failed: ${error}\nYou can close this tab.`);
          clearTimeout(timer);
          server.close();
          reject(new Error(`Google returned error: ${error}`));
          return;
        }
        if (!code || state !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Missing code or state mismatch. You can close this tab.');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Authorization complete. You can close this tab.');
        clearTimeout(timer);
        server.close();
        resolve(code);
      } catch (e) {
        clearTimeout(timer);
        server.close();
        reject(e as Error);
      }
    });

    server.listen(port, '127.0.0.1');
    server.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

main().catch((err) => {
  console.error('\nauthorize failed:', (err as Error).message);
  process.exit(1);
});
