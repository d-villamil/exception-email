import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

export async function createDraft(opts: {
  auth: OAuth2Client;
  from: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ draftId: string }> {
  const gmail = google.gmail({ version: 'v1', auth: opts.auth });
  const raw = encodeMessage(opts);
  const res = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: { message: { raw } },
  });
  const id = res.data.id;
  if (!id) throw new Error('Gmail returned a draft with no id');
  return { draftId: id };
}

export async function sendMessage(opts: {
  auth: OAuth2Client;
  from: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ messageId: string }> {
  const gmail = google.gmail({ version: 'v1', auth: opts.auth });
  const raw = encodeMessage(opts);
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
  const id = res.data.id;
  if (!id) throw new Error('Gmail returned a sent message with no id');
  return { messageId: id };
}

function encodeMessage(opts: { from: string; to: string; subject: string; body: string }): string {
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${encodeSubject(opts.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
  ].join('\r\n');
  const mime = `${headers}\r\n\r\n${opts.body}`;
  return Buffer.from(mime, 'utf8').toString('base64url');
}

function encodeSubject(subject: string): string {
  // RFC 2047 encoded-word for non-ASCII (we have →) so Gmail renders the arrow correctly.
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}
