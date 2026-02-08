import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { scheduleSlackMessage } from "./src/schedule.js";

const SlackScheduleMessageSchema = Type.Object({
  to: Type.String({
    description:
      "Slack target: channel ID, user ID, or prefixed form " +
      "(channel:C123, user:U123, #C123, @U123).",
  }),
  message: Type.String({
    description: "The text message to schedule for delivery.",
  }),
  postAt: Type.Number({
    description:
      "Unix timestamp in seconds for when to deliver the message. " +
      "Must be at least 15 seconds in the future and within 120 days.",
  }),
  threadId: Type.Optional(
    Type.String({
      description:
        "Optional thread timestamp (thread_ts) to schedule the message as a thread reply.",
    }),
  ),
  accountId: Type.Optional(
    Type.String({
      description: "Slack account ID when using a multi-account setup.",
    }),
  ),
});

const plugin = {
  id: "slack-scheduled-message",
  name: "Slack Scheduled Message",
  description: "Schedule Slack messages for future delivery via chat.scheduleMessage.",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerTool({
      name: "slack_schedule_message",
      label: "Schedule Slack Message",
      description:
        "Schedule a Slack message for future delivery. " +
        "Supports channels, DMs, and thread replies. " +
        "postAt is a Unix timestamp in seconds (min 15 s from now, max 120 days). " +
        "No media/file attachments for scheduled messages.",
      parameters: SlackScheduleMessageSchema,
      async execute(_toolCallId, params) {
        const json = (payload: unknown) => ({
          content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
          details: payload,
        });

        try {
          const result = await scheduleSlackMessage({
            to: String(params.to ?? ""),
            message: String(params.message ?? ""),
            postAt: Number(params.postAt),
            threadTs: typeof params.threadId === "string" ? params.threadId : undefined,
            accountId: typeof params.accountId === "string" ? params.accountId : undefined,
            config: api.config,
          });

          return json({
            ok: true,
            scheduled: true,
            scheduledMessageId: result.scheduledMessageId,
            postAt: result.postAt,
            channelId: result.channelId,
          });
        } catch (err) {
          return json({
            ok: false,
            scheduled: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });
  },
};

export default plugin;
