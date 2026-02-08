import type { WebClient } from "@slack/web-api";
import { resolveSlackAccount, type OpenClawConfig } from "openclaw/plugin-sdk";
import { createSlackWebClient, parseSlackTarget, resolveChannelId } from "./slack-helpers.js";

const MAX_SCHEDULE_DAYS = 120;
const MIN_SCHEDULE_BUFFER_SECONDS = 15;

export type SlackScheduleResult = {
  scheduledMessageId: string;
  postAt: number;
  channelId: string;
};

export type ScheduleSlackMessageParams = {
  to: string;
  message: string;
  postAt: number;
  threadTs?: string;
  accountId?: string;
  config: OpenClawConfig;
  /** Inject a WebClient for testing. */
  client?: WebClient;
};

function resolveToken(account: {
  accountId: string;
  botToken?: string;
  botTokenSource?: string;
}): string {
  const token = account.botToken?.trim();
  if (token) {
    return token;
  }
  throw new Error(
    `Slack bot token missing for account "${account.accountId}" ` +
      `(set channels.slack.accounts.${account.accountId}.botToken or SLACK_BOT_TOKEN for default).`,
  );
}

export async function scheduleSlackMessage(
  params: ScheduleSlackMessageParams,
): Promise<SlackScheduleResult> {
  const { to, postAt, config } = params;

  // 1. Validate message
  const trimmedMessage = params.message?.trim() ?? "";
  if (!trimmedMessage) {
    throw new Error("Slack schedule requires text message");
  }

  // 2. Validate postAt is in the future with buffer
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (postAt <= nowSeconds + MIN_SCHEDULE_BUFFER_SECONDS) {
    throw new Error(
      `postAt must be at least ${MIN_SCHEDULE_BUFFER_SECONDS} seconds in the future`,
    );
  }

  // 3. Validate postAt is within 120 days
  const maxPostAt = nowSeconds + MAX_SCHEDULE_DAYS * 24 * 60 * 60;
  if (postAt > maxPostAt) {
    throw new Error(`postAt must be within ${MAX_SCHEDULE_DAYS} days`);
  }

  // 4. Resolve Slack account + token
  const account = resolveSlackAccount({ cfg: config, accountId: params.accountId });
  const token = resolveToken(account);

  // 5. Create client
  const client = params.client ?? createSlackWebClient(token);

  // 6. Parse target
  const recipient = parseSlackTarget(to);
  if (!recipient) {
    throw new Error("Recipient is required for Slack scheduled messages");
  }

  // 7. Resolve channel ID (opens DM for user targets)
  const channelId = await resolveChannelId(client, recipient);

  // 8. Call Slack API
  const response = await client.chat.scheduleMessage({
    channel: channelId,
    text: trimmedMessage,
    post_at: postAt,
    ...(params.threadTs ? { thread_ts: params.threadTs } : {}),
  });

  if (!response.scheduled_message_id) {
    throw new Error("Failed to schedule Slack message: no scheduled_message_id returned");
  }

  return {
    scheduledMessageId: response.scheduled_message_id,
    postAt: response.post_at ?? postAt,
    channelId,
  };
}
