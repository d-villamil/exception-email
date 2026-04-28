// Slack delivery is implemented via the Slack MCP server's slack_send_message tool
// at the orchestration layer. This module defines the shape of a Slack post so the
// orchestrator can hand it off to the MCP client without coupling business logic to
// the MCP transport.

export type SlackPost = {
  channel: string;
  text: string;
};

export type SlackPoster = (post: SlackPost) => Promise<{ ts: string; channel: string }>;

export const dryRunSlackPoster: SlackPoster = async (post) => {
  // eslint-disable-next-line no-console
  console.log(`[slack:dry-run] -> ${post.channel}\n${post.text}\n`);
  return { ts: `dryrun-${Date.now()}`, channel: post.channel };
};
