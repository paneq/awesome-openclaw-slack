import { type RetryOptions, WebClient } from "@slack/web-api";

// ── Target parsing ──────────────────────────────────────────────────────────
// Simplified reimplementation of src/slack/targets.ts:parseSlackTarget.
// Handles the same prefixed forms without pulling in the MessagingTarget chain.

export type SlackRecipient = {
  kind: "user" | "channel";
  id: string;
};

export function parseSlackTarget(raw: string): SlackRecipient | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  // <@U123> mention format
  const mentionMatch = trimmed.match(/^<@([A-Z0-9]+)>$/i);
  if (mentionMatch) {
    return { kind: "user", id: mentionMatch[1] };
  }

  // Prefixed forms
  if (trimmed.startsWith("user:")) {
    const id = trimmed.slice("user:".length).trim();
    return id ? { kind: "user", id } : undefined;
  }
  if (trimmed.startsWith("channel:")) {
    const id = trimmed.slice("channel:".length).trim();
    return id ? { kind: "channel", id } : undefined;
  }
  if (trimmed.startsWith("slack:")) {
    const id = trimmed.slice("slack:".length).trim();
    return id ? { kind: "user", id } : undefined;
  }

  // @ prefix → user
  if (trimmed.startsWith("@")) {
    const id = trimmed.slice(1).trim();
    return id ? { kind: "user", id } : undefined;
  }

  // # prefix → channel
  if (trimmed.startsWith("#")) {
    const id = trimmed.slice(1).trim();
    return id ? { kind: "channel", id } : undefined;
  }

  // Bare ID defaults to channel (matches core behavior)
  return { kind: "channel", id: trimmed };
}

// ── WebClient creation ──────────────────────────────────────────────────────
// Mirrors src/slack/client.ts with the same default retry configuration.

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  retries: 2,
  factor: 2,
  minTimeout: 500,
  maxTimeout: 3000,
  randomize: true,
};

export function createSlackWebClient(token: string): WebClient {
  return new WebClient(token, { retryConfig: DEFAULT_RETRY_OPTIONS });
}

// ── Channel ID resolution ───────────────────────────────────────────────────
// For channel targets, returns the ID directly.
// For user targets, opens a DM conversation and returns the DM channel ID.

export async function resolveChannelId(
  client: WebClient,
  recipient: SlackRecipient,
): Promise<string> {
  if (recipient.kind === "channel") {
    return recipient.id;
  }
  const response = await client.conversations.open({ users: recipient.id });
  const channelId = response.channel?.id;
  if (!channelId) {
    throw new Error("Failed to open Slack DM channel");
  }
  return channelId;
}
